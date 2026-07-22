import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { Sparkles, AlertTriangle, Flame, PackagePlus, TrendingDown } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  stock: number;
  price: number | string;
  flash_price: number | string | null;
  is_flash_sale: boolean | null;
};

type SaleRow = { product_id: string; quantity: number; created_at: string };

export type SmartRestockProps = {
  products: Product[];
  items: SaleRow[]; // all-time order_items for this vendor's products
};

type Suggestion = {
  product: Product;
  units24h: number;
  velocityPerDay: number; // units/day (based on 24h window)
  daysLeft: number | null; // null if no velocity
  restockQty: number; // suggested units to add (target ~7 days cover)
  kind: "critical" | "low" | "flash" | "healthy";
  reason: string;
};

const TARGET_COVER_DAYS = 7;

function buildSuggestions(products: Product[], items: SaleRow[]): Suggestion[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const sold24 = new Map<string, number>();
  for (const it of items) {
    if (+new Date(it.created_at) >= cutoff) {
      sold24.set(it.product_id, (sold24.get(it.product_id) ?? 0) + it.quantity);
    }
  }
  return products.map((p) => {
    const units24h = sold24.get(p.id) ?? 0;
    const velocity = units24h; // per day (24h window)
    const daysLeft = velocity > 0 ? p.stock / velocity : null;
    const targetStock = Math.ceil(velocity * TARGET_COVER_DAYS);
    const restockQty = Math.max(0, targetStock - p.stock);

    let kind: Suggestion["kind"] = "healthy";
    let reason = "Stock is healthy.";
    if (p.stock <= 0) {
      kind = "critical";
      reason = "Out of stock — restock immediately.";
    } else if (p.stock < 5 || (daysLeft !== null && daysLeft < 1)) {
      kind = "critical";
      reason = daysLeft !== null
        ? `Selling ~${velocity}/day. Will sell out in <1 day.`
        : `Only ${p.stock} left.`;
    } else if (p.stock < 10 || (daysLeft !== null && daysLeft < 3)) {
      kind = "low";
      reason = daysLeft !== null
        ? `Selling ~${velocity}/day. ~${daysLeft.toFixed(1)} days of cover left.`
        : `Low stock (${p.stock}).`;
    } else if (units24h === 0 && p.stock >= 10 && !p.is_flash_sale) {
      kind = "flash";
      reason = `No sales in 24h with ${p.stock} in stock — try a flash sale to move inventory.`;
    }

    return { product: p, units24h, velocityPerDay: velocity, daysLeft, restockQty, kind, reason };
  });
}

