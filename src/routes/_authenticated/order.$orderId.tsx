import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { ArrowLeft, Package } from "lucide-react";
import { toast } from "sonner";
import { OrderTracker, type OrderEvent } from "@/components/order-tracker";
import { statusLabel } from "@/lib/order-status";
import { DeliveryProofView } from "@/components/delivery-proof";

export const Route = createFileRoute("/_authenticated/order/$orderId")({
  head: () => ({
    meta: [
      { title: "Order tracking — HyperLocal Connect" },
      { name: "description", content: "Track your hyperlocal order status, delivery timeline and proof of delivery." },
      { property: "og:title", content: "Order tracking — HyperLocal Connect" },
      { property: "og:description", content: "Live status, timeline and proof of delivery for your order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = useParams({ from: "/_authenticated/order/$orderId" });
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return null;
      const { data } = await supabase
        .from("orders")
        .select(
          "id,total,status,address,city,created_at,estimated_delivery,delivery_proof_path,delivery_note,delivered_at,order_items(id,product_name,product_image,price,quantity)",
        )
        .eq("id", orderId)
        .maybeSingle();
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["order-events", orderId],
    enabled: !!order?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_events")
        .select("id,order_id,status,note,created_at")
        .eq("order_id", order!.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!order?.id) return;
    const channel = supabase
      .channel(`order-detail-${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => {
          const next = payload.new as { status: string };
          const prev = payload.old as { status?: string };
          if (next.status !== prev?.status) toast.success(`Order update: ${statusLabel(next.status)}`);
          qc.invalidateQueries({ queryKey: ["order", orderId] });
          qc.invalidateQueries({ queryKey: ["order-events", orderId] });
          qc.invalidateQueries({ queryKey: ["orders"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_events", filter: `order_id=eq.${order.id}` },
        () => qc.invalidateQueries({ queryKey: ["order-events", orderId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id, orderId, qc]);

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16">Loading…</div>;

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Card className="p-12 text-center rounded-2xl">
          <Package className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-semibold">Order not found</p>
          <Link to="/orders" search={{ placed: undefined, order: undefined }} className="text-primary text-sm underline mt-2 inline-block">
            Back to your orders
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to="/orders"
        search={{ placed: undefined, order: undefined }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <Card className="p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold">Order #{order.id.slice(0, 8)}</h1>
            <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <Badge className="rounded-full bg-success/15 text-success-foreground border-success/30 border">
              {statusLabel(order.status)}
            </Badge>
            <p className="mt-1 font-bold">{formatPrice(order.total)}</p>
          </div>
        </div>

        <OrderTracker
          status={order.status}
          estimatedDelivery={order.estimated_delivery}
          events={events as OrderEvent[]}
        />

        <DeliveryProofView
          path={order.delivery_proof_path}
          note={order.delivery_note}
          deliveredAt={order.delivered_at}
        />

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {order.order_items?.map((it) => (
            <div key={it.id} className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                {it.product_image && (
                  <img src={it.product_image} alt={it.product_name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{it.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  Qty {it.quantity} · {formatPrice(it.price)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Delivering to {order.address}, {order.city}
        </p>
      </Card>
    </div>
  );
}
