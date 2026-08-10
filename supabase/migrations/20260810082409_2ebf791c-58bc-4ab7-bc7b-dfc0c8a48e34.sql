ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_proof_path text,
  ADD COLUMN IF NOT EXISTS delivery_note text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE POLICY "delivery_proofs_vendor_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
      AND oi.order_id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "delivery_proofs_vendor_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
      AND oi.order_id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "delivery_proofs_customer_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = auth.uid()
      AND o.id::text = (storage.foldername(storage.objects.name))[1]
  )
);