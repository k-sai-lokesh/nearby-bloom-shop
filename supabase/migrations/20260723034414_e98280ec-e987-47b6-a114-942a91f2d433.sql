
CREATE OR REPLACE FUNCTION public.reserve_flash_item(p_product_id uuid, p_quantity int DEFAULT 1)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_stock int;
  v_existing_id uuid;
  v_existing_qty int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN p_quantity := 1; END IF;

  SELECT stock INTO v_stock
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  SELECT id, quantity INTO v_existing_id, v_existing_qty
  FROM public.cart_items
  WHERE user_id = v_user AND product_id = p_product_id;

  IF v_stock < COALESCE(v_existing_qty, 0) + p_quantity THEN
    RAISE EXCEPTION 'OUT_OF_STOCK';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.cart_items SET quantity = v_existing_qty + p_quantity WHERE id = v_existing_id;
    RETURN v_existing_id;
  ELSE
    INSERT INTO public.cart_items (user_id, product_id, quantity)
    VALUES (v_user, p_product_id, p_quantity)
    RETURNING id INTO v_existing_id;
    RETURN v_existing_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_flash_item(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_flash_item(uuid, int) TO authenticated;
