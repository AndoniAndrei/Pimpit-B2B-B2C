/**
 * Catalog V2 — tipuri canonice pentru modelul universal de produse.
 * Oglindesc schema din supabase/migrations/012–015.
 * Vezi docs/CATALOG_V2_PLAN.md.
 */

// ── Taxonomie ────────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
  icon: string | null;
  position: number;
  is_active: boolean;
}

export interface Brand {
  id: number;
  manufacturer_id: number | null;
  slug: string;
  name: string;
  aliases: string[];
  logo_url: string | null;
  website: string | null;
  is_active: boolean;
}

export interface Manufacturer {
  id: number;
  slug: string;
  name: string;
  country: string | null;
  website: string | null;
}

// ── Produse ──────────────────────────────────────────────────────────────────

/** Familia de produs (ex. modelul de jantă "JR11") — 1 pagină, N variante. */
export interface CatalogProduct {
  id: string;
  category_id: number;
  brand_id: number;
  slug: string;
  name: string;
  description: string | null;
  attrs: Record<string, unknown>;
  seo_title: string | null;
  seo_description: string | null;
  is_active: boolean;
  legacy_source: string | null;
}

/** SKU vandabil — combinația concretă (mărime/finisaj/etc.). */
export interface ProductVariant {
  id: string;
  product_id: string;
  brand_id: number;
  part_number: string;
  ean: string | null;
  slug: string | null;
  name_suffix: string | null;
  /** Mirror JSONB al atributelor tipizate: { diameter_inch: 19, et_offset: {min:20,max:50} } */
  attrs: Record<string, unknown>;
  price: number | null;
  price_old: number | null;
  price_b2b: number | null;
  stock: number;
  stock_incoming: number;
  best_offer_id: string | null;
  weight_kg: number | null;
  is_active: boolean;
  discontinued: boolean;
  legacy_product_id: string | null;
}

export interface SupplierOffer {
  id: string;
  variant_id: string;
  supplier_id: number;
  supplier_sku: string | null;
  raw_price: number | null;
  raw_currency: string;
  price: number | null;
  price_old: number | null;
  price_b2b: number | null;
  stock: number;
  stock_incoming: number;
  lead_time_days: number | null;
  is_available: boolean;
  last_seen_at: string;
  import_job_id: string | null;
}

export type MediaKind = 'image' | 'video' | 'model_3d' | 'document' | 'certificate';
export type MediaSource = 'feed_url' | 'rest_proxy' | 'zip_import' | 'manual';

export interface MediaAsset {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  kind: MediaKind;
  source: MediaSource;
  url: string;
  storage_path: string | null;
  alt: string | null;
  position: number;
}

// ── Sistem de atribute ───────────────────────────────────────────────────────

export type AttributeDataType =
  | 'text' | 'number' | 'integer' | 'boolean' | 'enum' | 'multi_enum' | 'range';

export interface CategoryAttributeDefinition {
  id: number;
  category_id: number;
  code: string;
  label: string;
  data_type: AttributeDataType;
  unit: string | null;
  enum_options: string[] | null;
  is_required: boolean;
  is_variant_defining: boolean;
  validation: { min?: number; max?: number; regex?: string } | null;
  position: number;
}

export type FilterWidget = 'checkbox_list' | 'range_slider' | 'toggle' | 'search_select';

export interface CategoryFilterDefinition {
  id: number;
  category_id: number;
  attribute_id: number;
  widget: FilterWidget;
  position: number;
  show_counts: boolean;
  is_active: boolean;
}

/** Valoarea unui atribut range (ex. ET 20–50). */
export interface RangeValue {
  min: number;
  max: number;
}

// ── Vehicule & fitment ───────────────────────────────────────────────────────

export interface VehicleMake {
  id: number;
  slug: string;
  name: string;
}

export interface VehicleModel {
  id: number;
  make_id: number;
  slug: string;
  name: string;
}

export interface Vehicle {
  id: number;
  model_id: number;
  generation_id: number | null;
  year: number;
  trim: string;
  specs: Record<string, unknown>;
}

export type FitmentPosition = 'front' | 'rear' | 'both';
export type FitmentSource = 'fitment_gallery' | 'supplier' | 'rule' | 'manual' | 'customer';

/** Setup real (galeria Fitment Industries sau surse viitoare). */
export interface VehicleFitment {
  id: number;
  vehicle_id: number;
  source: FitmentSource;
  source_url: string | null;
  front_diameter: number | null;
  front_width: number | null;
  front_offset: number | null;
  rear_diameter: number | null;
  rear_width: number | null;
  rear_offset: number | null;
  is_staggered: boolean;
  front_tire_width: number | null;
  front_tire_aspect: number | null;
  front_tire_diameter: number | null;
  rear_tire_width: number | null;
  rear_tire_aspect: number | null;
  rear_tire_diameter: number | null;
  front_tire_raw: string | null;
  rear_tire_raw: string | null;
  rubbing: string | null;
  trimming: string | null;
  spacers_front: string | null;
  spacers_rear: string | null;
  stance: string | null;
}

// ── Import engine ────────────────────────────────────────────────────────────

export type ImportJobStatus =
  | 'queued' | 'fetching' | 'parsing' | 'mapping' | 'validating' | 'staged'
  | 'publishing' | 'published' | 'failed' | 'rolled_back' | 'cancelled';

export type ImportJobMode = 'dry_run' | 'staged' | 'direct';

export interface ImportJob {
  id: string;
  supplier_id: number;
  feed_id: number | null;
  profile_id: number | null;
  triggered_by: string;
  mode: ImportJobMode;
  status: ImportJobStatus;
  snapshot_path: string | null;
  snapshot_hash: string | null;
  rows_total: number;
  rows_parsed: number;
  rows_mapped: number;
  rows_error: number;
  rows_staged: number;
  rows_published: number;
  stats: Record<string, unknown>;
  error_message: string | null;
}

export type MappingTargetKind = 'core' | 'attribute' | 'offer' | 'media' | 'custom';

export interface SupplierFieldMapping {
  id: number;
  profile_id: number;
  target_kind: MappingTargetKind;
  target_code: string;
  source_expression: string;
  transform: ValueTransform[];
  required: boolean;
  default_value: string | null;
  position: number;
}

/** Un pas din lanțul de transformare a unei valori mapate. */
export type ValueTransform =
  | { type: 'trim' }
  | { type: 'uppercase' }
  | { type: 'lowercase' }
  | { type: 'number_locale'; locale?: 'eu' | 'us' | 'auto' }
  | { type: 'unit_convert'; from: string; to: string }
  | { type: 'regex_extract'; pattern: string; group?: number }
  | { type: 'value_remap'; map: Record<string, string> };

export interface SupplierMappingProfile {
  id: number;
  supplier_id: number;
  feed_id: number | null;
  category_id: number;
  name: string;
  version: number;
  is_active: boolean;
  notes: string | null;
}
