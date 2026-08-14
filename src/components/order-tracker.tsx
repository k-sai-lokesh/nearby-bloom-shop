import { useEffect, useState } from "react";
import { Check, Loader2, Package, Truck, Home, ClipboardCheck, Wifi, WifiOff } from "lucide-react";
import { ORDER_STAGES, stageIndex, etaText, statusLabel } from "@/lib/order-status";

const ICONS = [ClipboardCheck, Package, Truck, Home];

export type OrderEvent = { id: string; status: string; note: string | null; created_at: string };

export function OrderTracker({
  status,
  estimatedDelivery,
  events = [],
  live,
}: {
  status: string;
  estimatedDelivery?: string | null;
  events?: OrderEvent[];
  live?: boolean;
}) {
  const cancelled = status === "cancelled";
  const active = stageIndex(status);

  // Keep the ETA copy ticking without waiting for a server event.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (cancelled || status === "delivered") return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [cancelled, status]);


  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm font-semibold flex items-center gap-2">
          {status === "delivered" || cancelled ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          Delivery tracking
        </p>
        <span className="text-xs text-muted-foreground">{etaText(estimatedDelivery, status)}</span>
      </div>

      {cancelled ? (
        <p className="text-sm text-destructive">This order was cancelled.</p>
      ) : (
        <ol className="flex items-start justify-between gap-1">
          {ORDER_STAGES.map((s, i) => {
            const Icon = ICONS[i]!;
            const done = i <= active;
            return (
              <li key={s.key} className="flex-1 flex flex-col items-center text-center relative">
                {i > 0 && (
                  <span
                    aria-hidden
                    className={`absolute top-4 right-1/2 left-[-50%] h-0.5 ${i <= active ? "bg-primary" : "bg-border"}`}
                  />
                )}
                <div
                  className={`relative z-10 h-8 w-8 rounded-full grid place-items-center border ${
                    done ? "gradient-hero text-white border-transparent" : "bg-background text-muted-foreground border-border"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className={`mt-2 text-[11px] leading-tight ${done ? "font-medium" : "text-muted-foreground"}`}>
                  {s.label}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {events.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border pt-3">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>{e.note ?? e.status}</span>
              <span className="shrink-0">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
