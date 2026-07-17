import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cart")({
  component: CartPage,
});

type CartRow = {
  id: string;
  quantity: number;
  product_id: string;
  products: {
    id: string; name: string; price: number | string;
    flash_price: number | string | null; is_flash_sale: boolean | null;
    stock: number; image_url: string | null; stores: { name: string | null } | null;
  } | null;
};

function CartPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cart_items")
        .select("id,quantity,product_id,products(id,name,price,flash_price,is_flash_sale,stock,image_url,stores(name))")
        .order("created_at");
      return (data ?? []) as unknown as CartRow[];
    },
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity <= 0) await supabase.from("cart_items").delete().eq("id", id);
      else await supabase.from("cart_items").update({ quantity }).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cart"] }); qc.invalidateQueries({ queryKey: ["cart-count"] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("cart_items").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cart"] }); qc.invalidateQueries({ queryKey: ["cart-count"] }); toast.success("Removed"); },
  });

  const subtotal = items.reduce((s, it) => {
    if (!it.products) return s;
    const p = it.products.is_flash_sale && it.products.flash_price != null ? Number(it.products.flash_price) : Number(it.products.price);
    return s + p * it.quantity;
  }, 0);

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-16">Loading…</div>;

  if (items.length === 0) return (
    <div className="mx-auto max-w-5xl px-4 py-16 text-center">
      <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
      <h1 className="text-2xl font-bold">Your cart is empty</h1>
      <p className="text-muted-foreground mt-1">Discover fresh finds from stores nearby.</p>
      <Link to="/browse" search={{ q: undefined, cat: undefined }}>
        <Button className="mt-6 rounded-full gradient-hero text-white">Start shopping</Button>
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Your cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map((it) => {
            if (!it.products) return null;
            const p = it.products;
            const unit = p.is_flash_sale && p.flash_price != null ? Number(p.flash_price) : Number(p.price);
            return (
              <Card key={it.id} className="p-4 rounded-2xl flex gap-4">
                <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden shrink-0">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to="/product/$id" params={{ id: p.id }} className="font-semibold hover:underline block truncate">{p.name}</Link>
                  <p className="text-xs text-muted-foreground">{p.stores?.name}</p>
                  <p className="mt-1 font-bold">{formatPrice(unit)}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => remove.mutate(it.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  <div className="flex items-center rounded-full border border-border">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQty.mutate({ id: it.id, quantity: it.quantity - 1 })}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-sm">{it.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={it.quantity >= p.stock} onClick={() => updateQty.mutate({ id: it.id, quantity: it.quantity + 1 })}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-6 rounded-2xl h-fit sticky top-24">
          <h2 className="font-semibold mb-4">Order summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="text-success">Free</span></div>
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-base"><span>Total</span><span>{formatPrice(subtotal)}</span></div>
          </div>
          <Link to="/checkout">
            <Button size="lg" className="w-full mt-6 rounded-full gradient-hero text-white shadow-[var(--shadow-glow)]">Checkout</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
