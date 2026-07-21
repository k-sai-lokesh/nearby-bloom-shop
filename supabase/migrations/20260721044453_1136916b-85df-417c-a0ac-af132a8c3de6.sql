
CREATE POLICY "order_items_vendor_read" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = order_items.product_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "orders_vendor_read" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      JOIN public.stores s ON s.id = p.store_id
      WHERE oi.order_id = orders.id AND s.owner_id = auth.uid()
    )
  );
