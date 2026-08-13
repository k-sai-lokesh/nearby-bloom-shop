import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { Package, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { OrderTracker, type OrderEvent } from "@/components/order-tracker";
import { statusLabel } from "@/lib/order-status";
import { DeliveryProofView } from "@/components/delivery-proof";


export const Route = createFileRoute("/_authenticated/orders")({
  validateSearch: z.object({ placed: z.string().optional(), order: z.string().optional() }),
  component: Orders,
});

function Orders() {
  const { placed, order: focusedOrder } = Route.useSearch();
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id,total,status,address,city,created_at,estimated_delivery,delivery_proof_path,delivery_note,delivered_at,order_items(id,product_name,product_image,price,quantity)",
        )
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["order-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_events")
        .select("id,order_id,status,note,created_at")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // Live order status updates
  useEffect(() => {
    const channel = supabase
      .channel("order-tracking")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const next = payload.new as { status: string };
        const prev = payload.old as { status?: string };
        if (next.status !== prev?.status) {
          toast.success(`Order update: ${statusLabel(next.status)}`);
        }
        qc.invalidateQueries({ queryKey: ["orders"] });
        qc.invalidateQueries({ queryKey: ["order-events"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_events" }, () => {
        qc.invalidateQueries({ queryKey: ["order-events"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Deep link: scroll the targeted order into view once loaded
  useEffect(() => {
    if (!focusedOrder || isLoading) return;
    const el = document.getElementById(`order-${focusedOrder}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedOrder, isLoading]);

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-16">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {placed && (
        <Card className="p-5 rounded-2xl mb-6 border-success/40 bg-success/10 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <div>
            <p className="font-semibold">Order confirmed</p>
            <p className="text-xs text-muted-foreground">Your local merchants are preparing your items.</p>
          </div>
        </Card>
      )}

      <h1 className="text-3xl font-bold mb-6">Your orders</h1>

      {orders.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl">
          <Package className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-semibold">No orders yet</p>
          <Link to="/browse" search={{ q: undefined, cat: undefined }} className="text-primary text-sm underline mt-2 inline-block">Start shopping</Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card
              key={o.id}
              id={`order-${o.id}`}
              className={`p-5 rounded-2xl scroll-mt-24 ${
                focusedOrder && (o.id === focusedOrder || o.id.startsWith(focusedOrder))
                  ? "border-primary/50 shadow-[var(--shadow-glow)]"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold">Order #{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <Badge className="rounded-full bg-success/15 text-success-foreground border-success/30 border">{statusLabel(o.status)}</Badge>
                  <p className="mt-1 font-bold">{formatPrice(o.total)}</p>
                </div>
              </div>

              <div className="mb-4">
                <OrderTracker
                  status={o.status}
                  estimatedDelivery={o.estimated_delivery}
                  events={events.filter((e) => e.order_id === o.id) as OrderEvent[]}
                />
                <DeliveryProofView
                  path={o.delivery_proof_path}
                  note={o.delivery_note}
                  deliveredAt={o.delivered_at}
                />
              </div>


              <div className="grid gap-2 sm:grid-cols-2">
                {o.order_items?.map((it) => (
                  <div key={it.id} className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                      {it.product_image && <img src={it.product_image} alt={it.product_name} className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty {it.quantity} · {formatPrice(it.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Delivering to {o.address}, {o.city}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
