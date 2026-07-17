import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, stockBadge } from "@/lib/format";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type ProductCardData = {
  id: string;
  name: string;
  price: number | string;
  flash_price: number | string | null;
  is_flash_sale: boolean | null;
  stock: number;
  image_url: string | null;
  stores?: { name: string | null } | null;
};

export function ProductCard({ p, wishlisted }: { p: ProductCardData; wishlisted?: boolean }) {
  const qc = useQueryClient();
  const stock = stockBadge(p.stock);
  const tones: Record<string, string> = {
    success: "bg-success/15 text-success-foreground border border-success/30",
    warning: "bg-warning/20 text-warning-foreground border border-warning/40",
    destructive: "bg-destructive/15 text-destructive border border-destructive/30",
  };

  const toggleWishlist = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to save items");
      if (wishlisted) {
        await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", p.id);
      } else {
        await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: p.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(wishlisted ? "Removed from wishlist" : "Saved to wishlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const price = Number(p.price);
  const flash = p.is_flash_sale && p.flash_price != null ? Number(p.flash_price) : null;

  return (
    <Card className="group relative overflow-hidden rounded-2xl border-border/60 hover-lift p-0">
      <Link to="/product/$id" params={{ id: p.id }} className="block">
        <div className="aspect-square bg-muted overflow-hidden">
          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
      </Link>
      <button
        onClick={() => toggleWishlist.mutate()}
        aria-label="Toggle wishlist"
        className="absolute top-3 right-3 h-9 w-9 rounded-full glass-panel grid place-items-center hover:scale-110 transition"
      >
        <Heart className={`h-4 w-4 ${wishlisted ? "fill-destructive text-destructive" : ""}`} />
      </button>
      {flash && (
        <Badge className="absolute top-3 left-3 gradient-hero text-white border-0 shadow-[var(--shadow-flash)]">
          Flash sale
        </Badge>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to="/product/$id" params={{ id: p.id }}>
              <h3 className="font-semibold truncate">{p.name}</h3>
            </Link>
            {p.stores?.name && (
              <p className="text-xs text-muted-foreground truncate">{p.stores.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            {flash ? (
              <>
                <span className="font-bold text-lg text-primary">{formatPrice(flash)}</span>
                <span className="text-xs text-muted-foreground line-through">{formatPrice(price)}</span>
              </>
            ) : (
              <span className="font-bold text-lg">{formatPrice(price)}</span>
            )}
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tones[stock.tone]}`}>
            {stock.label}
          </span>
        </div>
      </div>
    </Card>
  );
}
