import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice } from "@/lib/format";
import { DollarSign, ShoppingBag, Clock, CheckCircle2, TrendingUp, Store as StoreIcon } from "lucide-react";
import { SmartRestock } from "@/components/smart-restock";
import { toast } from "sonner";
import { nextStage, statusLabel } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/vendor")({
  component: VendorDashboard,
});

function VendorDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: isVendor, isLoading: roleLoading } = useQuery({
    queryKey: ["is-vendor", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "vendor")
        .maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    if (!roleLoading && isVendor === false) navigate({ to: "/", replace: true });
  }, [roleLoading, isVendor, navigate]);

  const { data: store } = useQuery({
    queryKey: ["vendor-store", userId],
    enabled: !!userId && isVendor === true,
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, city, image_url, rating")
        .eq("owner_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["vendor-stats", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      // Products for this store
      const { data: products } = await supabase
        .from("products")
        .select("id, name, image_url, stock, price, flash_price, is_flash_sale")
        .eq("store_id", store!.id);
      const productIds = (products ?? []).map((p) => p.id);
      if (productIds.length === 0) {
        return {
          products: products ?? [],
          items: [] as Array<{ order_id: string; product_id: string; product_name: string; price: number; quantity: number; created_at: string; status: string }>,
        };
      }

      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, product_id, product_name, price, quantity, orders!inner(created_at, status)")
        .in("product_id", productIds);

      const flat = (items ?? []).map((r: any) => ({
        order_id: r.order_id,
        product_id: r.product_id,
        product_name: r.product_name,
        price: Number(r.price),
        quantity: r.quantity,
        created_at: r.orders.created_at,
        status: r.orders.status,
      }));
      return { products: products ?? [], items: flat };
    },
  });

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["vendor-stats"] });
      toast.success(`Order marked ${statusLabel(v.status)}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleLoading || !isVendor) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground">
        Loading vendor dashboard…
      </div>
    );
  }

  const items = stats?.items ?? [];
  const products = stats?.products ?? [];

  const revenue = items.reduce((s, r) => s + r.price * r.quantity, 0);
  const orderIds = new Set(items.map((i) => i.order_id));
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrderIds = new Set(
    items.filter((i) => new Date(i.created_at) >= todayStart).map((i) => i.order_id),
  );
  const pendingOrderIds = new Set(
    items.filter((i) => ["pending", "confirmed", "processing"].includes(i.status)).map((i) => i.order_id),
  );
  const completedOrderIds = new Set(
    items.filter((i) => ["completed", "delivered", "fulfilled"].includes(i.status)).map((i) => i.order_id),
  );

  const bySeller = new Map<string, { name: string; units: number; revenue: number }>();
  for (const r of items) {
    const cur = bySeller.get(r.product_id) ?? { name: r.product_name, units: 0, revenue: 0 };
    cur.units += r.quantity;
    cur.revenue += r.price * r.quantity;
    bySeller.set(r.product_id, cur);
  }
  const topSellers = Array.from(bySeller.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const recentByOrder = new Map<string, { created_at: string; status: string; total: number }>();
  for (const r of items) {
    const cur = recentByOrder.get(r.order_id) ?? { created_at: r.created_at, status: r.status, total: 0 };
    cur.total += r.price * r.quantity;
    recentByOrder.set(r.order_id, cur);
  }
  const recentOrders = Array.from(recentByOrder.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <StoreIcon className="h-4 w-4" /> Vendor dashboard
          </div>
          <h1 className="text-3xl font-bold font-display">{store?.name ?? "Your store"}</h1>
          <p className="text-muted-foreground">{store?.city ?? "Local"} · Rating {store?.rating ?? "—"}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/browse" search={{ q: undefined, cat: undefined }}>
            <Button variant="outline" className="rounded-full">Preview store</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total revenue" value={formatPrice(revenue)} />
        <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Today's orders" value={String(todayOrderIds.size)} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Pending" value={String(pendingOrderIds.size)} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={String(completedOrderIds.size)} />
      </div>

      <SmartRestock products={products as any} items={items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, created_at: i.created_at }))} />

      <div className="grid gap-6 lg:grid-cols-3 mt-6">
        <Card className="lg:col-span-2 p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Recent orders</h2>
            <Badge variant="secondary">{orderIds.size} total</Badge>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet. Once shoppers buy from {store?.name}, they'll show up here.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{new Date(o.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{statusLabel(o.status)}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(o.total)}</TableCell>
                    <TableCell className="text-right">
                      {nextStage(o.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={advance.isPending}
                          onClick={() => advance.mutate({ id: o.id, status: nextStage(o.status)! })}
                        >
                          Mark {statusLabel(nextStage(o.status)!)}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Done</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Top sellers</h2>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          {topSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet. Add products or run a flash sale.</p>
          ) : (
            <ul className="space-y-3">
              {topSellers.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full grid place-items-center text-xs font-bold gradient-hero text-white shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.units} units sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6 rounded-3xl mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">Inventory</h2>
          <Badge variant="secondary">{products.length} products</Badge>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products in your store yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Stock: {p.stock}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-5 rounded-3xl">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon} {label}
      </div>
      <p className="mt-2 text-2xl font-bold font-display">{value}</p>
    </Card>
  );
}
