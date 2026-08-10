ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS estimated_delivery timestamptz;

UPDATE public.orders SET estimated_delivery = created_at + interval '45 minutes' WHERE estimated_delivery IS NULL;

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_events_select_own ON public.order_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_events.order_id AND o.user_id = auth.uid()));

CREATE POLICY order_events_vendor_read ON public.order_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE oi.order_id = order_events.order_id AND s.owner_id = auth.uid()
  ));

-- Vendors may advance status of orders containing their products
CREATE POLICY orders_vendor_update ON public.orders
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE oi.order_id = orders.id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE oi.order_id = orders.id AND s.owner_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, status, note)
    VALUES (NEW.id, NEW.status, 'Order placed and confirmed');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
    INSERT INTO public.order_events (order_id, status, note)
    VALUES (NEW.id, NEW.status, CASE NEW.status
      WHEN 'packed' THEN 'Your items are packed'
      WHEN 'out_for_delivery' THEN 'Rider is on the way'
      WHEN 'delivered' THEN 'Delivered — enjoy!'
      WHEN 'cancelled' THEN 'Order cancelled'
      ELSE 'Status updated' END);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_status_change ON public.orders;
CREATE TRIGGER orders_status_change
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

DROP TRIGGER IF EXISTS orders_created_event ON public.orders;
CREATE TRIGGER orders_created_event
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;