export function SmartRestock({ products, items }: SmartRestockProps) {
  const qc = useQueryClient();
  const suggestions = useMemo(() => buildSuggestions(products, items), [products, items]);

  const actionable = suggestions.filter((s) => s.kind !== "healthy");
  const criticalCount = suggestions.filter((s) => s.kind === "critical").length;
  const lowCount = suggestions.filter((s) => s.kind === "low").length;
  const flashCount = suggestions.filter((s) => s.kind === "flash").length;

  const restock = useMutation({
    mutationFn: async (vars: { id: string; addQty: number; currentStock: number }) => {
      const { error } = await supabase
        .from("products")
        .update({ stock: vars.currentStock + vars.addQty })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-stats"] });
      toast.success("Stock updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const flash = useMutation({
    mutationFn: async ({ id, enable, price }: { id: string; enable: boolean; price: number }) => {
      const endsAt = enable ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null;
      const { error } = await supabase
        .from("products")
        .update({
          is_flash_sale: enable,
          flash_price: enable ? Math.round(price * 0.8) : null,
          flash_sale_ends_at: endsAt,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["vendor-stats"] });
      toast.success(v.enable ? "Flash sale live · 20% off · ends in 2h" : "Flash sale ended");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 rounded-3xl mt-6 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl grid place-items-center gradient-hero text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg leading-tight">Smart Restock & Flash Sale</h2>
            <p className="text-xs text-muted-foreground">Predictions from the last 24 hours of sales</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/5 rounded-full">
            <AlertTriangle className="h-3 w-3 mr-1" /> {criticalCount} critical
          </Badge>
          <Badge variant="outline" className="border-warning/40 text-warning bg-warning/5 rounded-full">
            <TrendingDown className="h-3 w-3 mr-1" /> {lowCount} low
          </Badge>
          <Badge variant="outline" className="border-accent/40 text-accent bg-accent/5 rounded-full">
            <Flame className="h-3 w-3 mr-1" /> {flashCount} flash
          </Badge>
        </div>
      </div>

      {actionable.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Everything looks healthy — no restock or flash-sale suggestions right now.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {actionable.map((s) => (
            <SuggestionRow
              key={s.product.id}
              s={s}
              onRestock={(qty) =>
                restock.mutate({ id: s.product.id, addQty: qty, currentStock: s.product.stock })
              }
              onFlashOn={() =>
                flash.mutate({ id: s.product.id, enable: true, price: Number(s.product.price) })
              }
              onFlashOff={() =>
                flash.mutate({ id: s.product.id, enable: false, price: Number(s.product.price) })
              }
              busy={restock.isPending || flash.isPending}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function SuggestionRow({
  s,
  onRestock,
  onFlashOn,
  onFlashOff,
  busy,
}: {
  s: Suggestion;
  onRestock: (qty: number) => void;
  onFlashOn: () => void;
  onFlashOff: () => void;
  busy: boolean;
}) {
  const [qty, setQty] = useState<number>(Math.max(s.restockQty, s.kind === "critical" ? 10 : 5));
  const tone =
    s.kind === "critical"
      ? "border-destructive/40 bg-destructive/5"
      : s.kind === "low"
        ? "border-warning/40 bg-warning/5"
        : "border-accent/40 bg-accent/5";
  const badge =
    s.kind === "critical" ? (
      <Badge className="rounded-full bg-destructive/15 text-destructive border border-destructive/30">Critical</Badge>
    ) : s.kind === "low" ? (
      <Badge className="rounded-full bg-warning/15 text-warning-foreground border border-warning/30">Low stock</Badge>
    ) : (
      <Badge className="rounded-full bg-accent/15 text-accent-foreground border border-accent/30">Flash sale</Badge>
    );

  return (
    <div className={`rounded-2xl border ${tone} p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {s.product.image_url ? (
          <img src={s.product.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-muted" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{s.product.name}</p>
            {badge}
            {s.product.is_flash_sale && (
              <Badge variant="outline" className="rounded-full text-xs">
                <Flame className="h-3 w-3 mr-1" /> On sale
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Stock {s.product.stock} · 24h sold {s.units24h}
            {s.daysLeft !== null && ` · ~${s.daysLeft.toFixed(1)}d cover`}
            {" · "}Price {formatPrice(s.product.price)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {s.kind === "flash" ? (
          <>
            <span className="text-xs text-muted-foreground">
              Suggested: <span className="font-semibold text-foreground">{formatPrice(Number(s.product.price) * 0.8)}</span> (20% off)
            </span>
            <Button size="sm" className="rounded-full gradient-hero text-white" disabled={busy} onClick={onFlashOn}>
              <Flame className="h-3.5 w-3.5 mr-1" /> Start flash sale
            </Button>
          </>
        ) : (
          <>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 0))}
              className="h-9 w-20 rounded-full text-center"
            />
            <Button
              size="sm"
              className="rounded-full gradient-hero text-white"
              disabled={busy || qty <= 0}
              onClick={() => onRestock(qty)}
            >
              <PackagePlus className="h-3.5 w-3.5 mr-1" /> Add stock
            </Button>
            {s.product.is_flash_sale && (
              <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={onFlashOff}>
                End sale
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
