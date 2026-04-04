import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side image proxy — fetches supplier CDN images and streams them back.
 *
 * Why: some supplier CDNs block browser requests based on Referer or User-Agent,
 * even when using plain <img> tags. A server-side fetch can set browser-like
 * headers that CDNs accept, and the result is cached at the edge.
 *
 * Usage: /api/image-proxy?url=https%3A%2F%2Fcdn.supplier.com%2Fimage.jpg
 */

// Cache proxy responses for 1 hour at the edge
export const revalidate = 3600;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Security: only proxy http/https URLs — block file://, data:, etc.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new NextResponse('Only http/https URLs are allowed', { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: BROWSER_HEADERS,
      // Don't follow infinite redirects
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    // Only proxy image content types
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Upstream did not return an image', { status: 502 });
    }

    const body = upstream.body;
    if (!body) {
      return new NextResponse('Empty response from upstream', { status: 502 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cache at CDN/browser for 1 hour, stale-while-revalidate for 24h
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    return new NextResponse(`Proxy fetch failed: ${err.message}`, { status: 502 });
  }
}
