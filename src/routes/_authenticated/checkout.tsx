import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: Checkout,
});

function Checkout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [card] = useState("4242 4242 4242 4242");

  useEffect(() => {
    supabase.from("profiles").select("address,city,phone").maybeSingle().then(({ data }) => {
      if (data) {
        setAddress(data.address ?? "");
        setCity(data.city ?? "");
        setPhone(data.phone ?? "");
      }
    });
  }, []);

  const { data: items = [] } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cart_items")
        .select("quantity,products(name,price,flash_price,is_flash_sale)");
      return data ?? [];
    },
  });

  const subtotal = items.reduce((s: number, it) => {
    const p = it.products as { price: number | string; flash_price: number | string | null; is_flash_sale: boolean | null } | null;
    if (!p) return s;
    const u = p.is_flash_sale && p.flash_price != null ? Number(p.flash_price) : Number(p.price);
    return s + u * (it.quantity as number);
  }, 0);

  const place = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("place_order", {
        p_address: address, p_city: city, p_phone: phone,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (orderId) => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order confirmed!");
      navigate({ to: "/orders", search: { placed: orderId } });
    },
    onError: (e: Error) => {
      if (e.message.startsWith("OUT_OF_STOCK")) {
        const item = e.message.split(":")[1] ?? "an item";
        toast.error(`Sorry — ${item} just sold out.`);
      } else if (e.message === "EMPTY_CART") toast.error("Your cart is empty");
      else toast.error(e.message);
    },
  });

  if (items.length === 0) return (
    <div className="mx-auto max-w-5xl px-4 py-16 text-center">
      <p className="text-lg font-semibold">Your cart is empty.</p>
      <Link to="/browse" search={{ q: undefined, cat: undefined }}><Button className="mt-4">Browse products</Button></Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Checkout</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); place.mutate(); }}
        className="grid gap-6 lg:grid-cols-[1fr_360px]"
      >
        <div className="space-y-6">
          <Card className="p-6 rounded-2xl">
            <h2 className="font-semibold mb-4">Delivery address</h2>
            <div className="grid gap-3">
              <div><Label>Street address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} required /></div>
                <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              </div>
            </div>
          </Card>
          <Card className="p-6 rounded-2xl">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment (simulated)</h2>
            <div className="rounded-2xl gradient-hero text-white p-5 max-w-sm">
              <p className="text-xs opacity-80">Card number</p>
              <p className="font-mono tracking-widest text-lg">{card}</p>
              <div className="flex justify-between mt-4 text-xs opacity-90">
                <div><p className="opacity-70">Expires</p><p>12/29</p></div>
                <div><p className="opacity-70">CVC</p><p>•••</p></div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> This is a demo checkout. No real payment is processed.
            </p>
          </Card>
        </div>

        <Card className="p-6 rounded-2xl h-fit sticky top-24">
          <h2 className="font-semibold mb-4">Summary</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span>{items.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="text-success">Free</span></div>
            <div className="border-t border-border mt-2 pt-2 flex justify-between text-base font-bold"><span>Total</span><span>{formatPrice(subtotal)}</span></div>
          </div>
          <Button type="submit" size="lg" disabled={place.isPending} className="w-full mt-6 rounded-full gradient-hero text-white shadow-[var(--shadow-glow)]">
            {place.isPending ? "Placing order…" : `Place order · ${formatPrice(subtotal)}`}
          </Button>
        </Card>
      </form>
    </div>
  );
}
