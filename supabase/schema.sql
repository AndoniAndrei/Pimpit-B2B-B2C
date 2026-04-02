-- EXTENSII
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUMS
CREATE TYPE product_type_enum AS ENUM ('jante', 'accesorii');
CREATE TYPE sync_status_enum  AS ENUM ('running', 'success', 'failed', 'aborted');
CREATE TYPE auth_method_enum  AS ENUM ('none', 'api_key', 'basic_auth', 'oauth');
CREATE TYPE feed_format_enum  AS ENUM ('csv', 'json', 'xml');
CREATE TYPE user_role_enum    AS ENUM ('customer_b2c', 'customer_b2b', 'admin');
CREATE TYPE order_status_enum AS ENUM (
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
);

-- ================================================================
-- TABEL: suppliers
-- ================================================================
CREATE TABLE suppliers (
  id                  SMALLINT PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  slug                VARCHAR(50)  NOT NULL UNIQUE,
  feed_url            TEXT         NOT NULL,
  format              feed_format_enum NOT NULL DEFAULT 'csv',
  auth_method         auth_method_enum NOT NULL DEFAULT 'none',
  api_key_ref         VARCHAR(100),
  customer_id_ref     VARCHAR(100),
  token_ref           VARCHAR(100),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  brand_whitelist     TEXT[],
  brand_blacklist     TEXT[],
  csv_delimiter       CHAR(1) NOT NULL DEFAULT ',',
  driver_config       JSONB,
  last_sync_at        TIMESTAMPTZ,
  last_product_count  INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO suppliers (id, name, slug, feed_url, format, auth_method, csv_delimiter) VALUES
(1, 'Sursa 1', 'supplier-1',
   'https://docs.google.com/spreadsheets/d/SHEET_ID_1/export?format=csv&gid=0',
   'csv', 'none', ','),
(2, 'Sursa 2', 'supplier-2',
   'https://docs.google.com/spreadsheets/d/SHEET_ID_2/export?format=csv&gid=0',
   'csv', 'none', ','),
(3, 'Wheeltrade', 'wheeltrade',
   'https://api.wheeltrade.eu/products?api_key={API_KEY}',
   'csv', 'api_key', ';'),
(4, 'Felgeo', 'felgeo',
   'https://felgeo.pl/feed/{TOKEN}',
   'csv', 'none', ';'),
(5, 'ABS Wheels', 'abs-wheels',
   'https://www.abswheels.eu/exportFile?AUTH_KEY={API_KEY}',
   'json', 'api_key', ','),
(6, 'Statusfälgar', 'statusfalgar',
   'https://api.statusfalgar.se/api/Products',
   'json', 'basic_auth', ','),
(7, 'Veemann', 'veemann',
   'https://veemann.com/feed/products.csv',
   'csv', 'none', ',');

UPDATE suppliers SET api_key_ref = 'WHEELTRADE_API_KEY',
  driver_config = '{"csv_delimiter":";"}' WHERE slug = 'wheeltrade';
UPDATE suppliers SET token_ref = 'FELGEO_TOKEN',
  driver_config = '{"csv_delimiter":";"}' WHERE slug = 'felgeo';
UPDATE suppliers SET api_key_ref = 'ABS_WHEELS_API_KEY' WHERE slug = 'abs-wheels';
UPDATE suppliers SET
  customer_id_ref = 'STATUSFALGAR_CUSTOMER_ID',
  token_ref = 'STATUSFALGAR_TOKEN',
  brand_whitelist = ARRAY['Dirt AT','Boost Wheels','Status Wheels']
  WHERE slug = 'statusfalgar';

-- ================================================================
-- TABEL: pricing_rules
-- ================================================================
CREATE TABLE pricing_rules (
  id                SERIAL PRIMARY KEY,
  supplier_id       SMALLINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  base_discount     NUMERIC(6,5) NOT NULL DEFAULT 0,
  base_multiplier   NUMERIC(8,4) NOT NULL DEFAULT 1,
  fixed_cost        NUMERIC(8,2) NOT NULL DEFAULT 0,
  vat_multiplier    NUMERIC(6,4) NOT NULL DEFAULT 1.19,
  margin_multiplier NUMERIC(6,4) NOT NULL DEFAULT 1.10,
  final_divisor     NUMERIC(6,4) NOT NULL DEFAULT 1,
  min_margin_pct    NUMERIC(6,5),
  old_price_formula TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO pricing_rules
  (supplier_id, base_discount, base_multiplier, fixed_cost, vat_multiplier,
   margin_multiplier, final_divisor, notes)
VALUES
(1, 0,    1,    0,   1.19, 1.10, 1,
   'Sursa 1: preț vine gata în RON — pass-through'),
(2, 0,    6,    20,  1.21, 1.43, 1,
   'Sursa 2: EUR + cost fix + TVA + marjă'),
(3, 0,    5,    0,   1.00, 1.00, 1,
   'Wheeltrade: dual price logic via supplier_transforms'),
(4, 0,    5,    17.5,1.21, 1.35, 1,
   'Felgeo: EUR + transport + TVA + marjă'),
(5, 0,    5,    0,   1.21, 1.40, 1,
   'ABS Wheels: EUR × curs × TVA × marjă'),
(6, 0.52, 1,    0,   1.21, 1.40, 1,
   'Statusfälgar: SEK cu discount 52% de la furnizor'),
(7, 0.20, 5.78, 25,  1.21, 1.40, 1,
   'Veemann: RRP EUR cu 20% discount aplicat, conversie 5.78');

UPDATE pricing_rules SET old_price_formula = 'rrp * 5.78' WHERE supplier_id = 7;

-- ================================================================
-- TABEL: supplier_transforms
-- ================================================================
CREATE TABLE supplier_transforms (
  id             SERIAL PRIMARY KEY,
  supplier_id    SMALLINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  transform_type VARCHAR(50) NOT NULL,
  config         JSONB NOT NULL DEFAULT '{}',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  sort_order     SMALLINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wheeltrade: dual price (SRP vs NET)
INSERT INTO supplier_transforms (supplier_id, transform_type, config) VALUES
(3, 'dual_price', '{
  "srp_threshold": 100,
  "srp_low_add": 10,
  "srp_multiplier": 5,
  "min_margin_multiplier": 5,
  "min_margin_pct": 0.15
}');

-- ABS Wheels: corectare date murdare
INSERT INTO supplier_transforms (supplier_id, transform_type, config) VALUES
(5, 'brand_remap', '{
  "rules": [
    {"match_field":"name",  "contains":"stw",    "new_brand":"ABS","new_name":"STW 287"},
    {"match_field":"brand", "equals":"355",      "new_brand":"ABS","new_name":"355"},
    {"match_field":"brand", "equals":"AERO",     "new_brand":"ABS","new_name":"AERO"},
    {"match_field":"brand", "equals":"ABS F55",  "new_brand":"ABS","new_name":"F88"}
  ]
}');

-- Statusfälgar: prefix URL imagini
INSERT INTO supplier_transforms (supplier_id, transform_type, config) VALUES
(6, 'image_url_prefix', '{
  "prefix": "https://api.statusfalgar.se/api/Images/",
  "field": "ImageId"
}');

-- Statusfälgar: filtrare brand (doar cele 3 branduri permise)
INSERT INTO supplier_transforms (supplier_id, transform_type, config) VALUES
(6, 'brand_whitelist', '{
  "allowed": ["Dirt AT","Boost Wheels","Status Wheels"]
}');

-- ================================================================
-- TABEL: products (catalogul unificat, post-deduplicare)
-- ================================================================
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_number         VARCHAR(100) NOT NULL,
  brand               VARCHAR(100) NOT NULL,
  name                TEXT NOT NULL,
  slug                VARCHAR(400) NOT NULL UNIQUE,
  product_type        product_type_enum NOT NULL DEFAULT 'jante',
  diameter            NUMERIC(5,2),
  width               NUMERIC(5,2),
  width_rear          NUMERIC(5,2),
  et_offset           NUMERIC(6,2),
  et_offset_rear      NUMERIC(6,2),
  center_bore         NUMERIC(7,2),
  pcd                 VARCHAR(20),
  pcd_secondary       VARCHAR(20),
  color               VARCHAR(100),
  finish              VARCHAR(100),
  price               NUMERIC(10,2) NOT NULL,
  price_old           NUMERIC(10,2),
  price_b2b           NUMERIC(10,2),
  images              TEXT[] NOT NULL DEFAULT '{}',
  stock               INTEGER NOT NULL DEFAULT 0,
  stock_incoming      INTEGER NOT NULL DEFAULT 0,
  winning_supplier_id SMALLINT REFERENCES suppliers(id),
  winning_raw_price   NUMERIC(12,4),
  custom_fields       JSONB NOT NULL DEFAULT '{}',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(part_number, brand)
);

CREATE INDEX idx_prod_active        ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_prod_brand         ON products(brand)        WHERE is_active = true;
CREATE INDEX idx_prod_diameter      ON products(diameter)     WHERE is_active = true;
CREATE INDEX idx_prod_width         ON products(width)        WHERE is_active = true;
CREATE INDEX idx_prod_pcd           ON products(pcd)          WHERE is_active = true;
CREATE INDEX idx_prod_et            ON products(et_offset)    WHERE is_active = true;
CREATE INDEX idx_prod_price         ON products(price)        WHERE is_active = true;
CREATE INDEX idx_prod_stock         ON products(stock)        WHERE is_active = true AND stock > 0;
CREATE INDEX idx_prod_type          ON products(product_type) WHERE is_active = true;
CREATE INDEX idx_prod_supplier      ON products(winning_supplier_id) WHERE is_active = true;
CREATE INDEX idx_prod_name_trgm     ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_prod_brand_trgm    ON products USING gin(brand gin_trgm_ops);
CREATE INDEX idx_prod_fts           ON products USING gin(
  to_tsvector('simple',
    coalesce(brand,'') || ' ' || coalesce(name,'') || ' ' || coalesce(part_number,'')
  )
);

-- ================================================================
-- TABEL: product_sources (toate variantele, toate sursele — pentru audit)
-- ================================================================
CREATE TABLE product_sources (
  id               BIGSERIAL PRIMARY KEY,
  part_number      VARCHAR(100) NOT NULL,
  brand            VARCHAR(100) NOT NULL,
  supplier_id      SMALLINT NOT NULL REFERENCES suppliers(id),
  raw_price        NUMERIC(12,4) NOT NULL,
  raw_currency     VARCHAR(3) NOT NULL DEFAULT 'EUR',
  calculated_price NUMERIC(10,2) NOT NULL,
  stock            INTEGER NOT NULL DEFAULT 0,
  stock_incoming   INTEGER NOT NULL DEFAULT 0,
  raw_data         JSONB,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(part_number, brand, supplier_id)
);

CREATE INDEX idx_sources_supplier ON product_sources(supplier_id);
CREATE INDEX idx_sources_product  ON product_sources(part_number, brand);

-- ================================================================
-- TABEL: price_history (trigger automat la schimbare preț)
-- ================================================================
CREATE TABLE price_history (
  id          BIGSERIAL PRIMARY KEY,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price       NUMERIC(10,2) NOT NULL,
  price_b2b   NUMERIC(10,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ph_product ON price_history(product_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price
  OR OLD.price_b2b IS DISTINCT FROM NEW.price_b2b THEN
    INSERT INTO price_history(product_id, price, price_b2b)
    VALUES (NEW.id, NEW.price, NEW.price_b2b);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_price_history
  AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION record_price_change();

-- ================================================================
-- TABEL: sync_logs
-- ================================================================
CREATE TABLE sync_logs (
  id                  BIGSERIAL PRIMARY KEY,
  supplier_id         SMALLINT REFERENCES suppliers(id),
  status              sync_status_enum NOT NULL,
  products_fetched    INTEGER NOT NULL DEFAULT 0,
  products_inserted   INTEGER NOT NULL DEFAULT 0,
  products_updated    INTEGER NOT NULL DEFAULT 0,
  products_skipped    INTEGER NOT NULL DEFAULT 0,
  products_before     INTEGER NOT NULL DEFAULT 0,
  safety_check_passed BOOLEAN NOT NULL DEFAULT true,
  safety_check_reason TEXT,
  error_message       TEXT,
  error_details       JSONB,
  duration_ms         INTEGER NOT NULL DEFAULT 0,
  finished_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_supplier ON sync_logs(supplier_id, finished_at DESC);
CREATE INDEX idx_sync_finished ON sync_logs(finished_at DESC);

-- ================================================================
-- TABEL: users (profil extins, legat de auth.users Supabase)
-- ================================================================
CREATE TABLE users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role             user_role_enum NOT NULL DEFAULT 'customer_b2c',
  first_name       VARCHAR(100),
  last_name        VARCHAR(100),
  phone            VARCHAR(20),
  company_name     VARCHAR(200),
  cui              VARCHAR(20),
  reg_com          VARCHAR(20),
  b2b_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================================
-- TABEL: addresses
-- ================================================================
CREATE TABLE addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(50),
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  phone       VARCHAR(20),
  street      TEXT NOT NULL,
  city        VARCHAR(100) NOT NULL,
  county      VARCHAR(100) NOT NULL,
  postal_code VARCHAR(10),
  country     VARCHAR(100) NOT NULL DEFAULT 'România',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addr_user ON addresses(user_id);

-- ================================================================
-- TABEL: cart
-- ================================================================
CREATE TABLE cart (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id  VARCHAR(100),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cart_user_product    UNIQUE(user_id, product_id),
  CONSTRAINT cart_session_product UNIQUE(session_id, product_id)
);

CREATE INDEX idx_cart_user    ON cart(user_id);
CREATE INDEX idx_cart_session ON cart(session_id);

-- ================================================================
-- TABEL: orders + order_items (snapshot la momentul plasării)
-- ================================================================
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id),
  status           order_status_enum NOT NULL DEFAULT 'pending',
  shipping_address JSONB NOT NULL,
  billing_address  JSONB,
  subtotal         NUMERIC(10,2) NOT NULL,
  shipping_cost    NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL,
  customer_email   VARCHAR(255),
  customer_phone   VARCHAR(20),
  customer_name    VARCHAR(200),
  shipping_method  VARCHAR(100),
  payment_method   VARCHAR(50),
  payment_status   VARCHAR(50) DEFAULT 'pending',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user    ON orders(user_id);
CREATE INDEX idx_orders_status  ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  product_brand VARCHAR(100),
  product_pn    VARCHAR(100),
  product_image TEXT,
  unit_price    NUMERIC(10,2) NOT NULL,
  quantity      SMALLINT NOT NULL DEFAULT 1,
  total_price   NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_oi_order ON order_items(order_id);

-- ================================================================
-- TABEL: price_alerts
-- ================================================================
CREATE TABLE price_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_price NUMERIC(10,2) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- ================================================================
-- MATERIALIZED VIEW: filter_options
-- Pre-calculată — refresh la fiecare sync ETL, nu la fiecare request
-- ================================================================
CREATE MATERIALIZED VIEW filter_options AS
SELECT
  array_agg(DISTINCT diameter   ORDER BY diameter)   FILTER (WHERE diameter   IS NOT NULL) AS diameters,
  array_agg(DISTINCT width      ORDER BY width)      FILTER (WHERE width      IS NOT NULL) AS widths,
  array_agg(DISTINCT pcd        ORDER BY pcd)        FILTER (WHERE pcd        IS NOT NULL) AS pcds,
  array_agg(DISTINCT brand      ORDER BY brand)                                            AS brands,
  array_agg(DISTINCT et_offset  ORDER BY et_offset)  FILTER (WHERE et_offset  IS NOT NULL) AS et_offsets,
  array_agg(DISTINCT product_type::TEXT ORDER BY product_type::TEXT)                       AS product_types,
  MIN(price) AS price_min,
  MAX(price) AS price_max,
  COUNT(*)   AS total_products
FROM products
WHERE is_active = true;

CREATE UNIQUE INDEX idx_filter_options_uniq ON filter_options((1));

CREATE OR REPLACE FUNCTION refresh_filter_options()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY filter_options;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_transforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts    ENABLE ROW LEVEL SECURITY;

-- Helper function: rolul utilizatorului curent
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role::TEXT FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Produse: citire publică
CREATE POLICY "products_read"    ON products FOR SELECT USING (is_active = true);
CREATE POLICY "products_service" ON products FOR ALL    USING (auth.role() = 'service_role');

-- product_sources: doar service_role (ETL)
CREATE POLICY "sources_service"  ON product_sources FOR ALL USING (auth.role() = 'service_role');

-- Suppliers / pricing_rules / transforms: citire admin + service
CREATE POLICY "suppliers_read"   ON suppliers   FOR SELECT USING (get_my_role() = 'admin' OR auth.role() = 'service_role');
CREATE POLICY "suppliers_write"  ON suppliers   FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "pricing_read"     ON pricing_rules FOR SELECT USING (get_my_role() = 'admin' OR auth.role() = 'service_role');
CREATE POLICY "pricing_write"    ON pricing_rules FOR ALL    USING (auth.role() = 'service_role' OR get_my_role() = 'admin');
CREATE POLICY "transforms_read"  ON supplier_transforms FOR SELECT USING (get_my_role() = 'admin' OR auth.role() = 'service_role');
CREATE POLICY "transforms_write" ON supplier_transforms FOR ALL    USING (auth.role() = 'service_role' OR get_my_role() = 'admin');

-- Sync logs: citire admin, scriere service
CREATE POLICY "sync_read"        ON sync_logs FOR SELECT USING (get_my_role() = 'admin');
CREATE POLICY "sync_write"       ON sync_logs FOR ALL    USING (auth.role() = 'service_role');

-- Users: profil propriu + admin vede toate
CREATE POLICY "users_read"       ON users FOR SELECT USING (auth.uid() = id OR get_my_role() = 'admin');
CREATE POLICY "users_update"     ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert"     ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Addresses, cart, alerts: doar proprietarul
CREATE POLICY "addr_own"         ON addresses    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "cart_own"         ON cart         FOR ALL USING (auth.uid() = user_id OR (user_id IS NULL));
CREATE POLICY "alerts_own"       ON price_alerts FOR ALL USING (auth.uid() = user_id);

-- Orders: clientul vede ale lui, admin vede tot, oricine poate insera
CREATE POLICY "orders_read"      ON orders FOR SELECT USING (auth.uid() = user_id OR get_my_role() = 'admin');
CREATE POLICY "orders_insert"    ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_admin_upd" ON orders FOR UPDATE USING (get_my_role() = 'admin');
CREATE POLICY "oi_read"          ON order_items FOR SELECT USING (
  EXISTS(SELECT 1 FROM orders o WHERE o.id = order_items.order_id
    AND (o.user_id = auth.uid() OR get_my_role() = 'admin'))
);
CREATE POLICY "oi_insert"        ON order_items FOR INSERT WITH CHECK (true);

-- Price history: publică (pentru badge "Preț Redus")
CREATE POLICY "ph_read"          ON price_history FOR SELECT USING (true);
CREATE POLICY "ph_service"       ON price_history FOR ALL    USING (auth.role() = 'service_role');
