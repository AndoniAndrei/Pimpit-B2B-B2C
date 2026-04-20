-- ============================================================
-- Migration 012: atomic order creation with stock reservation
-- ============================================================
-- Context:
--   The /api/orders POST handler used to read products.stock in
--   application code, then insert the order and order_items in
--   separate statements. Two concurrent checkouts on the last
--   unit could both pass the JS-side "stock >= qty" check and
--   both succeed — oversell — and stock itself was never
--   decremented.
--
-- What this migration does:
--   1. Defines create_order_atomic(...) which, in a single
--      transaction, locks each involved product row via
--      UPDATE ... WHERE stock >= qty, decrements stock, then
--      inserts the order + all order_items. If any line has
--      insufficient stock, the whole transaction aborts.
--   2. Uses SECURITY DEFINER so the function can bypass RLS on
--      products.stock while still being called by the cookie-
--      based user session client. search_path is pinned to avoid
--      function-resolution hijacks.
--   3. On insufficient stock raises SQLSTATE 'P0001' with a
--      structured MESSAGE the API handler parses into a 400.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_user_id         UUID,
  p_customer_name   TEXT,
  p_customer_email  TEXT,
  p_customer_phone  TEXT,
  p_shipping_address JSONB,
  p_billing_address  JSONB,
  p_payment_method  TEXT,
  p_items           JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order_id       UUID;
  v_subtotal       NUMERIC(12,2) := 0;
  v_shipping_cost  NUMERIC(10,2);
  v_item           JSONB;
  v_product_id     UUID;
  v_quantity       INT;
  v_unit_price     NUMERIC(10,2);
  v_updated        UUID;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Reserve stock for every line. UPDATE with the stock guard
  --    locks the row and only succeeds when stock is sufficient.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::INT;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'INVALID_ITEM' USING ERRCODE = 'P0001';
    END IF;

    UPDATE products
       SET stock = stock - v_quantity
     WHERE id = v_product_id
       AND stock >= v_quantity
    RETURNING id INTO v_updated;

    IF v_updated IS NULL THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_product_id USING ERRCODE = 'P0001';
    END IF;

    v_subtotal := v_subtotal + (v_quantity * v_unit_price);
  END LOOP;

  v_shipping_cost := CASE WHEN v_subtotal > 1000 THEN 0 ELSE 50 END;

  -- 2. Insert the order header.
  INSERT INTO orders (
    user_id, status, shipping_address, billing_address,
    subtotal, shipping_cost, total,
    customer_email, customer_phone, customer_name, payment_method
  ) VALUES (
    p_user_id, 'pending', p_shipping_address,
    COALESCE(p_billing_address, p_shipping_address),
    v_subtotal, v_shipping_cost, v_subtotal + v_shipping_cost,
    p_customer_email, p_customer_phone, p_customer_name, p_payment_method
  )
  RETURNING id INTO v_order_id;

  -- 3. Insert all line items in one statement.
  INSERT INTO order_items (
    order_id, product_id, product_name, product_brand, product_pn, product_image,
    unit_price, quantity, total_price,
    selected_et, selected_pcd, needs_help_et, needs_help_pcd
  )
  SELECT
    v_order_id,
    (item->>'product_id')::UUID,
    item->>'product_name',
    item->>'product_brand',
    item->>'product_pn',
    item->>'product_image',
    (item->>'unit_price')::NUMERIC,
    (item->>'quantity')::INT,
    (item->>'quantity')::INT * (item->>'unit_price')::NUMERIC,
    NULLIF(item->>'selected_et', '')::NUMERIC,
    NULLIF(item->>'selected_pcd', ''),
    COALESCE((item->>'needs_help_et')::BOOLEAN, false),
    COALESCE((item->>'needs_help_pcd')::BOOLEAN, false)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_order_id;
END;
$$;

-- Let the cookie-based user session + anonymous guest checkout call it.
-- SECURITY DEFINER still limits what the body can do.
REVOKE ALL ON FUNCTION public.create_order_atomic(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) TO anon, authenticated, service_role;
