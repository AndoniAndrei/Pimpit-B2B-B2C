export type ProductType = 'jante' | 'accesorii';

export interface Product {
  id: string;
  part_number: string;
  brand: string;
  name: string;
  slug: string;
  product_type: ProductType;
  diameter?: number;
  width?: number;
  width_rear?: number;
  et_offset?: number;
  et_offset_rear?: number;
  et_min?: number;
  et_max?: number;
  center_bore?: number;
  pcd?: string;
  pcd_secondary?: string;
  color?: string;
  finish?: string;
  price: number;
  price_old?: number;
  price_b2b?: number;
  images: string[];
  stock: number;
  stock_incoming: number;
  is_active: boolean;
}

export interface FilterOptions {
  diameters: number[];
  widths: number[];
  pcds: string[];
  brands: string[];
  et_offsets: number[];
  product_types: string[];
  price_min: number;
  price_max: number;
  total_products: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: Product;
}

export interface UserProfile {
  id: string;
  role: 'customer_b2c' | 'customer_b2b' | 'admin';
  first_name?: string;
  last_name?: string;
  phone?: string;
  company_name?: string;
  cui?: string;
  reg_com?: string;
  b2b_discount_pct: number;
}
