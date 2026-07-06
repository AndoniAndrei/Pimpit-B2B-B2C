-- ============================================================================
-- 019 — publish_import_job(): scrie și price_b2b din offer_payload
-- (mapper-ul v2 acceptă acum offer:price_b2b — coloană sau formulă).
-- Înlocuiește integral funcția din 017; rollback_import_job rămâne neschimbat.
-- ============================================================================

CREATE OR REPLACE FUNCTION publish_import_job(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  job        import_jobs%ROWTYPE;
  r          RECORD;
  attr       RECORD;
  cat_path   BIGINT[];
  v_brand    BIGINT;
  v_brand_name TEXT;
  v_product  UUID;
  v_variant  UUID;
  fam_name   TEXT;
  fam_slug   TEXT;
  media_url  TEXT;
  media_pos  INT;
  n_created  INT := 0;
  n_updated  INT := 0;
  n_unchanged INT := 0;
  n_deactivated INT := 0;
BEGIN
  SELECT * INTO job FROM import_jobs WHERE id = p_job_id FOR UPDATE;
  IF job.id IS NULL THEN
    RAISE EXCEPTION 'Job % inexistent', p_job_id;
  END IF;
  IF job.status <> 'staged' THEN
    RAISE EXCEPTION 'Jobul % are status %, doar "staged" se poate publica', p_job_id, job.status;
  END IF;
  IF job.mode = 'dry_run' THEN
    RAISE EXCEPTION 'Jobul % e dry_run — nu se publică', p_job_id;
  END IF;

  UPDATE import_jobs SET status = 'publishing' WHERE id = p_job_id;

  -- Calea categoriei profilului (pentru rezolvarea definițiilor de atribute,
  -- inclusiv cele moștenite de la categoriile părinte)
  WITH RECURSIVE path AS (
    SELECT c.id, c.parent_id
    FROM categories c
    JOIN supplier_mapping_profiles p ON p.category_id = c.id
    WHERE p.id = job.profile_id
    UNION ALL
    SELECT c.id, c.parent_id FROM categories c JOIN path ON c.id = path.parent_id
  )
  SELECT array_agg(id) INTO cat_path FROM path;

  FOR r IN
    SELECT * FROM import_staged_variants
    WHERE job_id = p_job_id AND validation_status = 'mapped' AND published_at IS NULL
    ORDER BY id
  LOOP
    IF r.action = 'unchanged' THEN
      UPDATE supplier_offers
      SET last_seen_at = now(), import_job_id = p_job_id
      WHERE variant_id = r.matched_variant_id AND supplier_id = job.supplier_id;
      n_unchanged := n_unchanged + 1;

    ELSIF r.action = 'deactivate' THEN
      UPDATE supplier_offers
      SET is_available = false, import_job_id = p_job_id
      WHERE variant_id = r.matched_variant_id AND supplier_id = job.supplier_id;
      n_deactivated := n_deactivated + 1;

    ELSE  -- create / update
      -- ── Brand ──────────────────────────────────────────────────────────
      v_brand := NULLIF(r.product_payload->>'brand_id', '')::BIGINT;
      v_brand_name := r.product_payload->>'brand_name';
      IF v_brand IS NULL THEN
        INSERT INTO brands (name, slug)
        VALUES (v_brand_name, slugify(v_brand_name))
        ON CONFLICT (slug) DO UPDATE SET updated_at = now()
        RETURNING id INTO v_brand;
      END IF;
      SELECT name INTO v_brand_name FROM brands WHERE id = v_brand;

      -- ── Familie (catalog_products) ─────────────────────────────────────
      fam_name := COALESCE(NULLIF(r.product_payload->>'family_name', ''), r.variant_payload->>'name');
      fam_slug := slugify(v_brand_name || '-' || fam_name);
      INSERT INTO catalog_products (category_id, brand_id, slug, name, description)
      VALUES (
        (r.product_payload->>'category_id')::BIGINT,
        v_brand, fam_slug, fam_name,
        NULLIF(r.product_payload->>'description', '')
      )
      ON CONFLICT (slug) DO UPDATE SET updated_at = now()
      RETURNING id INTO v_product;

      -- ── Variantă ───────────────────────────────────────────────────────
      IF r.matched_variant_id IS NOT NULL THEN
        v_variant := r.matched_variant_id;
        UPDATE product_variants
        SET ean         = COALESCE(NULLIF(r.variant_payload->>'ean', ''), ean),
            name_suffix = COALESCE(NULLIF(r.variant_payload->>'name_suffix', ''), name_suffix),
            discontinued = false,
            updated_at  = now()
        WHERE id = v_variant;
      ELSE
        INSERT INTO product_variants (product_id, brand_id, part_number, ean, name_suffix)
        VALUES (
          v_product, v_brand,
          r.variant_payload->>'part_number',
          NULLIF(r.variant_payload->>'ean', ''),
          NULLIF(r.variant_payload->>'name_suffix', '')
        )
        ON CONFLICT (brand_id, part_number) DO UPDATE SET updated_at = now()
        RETURNING id INTO v_variant;
      END IF;

      -- ── Atribute tipizate ──────────────────────────────────────────────
      FOR attr IN
        SELECT d.id AS def_id, d.data_type, kv.value
        FROM jsonb_each(r.attributes_payload) AS kv(code, value)
        JOIN category_attribute_definitions d
          ON d.code = kv.code AND d.category_id = ANY (cat_path)
      LOOP
        INSERT INTO product_variant_attributes
          (variant_id, attribute_id, value_text, value_numeric, value_numeric_max, value_boolean, value_json)
        VALUES (
          v_variant, attr.def_id,
          CASE WHEN attr.data_type IN ('text','enum') THEN attr.value #>> '{}' END,
          CASE WHEN attr.data_type IN ('number','integer') THEN (attr.value #>> '{}')::NUMERIC
               WHEN attr.data_type = 'range' THEN (attr.value->>'min')::NUMERIC END,
          CASE WHEN attr.data_type = 'range' THEN (attr.value->>'max')::NUMERIC END,
          CASE WHEN attr.data_type = 'boolean' THEN (attr.value #>> '{}')::BOOLEAN END,
          CASE WHEN attr.data_type = 'multi_enum' THEN attr.value END
        )
        ON CONFLICT (variant_id, attribute_id) DO UPDATE
        SET value_text        = EXCLUDED.value_text,
            value_numeric     = EXCLUDED.value_numeric,
            value_numeric_max = EXCLUDED.value_numeric_max,
            value_boolean     = EXCLUDED.value_boolean,
            value_json        = EXCLUDED.value_json;
      END LOOP;

      -- ── Ofertă ─────────────────────────────────────────────────────────
      INSERT INTO supplier_offers
        (variant_id, supplier_id, raw_price, raw_currency, price, price_b2b,
         stock, stock_incoming, supplier_sku, lead_time_days,
         is_available, last_seen_at, import_job_id)
      VALUES (
        v_variant, job.supplier_id,
        NULLIF(r.offer_payload->>'raw_price', '')::NUMERIC,
        COALESCE(NULLIF(r.offer_payload->>'raw_currency', ''), 'RON'),
        NULLIF(r.offer_payload->>'price', '')::NUMERIC,
        NULLIF(r.offer_payload->>'price_b2b', '')::NUMERIC,
        COALESCE((r.offer_payload->>'stock')::INT, 0),
        COALESCE((r.offer_payload->>'stock_incoming')::INT, 0),
        NULLIF(r.offer_payload->>'supplier_sku', ''),
        NULLIF(r.offer_payload->>'lead_time_days', '')::INT,
        true, now(), p_job_id
      )
      ON CONFLICT (variant_id, supplier_id) DO UPDATE
      SET raw_price      = EXCLUDED.raw_price,
          raw_currency   = EXCLUDED.raw_currency,
          price          = EXCLUDED.price,
          price_b2b      = EXCLUDED.price_b2b,
          stock          = EXCLUDED.stock,
          stock_incoming = EXCLUDED.stock_incoming,
          supplier_sku   = EXCLUDED.supplier_sku,
          lead_time_days = EXCLUDED.lead_time_days,
          is_available   = true,
          last_seen_at   = now(),
          import_job_id  = p_job_id;

      -- ── Media (doar URL-uri noi pentru variantă) ───────────────────────
      media_pos := 0;
      FOR media_url IN SELECT jsonb_array_elements_text(r.media_payload)
      LOOP
        INSERT INTO media_assets (product_id, variant_id, kind, source, url, position)
        SELECT v_product, v_variant, 'image', 'feed_url', media_url, media_pos
        WHERE NOT EXISTS (
          SELECT 1 FROM media_assets m WHERE m.variant_id = v_variant AND m.url = media_url
        );
        media_pos := media_pos + 1;
      END LOOP;

      IF r.action = 'create' THEN n_created := n_created + 1;
      ELSE n_updated := n_updated + 1;
      END IF;
    END IF;

    UPDATE import_staged_variants SET published_at = now() WHERE id = r.id;
  END LOOP;

  UPDATE import_jobs
  SET status = 'published',
      rows_published = n_created + n_updated + n_unchanged + n_deactivated,
      finished_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'created', n_created, 'updated', n_updated,
    'unchanged', n_unchanged, 'deactivated', n_deactivated
  );
END;
$$;

COMMENT ON FUNCTION publish_import_job(UUID) IS
  'Aplică atomic rândurile din import_staged_variants în catalogul canonic. '
  'Rulează într-o singură tranzacție; ofertele atinse sunt ștampilate cu import_job_id.';

