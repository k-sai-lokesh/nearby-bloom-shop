
-- =============== PROFILES ===============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== CATEGORIES ===============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (true);

-- =============== STORES ===============
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  distance_km NUMERIC(5,2) DEFAULT 1.5,
  rating NUMERIC(2,1) DEFAULT 4.5,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stores TO anon, authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores_public_read" ON public.stores FOR SELECT TO anon, authenticated USING (true);

-- =============== PRODUCTS ===============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  is_flash_sale BOOLEAN DEFAULT false,
  flash_price NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX products_name_idx ON public.products USING gin (to_tsvector('english', name || ' ' || COALESCE(description,'')));
CREATE INDEX products_category_idx ON public.products(category_id);

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== CART ===============
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_own_all" ON public.cart_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== WISHLIST ===============
CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_own_all" ON public.wishlist_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== ORDERS ===============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_image TEXT,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select_own" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "order_items_insert_own" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- =============== REVIEWS ===============
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id)
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============== ATOMIC CHECKOUT RPC ===============
-- Places order with atomic stock guard. Uses row locks; concurrent buyers
-- of the last unit: one succeeds, the other gets an OUT_OF_STOCK error.
CREATE OR REPLACE FUNCTION public.place_order(
  p_address TEXT, p_city TEXT, p_phone TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_order UUID;
  v_total NUMERIC(10,2) := 0;
  r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  -- Lock relevant product rows and validate stock
  FOR r IN
    SELECT c.product_id, c.quantity, p.name, p.image_url,
           COALESCE(p.flash_price, p.price) AS unit_price, p.stock
    FROM public.cart_items c
    JOIN public.products p ON p.id = c.product_id
    WHERE c.user_id = v_user
    FOR UPDATE OF p
  LOOP
    IF r.stock < r.quantity THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', r.name;
    END IF;
    v_total := v_total + r.unit_price * r.quantity;
  END LOOP;

  IF v_total = 0 THEN RAISE EXCEPTION 'EMPTY_CART'; END IF;

  INSERT INTO public.orders (user_id, total, address, city, phone)
  VALUES (v_user, v_total, p_address, p_city, p_phone)
  RETURNING id INTO v_order;

  -- Decrement stock atomically and copy items
  FOR r IN
    SELECT c.product_id, c.quantity, p.name, p.image_url,
           COALESCE(p.flash_price, p.price) AS unit_price
    FROM public.cart_items c
    JOIN public.products p ON p.id = c.product_id
    WHERE c.user_id = v_user
  LOOP
    UPDATE public.products
      SET stock = stock - r.quantity
      WHERE id = r.product_id AND stock >= r.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', r.name;
    END IF;
    INSERT INTO public.order_items (order_id, product_id, product_name, product_image, price, quantity)
    VALUES (v_order, r.product_id, r.name, r.image_url, r.unit_price, r.quantity);
  END LOOP;

  DELETE FROM public.cart_items WHERE user_id = v_user;
  RETURN v_order;
END; $$;
GRANT EXECUTE ON FUNCTION public.place_order(TEXT,TEXT,TEXT) TO authenticated;

-- =============== SEED DATA ===============
INSERT INTO public.categories (name, slug, icon) VALUES
  ('Groceries','groceries','🥦'),
  ('Bakery','bakery','🥐'),
  ('Beverages','beverages','🧃'),
  ('Dairy','dairy','🥛'),
  ('Snacks','snacks','🍪'),
  ('Household','household','🧴');

INSERT INTO public.stores (id, name, description, address, city, distance_km, rating, image_url) VALUES
  ('11111111-1111-1111-1111-111111111111','Corner Market','Fresh produce & pantry staples','12 Oak Street','Brooklyn',0.4,4.8,'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800'),
  ('22222222-2222-2222-2222-222222222222','Sunrise Bakery','Artisan breads baked daily','48 Baker Lane','Brooklyn',0.9,4.9,'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800'),
  ('33333333-3333-3333-3333-333333333333','Green Grocer','Organic & local produce','203 Park Ave','Brooklyn',1.6,4.6,'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800');

WITH cat AS (SELECT id, slug FROM public.categories)
INSERT INTO public.products (store_id, category_id, name, description, price, stock, image_url, is_flash_sale, flash_price)
SELECT s.id, c.id, p.name, p.description, p.price, p.stock, p.image_url, p.flash, p.flash_price
FROM (VALUES
  ('11111111-1111-1111-1111-111111111111','groceries','Organic Avocados','Ripe & ready, pack of 4',6.99,24,'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=800',false,NULL::numeric),
  ('11111111-1111-1111-1111-111111111111','groceries','Roma Tomatoes','Vine-ripened, 1 lb',3.49,8,'https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=800',false,NULL),
  ('33333333-3333-3333-3333-333333333333','groceries','Baby Spinach','Triple-washed, 5 oz',4.29,15,'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800',true,3.29),
  ('22222222-2222-2222-2222-222222222222','bakery','Sourdough Loaf','Naturally leavened, baked today',7.50,4,'https://images.unsplash.com/photo-1585478259715-4d3f38b3b7f2?w=800',false,NULL),
  ('22222222-2222-2222-2222-222222222222','bakery','Butter Croissants','Flaky, pack of 6',9.00,12,'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',false,NULL),
  ('11111111-1111-1111-1111-111111111111','dairy','Whole Milk','Grass-fed, 1 gallon',5.99,20,'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800',false,NULL),
  ('11111111-1111-1111-1111-111111111111','dairy','Greek Yogurt','Plain, 32 oz',5.49,3,'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',false,NULL),
  ('11111111-1111-1111-1111-111111111111','beverages','Cold Brew Coffee','12 oz bottle',4.75,18,'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800',true,3.50),
  ('33333333-3333-3333-3333-333333333333','beverages','Sparkling Water','Lime, 6-pack',6.25,30,'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800',false,NULL),
  ('11111111-1111-1111-1111-111111111111','snacks','Sea Salt Chips','Kettle-cooked, 8 oz',3.99,9,'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=800',false,NULL),
  ('11111111-1111-1111-1111-111111111111','snacks','Dark Chocolate','70% cacao bar',3.49,25,'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=800',false,NULL),
  ('11111111-1111-1111-1111-111111111111','household','Dish Soap','Lemon, 16 oz',4.50,14,'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800',false,NULL)
) AS p(store_id, cat_slug, name, description, price, stock, image_url, flash, flash_price)
JOIN public.stores s ON s.id = p.store_id::uuid
JOIN cat c ON c.slug = p.cat_slug;
