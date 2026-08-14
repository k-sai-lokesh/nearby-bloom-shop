import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { statusLabel } from "@/lib/order-status";

type OrderRow = {
  id: string;
  status: string;
  delivery_proof_path: string | null;
};

const STAGE_COPY: Record<string, string> = {
  confirmed: "Your order is confirmed and being prepared.",
  packed: "Your items are packed and ready to go.",
  out_for_delivery: "Your rider is on the way.",
  delivered: "Your order has been delivered. Enjoy!",
  cancelled: "Your order was cancelled.",
};

/**
 * App-wide listener: toasts whenever one of the signed-in user's orders
 * advances a stage or a proof-of-delivery photo becomes available.
 * Realtime RLS scopes the stream to the user's own orders.
 */
export function OrderNotifier() {
  const qc = useQueryClient();
  const router = useRouter();
  const seen = useRef(new Map<string, { status: string; proof: boolean }>());

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const open = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;

      channel = supabase
        .channel("order-notifications")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${data.user.id}` },
          (payload) => {
            const next = payload.new as OrderRow;
            const prev = (payload.old ?? {}) as Partial<OrderRow>;
            const last = seen.current.get(next.id);
            const prevStatus = last?.status ?? prev.status;
            const hadProof = last?.proof ?? !!prev.delivery_proof_path;
            const hasProof = !!next.delivery_proof_path;

            const openOrder = {
              label: "View",
              onClick: () => router.navigate({ to: "/order/$orderId", params: { orderId: next.id } }),
            };
            const short = `#${next.id.slice(0, 8)}`;

            if (prevStatus !== undefined && prevStatus !== next.status) {
              const message = `Order ${short}: ${statusLabel(next.status)}`;
              const description = STAGE_COPY[next.status];
              if (next.status === "cancelled") toast.error(message, { description, action: openOrder });
              else toast.success(message, { description, action: openOrder });
            }

            if (hasProof && !hadProof) {
              toast.success(`Proof of delivery added for ${short}`, {
                description: "Tap to see the delivery photo and note.",
                action: openOrder,
              });
            }

            seen.current.set(next.id, { status: next.status, proof: hasProof });
            qc.invalidateQueries({ queryKey: ["orders"] });
            qc.invalidateQueries({ queryKey: ["order", next.id] });
            qc.invalidateQueries({ queryKey: ["order-events"] });
            qc.invalidateQueries({ queryKey: ["order-events", next.id] });
          },
        )
        .subscribe();
    };

    open();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        seen.current.clear();
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        if (event === "SIGNED_IN") open();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc, router]);

  return null;
}
