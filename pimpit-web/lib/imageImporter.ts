/**
 * MB Design (and similar) ZIP-based image import pipeline.
 *
 * Flow:
 *  1. Download ZIP once per URL (cached in-memory for the import session)
 *  2. Unzip with fflate, find image by ID (searches all folders, any ext)
 *  3. Upload to Supabase Storage bucket "product-images"
 *  4. Return public URL
 */

import { unzipSync } from 'fflate';

// ── In-memory ZIP cache (lives for the duration of one import run) ───────────

const zipCache = new Map<string, Record<string, Uint8Array>>();

async function downloadAndUnzip(url: string): Promise<Record<string, Uint8Array>> {
  if (zipCache.has(url)) return zipCache.get(url)!;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(180_000), // 3 min for large ZIPs
  });

  if (!res.ok) throw new Error(`ZIP download failed: HTTP ${res.status} — ${url}`);

  const buf = await res.arrayBuffer();
  const files = unzipSync(new Uint8Array(buf));
  zipCache.set(url, files);
  return files;
}

/** Clear cache between import runs to free memory */
export function clearZipCache() {
  zipCache.clear();
}

// ── Image lookup ─────────────────────────────────────────────────────────────

function findImageInZip(
  files: Record<string, Uint8Array>,
  imageId: string | number
): { data: Uint8Array; ext: string; filename: string } | null {
  const id = String(imageId).trim();
  if (!id || id === '0') return null;

  // Look for {id}.png, {id}.jpg, {id}.jpeg in any folder (case-insensitive)
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    for (const path of Object.keys(files)) {
      const filename = path.split('/').pop() ?? '';
      if (filename.toLowerCase() === `${id.toLowerCase()}.${ext}`) {
        return { data: files[path], ext, filename };
      }
    }
  }
  return null;
}

// ── Supabase Storage upload ───────────────────────────────────────────────────

const BUCKET = 'product-images';

export async function uploadImageToStorage(
  supabase: any,
  imageId: string | number,
  data: Uint8Array,
  ext: string,
  brand: string
): Promise<string | null> {
  const safeId = String(imageId).trim();
  const safeBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const path = `${safeBrand}/${safeId}.${ext}`;

  // Check if already uploaded — skip re-upload
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list(safeBrand, { search: `${safeId}.${ext}` });

  if (existing?.length) {
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return pub?.publicUrl ?? null;
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, data, {
      contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      upsert: false,
    });

  if (error) return null;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub?.publicUrl ?? null;
}

// ── Main: process images for a batch of products ─────────────────────────────

export interface ProductImageSpec {
  partNumber: string;
  brand: string;
  zipUrl: string;
  imageIds: (string | number)[];
}

export interface ImageProcessResult {
  partNumber: string;
  brand: string;
  urls: string[];
  errors: string[];
}

export async function processProductImages(
  supabase: any,
  specs: ProductImageSpec[]
): Promise<ImageProcessResult[]> {
  // Group by ZIP URL to download each ZIP only once
  const byZip = new Map<string, ProductImageSpec[]>();
  for (const spec of specs) {
    if (!spec.zipUrl) continue;
    const arr = byZip.get(spec.zipUrl) ?? [];
    arr.push(spec);
    byZip.set(spec.zipUrl, arr);
  }

  const results: ImageProcessResult[] = [];

  for (const [zipUrl, zipSpecs] of Array.from(byZip)) {
    let files: Record<string, Uint8Array>;
    try {
      files = await downloadAndUnzip(zipUrl);
    } catch (e: any) {
      // All products in this ZIP get an error
      for (const s of zipSpecs) {
        results.push({ partNumber: s.partNumber, brand: s.brand, urls: [], errors: [`ZIP error: ${e.message}`] });
      }
      continue;
    }

    for (const spec of zipSpecs) {
      const urls: string[] = [];
      const errors: string[] = [];

      for (const imageId of spec.imageIds) {
        const found = findImageInZip(files, imageId);
        if (!found) {
          errors.push(`ID ${imageId} not found in ZIP`);
          continue;
        }
        const url = await uploadImageToStorage(supabase, imageId, found.data, found.ext, spec.brand);
        if (url) urls.push(url);
        else errors.push(`Upload failed for ID ${imageId}`);
      }

      results.push({ partNumber: spec.partNumber, brand: spec.brand, urls, errors });
    }
  }

  return results;
}
