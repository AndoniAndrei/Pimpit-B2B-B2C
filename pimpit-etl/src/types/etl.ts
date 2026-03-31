export type ProductType  = 'jante' | 'accesorii';
export type SyncStatus   = 'running' | 'success' | 'failed' | 'aborted';
export type RawCurrency  = 'EUR' | 'RON' | 'SEK' | 'PLN';

export interface NormalizedProduct {
  partNumber: string;
  brand: string;
  name: string;
  productType: ProductType;
  diameter?: number;
  width?: number;
  widthRear?: number;
  etOffset?: number;
  etOffsetRear?: number;
  centerBore?: number;
  pcd?: string;
  pcdSecondary?: string;
  rawPrice: number;
  rawCurrency: RawCurrency;
  calculatedPrice: number;
  priceOld?: number;
  stock: number;
  stockIncoming: number;
  images: string[];
  color?: string;
  finish?: string;
  supplierId: number;
  rawData: Record<string, unknown>;
}

export interface SupplierConfig {
  id: number;
  name: string;
  slug: string;
  feedUrl: string;
  format: 'csv' | 'json' | 'xml';
  authMethod: 'none' | 'api_key' | 'basic_auth' | 'oauth';
  apiKeyRef?: string;
  customerIdRef?: string;
  tokenRef?: string;
  isActive: boolean;
  brandWhitelist?: string[];
  brandBlacklist?: string[];
  csvDelimiter: string;
}

export interface PricingRule {
  supplierId: number;
  baseDiscount: number;
  baseMultiplier: number;
  fixedCost: number;
  vatMultiplier: number;
  marginMultiplier: number;
  finalDivisor: number;
  minMarginPct?: number;
  oldPriceFormula?: string;
}

export interface SyncResult {
  supplierId: number;
  status: SyncStatus;
  productsFetched: number;
  productsInserted: number;
  productsUpdated: number;
  productsSkipped: number;
  productsBefore: number;
  safetyCheckPassed: boolean;
  safetyCheckReason?: string;
  errorMessage?: string;
  errorDetails?: unknown;
  durationMs: number;
}

export class ValidationError extends Error {
  constructor(public field: string, public value: unknown, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class SafetyCheckError extends Error {
  constructor(public newCount: number, public existingCount: number, public reason: string) {
    super(`Safety check failed: ${reason}`);
    this.name = 'SafetyCheckError';
  }
}

export class FetchError extends Error {
  constructor(
    public supplierId: number,
    public url: string,
    public statusCode?: number,
    message?: string
  ) {
    super(message ?? `Fetch failed for supplier ${supplierId}`);
    this.name = 'FetchError';
  }
}
