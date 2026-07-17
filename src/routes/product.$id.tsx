import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, stockBadge } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, MapPin, ShoppingBag, Heart, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProductCard, type ProductCardData } from "@/components/product-card";

export const Route = createFileRoute("/product/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, stores(id,name,address,city,distance_km,rating), categories(id,name,slug)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at,user_id")
        .eq("product_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: related = [] } = useQuery({
    queryKey: ["related", product?.category_id],
    enabled: !!product?.category_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,price,flash_price,is_flash_sale,stock,image_url,stores(name)")
        .eq("category_id", product!.category_id!)
        .neq("id", id)
        .limit(4);
      return (data ?? []) as ProductCardData[];
    },
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/auth", search: { redirect: `/product/${id}` } }); throw new Error("Please sign in"); }
      const { data: existing } = await supabase.from("cart_items").select("id,quantity").eq("user_id", user.id).eq("product_id", id).maybeSingle();
      if (existing) {
        await supabase.from("cart_items").update({ quantity: existing.quantity + qty }).eq("id", existing.id);
      } else {
        await supabase.from("cart_items").insert({ user_id: user.id, product_id: id, quantity: qty });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    },
    onError: (e: Error) => { if (e.message !== "Please sign in") toast.error(e.message); },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!userId) { navigate({ to: "/auth", search: { redirect: `/product/${id}` } }); throw new Error(); }
      const { error } = await supabase.from("reviews").upsert({
        product_id: id, user_id: userId, rating, comment: comment || null,
      }, { onConflict: "product_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", id] });
      setComment("");
      toast.success("Review posted");
    },
    onError: (e: Error) => { if (e.message) toast.error(e.message); },
  });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-16 text-center">Loading…</div>;
  if (!product) return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <p className="text-lg font-semibold">Product not found</p>
      <Link to="/browse" search={{ q: undefined, cat: undefined }}><Button className="mt-4">Browse products</Button></Link>
    </div>
  );

  const stock = stockBadge(product.stock);
  const tones: Record<string, string> = {
    success: "bg-success/15 text-success-foreground border border-success/30",
    warning: "bg-warning/20 text-warning-foreground border border-warning/40",
    destructive: "bg-destructive/15 text-destructive border border-destructive/30",
  };
  const price = Number(product.price);
  const flash = product.is_flash_sale && product.flash_price != null ? Number(product.flash_price) : null;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="glass-panel rounded-3xl overflow-hidden aspect-square">
          {product.image_url && <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />}
        </div>
        <div className="space-y-5">
          {product.categories?.name && <Badge variant="outline" className="rounded-full">{product.categories.name}</Badge>}
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">{product.name}</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-medium">{avg ? avg.toFixed(1) : "New"}</span>
              <span className="text-muted-foreground">({reviews.length})</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tones[stock.tone]}`}>{stock.label}</span>
          </div>
          <div className="flex items-baseline gap-3">
            {flash ? (
              <>
                <span className="text-4xl font-bold text-gradient">{formatPrice(flash)}</span>
                <span className="text-lg text-muted-foreground line-through">{formatPrice(price)}</span>
                <Badge className="gradient-hero text-white border-0">Flash sale</Badge>
              </>
            ) : (
              <span className="text-4xl font-bold">{formatPrice(price)}</span>
            )}
          </div>
          <p className="text-muted-foreground">{product.description}</p>

          {product.stores && (
            <Card className="p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="font-semibold">{product.stores.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {product.stores.distance_km} km · {product.stores.city}
                </p>
              </div>
              <div className="text-sm flex items-center gap-1">
                <Star className="h-4 w-4 fill-warning text-warning" /> {product.stores.rating}
              </div>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-border">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
              <span className="w-8 text-center font-medium">{qty}</span>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setQty((q) => Math.min(product.stock, q + 1))}><Plus className="h-4 w-4" /></Button>
            </div>
            <Button
              disabled={product.stock <= 0 || addToCart.isPending}
              onClick={() => addToCart.mutate()}
              size="lg"
              className="rounded-full gradient-hero text-white shadow-[var(--shadow-glow)] flex-1"
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              {product.stock <= 0 ? "Out of stock" : "Add to cart"}
            </Button>
            <Link to="/wishlist"><Button variant="outline" size="icon" className="rounded-full"><Heart className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </div>

      {/* REVIEWS */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold mb-4">Reviews</h2>
        <Card className="p-5 rounded-2xl mb-6">
          <p className="text-sm font-semibold mb-2">Rate this product</p>
          <div className="flex gap-1 mb-3">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star className={`h-6 w-6 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your thoughts…" className="mb-3" />
          <Button onClick={() => submitReview.mutate()} disabled={submitReview.isPending} className="rounded-full">Post review</Button>
        </Card>
        <div className="space-y-3">
          {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet — be the first.</p>}
          {reviews.map((r) => (
            <Card key={r.id} className="p-4 rounded-2xl">
              <div className="flex items-center gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {r.comment && <p className="text-sm">{r.comment}</p>}
            </Card>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-4">You might also like</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
