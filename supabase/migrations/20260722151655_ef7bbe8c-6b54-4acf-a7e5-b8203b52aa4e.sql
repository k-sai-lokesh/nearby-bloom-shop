ALTER TABLE public.products ADD COLUMN IF NOT EXISTS flash_sale_ends_at TIMESTAMPTZ;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER TABLE public.products REPLICA IDENTITY FULL;