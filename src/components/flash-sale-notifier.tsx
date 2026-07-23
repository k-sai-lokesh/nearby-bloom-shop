import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Flame, X } from "lucide-react";
import { formatPrice, stockBadge } from "@/lib/format";

type LiveSale = {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  flash_price: number | null;
  stock: number;
  ends_at: number; // epoch ms
};

function useCountdown(endsAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, endsAt - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { ms, label: `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s` };
}

export function FlashSaleNotifier() {
  const [live, setLive] = useState<LiveSale[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Load already-live flash sales on mount
  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, image_url, price, flash_price, stock, flash_sale_ends_at")
      .eq("is_flash_sale", true)
      .then(({ data }) => {
        if (!data) return;
        const now = Date.now();
        const active: LiveSale[] = data
          .filter((p) => p.flash_sale_ends_at && +new Date(p.flash_sale_ends_at) > now)
          .map((p) => ({
            id: p.id,
            name: p.name,
            image_url: p.image_url,
            price: Number(p.price),
            flash_price: p.flash_price !== null ? Number(p.flash_price) : null,
            stock: Number(p.stock ?? 0),
            ends_at: +new Date(p.flash_sale_ends_at as string),
          }));
        setLive(active);
      });
  }, []);

  // Subscribe to realtime product updates
  useEffect(() => {
    const channel = supabase
      .channel("flash-sales")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          const p = payload.new as {
            id: string;
            name: string;
            image_url: string | null;
            price: number | string;
            flash_price: number | string | null;
            is_flash_sale: boolean | null;
            flash_sale_ends_at: string | null;
          };
          const prev = payload.old as { is_flash_sale: boolean | null } | null;
          const wasOn = !!prev?.is_flash_sale;
          const isOn = !!p.is_flash_sale && !!p.flash_sale_ends_at;

          if (isOn && !wasOn) {
            const sale: LiveSale = {
              id: p.id,
              name: p.name,
              image_url: p.image_url,
              price: Number(p.price),
              flash_price: p.flash_price !== null ? Number(p.flash_price) : null,
              ends_at: +new Date(p.flash_sale_ends_at as string),
            };
            setLive((cur) => (cur.some((s) => s.id === sale.id) ? cur : [sale, ...cur]));
            toast(
              `🔥 Flash sale nearby: ${p.name}`,
              {
                description: sale.flash_price
                  ? `Now ${formatPrice(sale.flash_price)} — limited time!`
                  : "Limited time only",
                duration: 8000,
              },
            );
          } else if (!isOn && wasOn) {
            setLive((cur) => cur.filter((s) => s.id !== p.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = live.filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-96">
      {visible.slice(0, 3).map((sale) => (
        <FlashSaleCard
          key={sale.id}
          sale={sale}
          onDismiss={() => setDismissed((s) => new Set(s).add(sale.id))}
          onExpire={() => setLive((cur) => cur.filter((x) => x.id !== sale.id))}
        />
      ))}
    </div>
  );
}

function FlashSaleCard({
  sale,
  onDismiss,
  onExpire,
}: {
  sale: LiveSale;
  onDismiss: () => void;
  onExpire: () => void;
}) {
  const { ms, label } = useCountdown(sale.ends_at);
  useEffect(() => {
    if (ms === 0) onExpire();
  }, [ms, onExpire]);

  if (ms === 0) return null;

  return (
    <div className="glass-panel rounded-2xl p-3 border border-primary/30 shadow-[var(--shadow-glow)] animate-in slide-in-from-bottom-4 fade-in">
      <div className="flex items-start gap-3">
        {sale.image_url ? (
          <img src={sale.image_url} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-muted shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Flame className="h-3.5 w-3.5" /> Flash sale nearby
          </div>
          <p className="font-semibold text-sm truncate mt-0.5">{sale.name}</p>
          <div className="flex items-center gap-2 mt-1">
            {sale.flash_price !== null && (
              <>
                <span className="text-sm font-bold text-primary">{formatPrice(sale.flash_price)}</span>
                <span className="text-xs text-muted-foreground line-through">{formatPrice(sale.price)}</span>
              </>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-xs font-mono tabular-nums text-foreground/80">Ends in {label}</span>
            <Link
              to="/product/$id"
              params={{ id: sale.id }}
              className="text-xs font-medium rounded-full px-3 py-1 gradient-hero text-white"
            >
              Grab now
            </Link>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
