'use client';

import { useState } from 'react';

interface Props {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
}

function Placeholder({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center text-gray-300 w-full h-full ${className ?? ''}`}>
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

/**
 * ProductImage — loads supplier images with a two-stage fallback strategy:
 *
 * 1. Direct load (referrerPolicy="no-referrer") — works for most CDNs.
 * 2. Server-side proxy (/api/image-proxy) — used when direct load fails.
 *    The proxy fetches with browser-like headers, bypassing CDN restrictions.
 * 3. Placeholder — shown only when both attempts fail or src is empty.
 */
export default function ProductImage({
  src,
  alt,
  className = '',
  fill = false,
  priority = false,
}: Props) {
  // 'direct' → 'proxy' → 'broken'
  const [stage, setStage] = useState<'direct' | 'proxy' | 'broken'>('direct');

  if (!src || stage === 'broken') {
    return <Placeholder className={fill ? 'absolute inset-0' : ''} />;
  }

  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(src)}`;
  const imgSrc = stage === 'direct' ? src : proxyUrl;

  const handleError = () => {
    if (stage === 'direct') {
      setStage('proxy');
    } else {
      setStage('broken');
    }
  };

  const baseClass = fill
    ? `absolute inset-0 w-full h-full object-contain ${className}`
    : `w-full h-full object-contain ${className}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={imgSrc}          /* force re-mount when src changes (proxy retry) */
      src={imgSrc}
      alt={alt}
      onError={handleError}
      loading={priority ? 'eager' : 'lazy'}
      referrerPolicy={stage === 'direct' ? 'no-referrer' : undefined}
      className={baseClass}
    />
  );
}
