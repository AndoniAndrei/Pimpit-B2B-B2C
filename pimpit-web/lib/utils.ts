import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
  }).format(price)
}

// Strips characters that have special meaning in PostgREST filter strings
// (%, _ wildcards; , ( ) : " \ filter syntax) and caps length so user-provided
// search input can be safely interpolated into .or() / .ilike() expressions.
export function sanitizeSearchInput(raw: string): string {
  return raw.slice(0, 100).replace(/[%_,():"\\]/g, ' ').trim()
}
