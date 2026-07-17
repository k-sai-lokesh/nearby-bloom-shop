import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Zap, ShieldCheck, Timer, ArrowRight, Star } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { data: featured = [] } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,price,flash_price,is_flash_sale,stock,image_url,stores(name)")
        .order("is_flash_sale", { ascending: false })
        .limit(8);
      return (data ?? []) as ProductCardData[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["nearby-stores"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("*").order("distance_km").limit(3);
      return data ?? [];
    },
  });

  return (
    <div>
      {/* HERO */}
      <section className="relative gradient-mesh overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-20 md:pt-24 md:pb-28 grid gap-10 md:grid-cols-2 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Live inventory · Updated seconds ago
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05]">
              Fresh from stores <br /><span className="text-gradient">on your block.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">
              HyperLocal Connect brings your neighborhood's shelves online — in real time.
              See what's in stock, catch flash sales, and get it fast.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/browse" search={{ q: undefined, cat: undefined }}>
                <Button size="lg" className="rounded-full gradient-hero text-white shadow-[var(--shadow-glow)]">
                  Shop nearby <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/browse" search={{ q: undefined, cat: undefined }}>
                <Button size="lg" variant="outline" className="rounded-full">
                  <Zap className="mr-1 h-4 w-4 text-primary" /> View flash sales
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> Verified merchants</div>
              <div className="flex items-center gap-1.5"><Timer className="h-4 w-4 text-secondary" /> Same-day pickup</div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 gradient-hero opacity-20 blur-3xl rounded-full" />
            <div className="relative grid grid-cols-2 gap-3">
              {featured.slice(0, 4).map((p, i) => (
                <Card
                  key={p.id}
                  className={`overflow-hidden rounded-2xl border-glass-border glass-panel p-0 ${i % 2 ? "translate-y-4" : ""}`}
                >
                  <div className="aspect-square bg-muted">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.stores?.name}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Shop by category</h2>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {categories.map((c: { id: string; name: string; slug: string; icon: string | null }) => (
            <Link
              key={c.id}
              to="/browse"
              search={{ q: undefined, cat: c.slug }}
              className="rounded-2xl p-4 text-center hover-lift glass-panel border-glass-border"
            >
              <div className="text-3xl mb-1">{c.icon}</div>
              <div className="text-sm font-semibold">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* NEARBY STORES */}
      <section className="mx-auto max-w-7xl px-4 pb-6">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Stores near you</h2>
          <Link to="/browse" search={{ q: undefined, cat: undefined }} className="text-sm text-primary hover:underline">Browse all</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {stores.map((s) => (
            <Card key={s.id} className="overflow-hidden rounded-2xl border-border/60 hover-lift p-0">
              <div className="aspect-[16/9] bg-muted">
                {s.image_url && <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{s.name}</h3>
                  <div className="flex items-center gap-1 text-xs font-medium">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {s.rating}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {s.distance_km} km away
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Trending near you</h2>
            <p className="text-sm text-muted-foreground">Live picks based on stock and demand.</p>
          </div>
          <Link to="/browse" search={{ q: undefined, cat: undefined }} className="text-sm text-primary hover:underline">See all</Link>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </div>
  );
}
