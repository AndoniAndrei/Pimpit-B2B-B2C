'use client';

import { useState } from 'react';

interface Props {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
}

/**
 * ProductImage — renders supplier images without Next.js optimization.
 *
 * Why unoptimized: product images come from external supplier CDNs.
 * Next.js /_next/image proxy (server-side fetch) gets blocked by many CDNs
 * that check Referer/Origin or filter non-browser User-Agents.
 * Serving the URL directly (like a plain <img>) works reliably.
 */
export default function ProductImage({ src, alt, className = '', fill = false, sizes, priority = false }: Props) {
  const [broken, setBroken] = useState(false);

  if (broken || !src) {
    return (
      <div className={`flex flex-col items-center justify-center text-gray-300 gap-2 w-full h-full ${className}`}>
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        onError={() => setBroken(true)}
        loading={priority ? 'eager' : 'lazy'}
        className={`absolute inset-0 w-full h-full object-contain ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      loading={priority ? 'eager' : 'lazy'}
      className={`w-full h-full object-contain ${className}`}
    />
  );
}
