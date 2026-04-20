import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';
import net from 'net';

/**
 * Server-side image proxy — fetches supplier CDN images and streams them back.
 *
 * Why: some supplier CDNs block browser requests based on Referer or User-Agent,
 * even when using plain <img> tags. A server-side fetch can set browser-like
 * headers that CDNs accept, and the result is cached at the edge.
 *
 * Usage: /api/image-proxy?url=https%3A%2F%2Fcdn.supplier.com%2Fimage.jpg
 *
 * SSRF hardening:
 *   - only http/https
 *   - resolve DNS and reject loopback, link-local, multicast and RFC1918 IPs
 *   - redirects are resolved manually so each hop goes through the same checks
 *   - response capped to MAX_IMAGE_BYTES and must have image/* content-type
 */

export const runtime = 'nodejs';
export const revalidate = 3600;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — matches storage bucket limit
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;                           // 0.0.0.0/8
  if (a === 10) return true;                          // private
  if (a === 127) return true;                         // loopback
  if (a === 169 && b === 254) return true;            // link-local (incl. AWS/GCP metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;   // private
  if (a === 192 && b === 168) return true;            // private
  if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
  if (a >= 224) return true;                          // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('ff')) return true; // multicast
  // IPv4-mapped: ::ffff:a.b.c.d
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  // Block literal private IPs in the URL itself
  if (net.isIP(hostname)) {
    const isPrivate = net.isIPv4(hostname) ? isPrivateIPv4(hostname) : isPrivateIPv6(hostname);
    if (isPrivate) throw new Error('Blocked private address');
    return;
  }
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) throw new Error('DNS lookup returned no addresses');
  for (const r of records) {
    const isPrivate = r.family === 4 ? isPrivateIPv4(r.address) : isPrivateIPv6(r.address);
    if (isPrivate) throw new Error('Blocked private address');
  }
}

function parseAndValidate(rawUrl: string): URL {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed');
  }
  if (u.username || u.password) {
    // userinfo in URL is almost always a fingerprinting or SSRF vector
    throw new Error('URL userinfo is not allowed');
  }
  return u;
}

async function fetchWithGuards(initialUrl: URL, signal: AbortSignal): Promise<Response> {
  let current = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current.hostname);
    const res = await fetch(current.toString(), {
      headers: BROWSER_HEADERS,
      redirect: 'manual',
      signal,
    });
    // Treat 3xx with Location as a redirect to follow manually
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      const next = parseAndValidate(new URL(loc, current).toString());
      current = next;
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new NextResponse('Missing url parameter', { status: 400 });

  let parsed: URL;
  try {
    parsed = parseAndValidate(raw);
  } catch (e: any) {
    return new NextResponse(e.message || 'Invalid URL', { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetchWithGuards(parsed, controller.signal);

    if (!upstream.ok) {
      return new NextResponse(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new NextResponse('Upstream did not return an image', { status: 502 });
    }

    const declaredLen = parseInt(upstream.headers.get('content-length') || '', 10);
    if (Number.isFinite(declaredLen) && declaredLen > MAX_IMAGE_BYTES) {
      return new NextResponse('Image too large', { status: 502 });
    }

    const body = upstream.body;
    if (!body) return new NextResponse('Empty response from upstream', { status: 502 });

    // Stream through with a byte cap so we never buffer more than MAX_IMAGE_BYTES.
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
          try { await reader.cancel(); } catch { /* noop */ }
          return new NextResponse('Image too large', { status: 502 });
        }
        chunks.push(value);
      }
    }

    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Upstream timeout' : err?.message || 'Proxy fetch failed';
    return new NextResponse(msg, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
