import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Search, SlidersHorizontal } from "lucide-react";

const searchSchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional(),
});

export const Route = createFileRoute("/browse")({
  validateSearch: searchSchema,
  component: Browse,
});

function Browse() {
  const { q, cat } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [text, setText] = useState(q ?? "");
  const [maxPrice, setMaxPrice] = useState<number>(50);
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => setText(q ?? ""), [q]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["browse", { q, cat, maxPrice, inStockOnly }],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id,name,price,flash_price,is_flash_sale,stock,image_url,category_id,stores(name),categories!inner(slug)")
        .lte("price", maxPrice);
      if (inStockOnly) query = query.gt("stock", 0);
      if (q && q.trim()) query = query.ilike("name", `%${q.trim()}%`);
      if (cat) query = query.eq("categories.slug", cat);
      const { data } = await query.limit(60);
      return (data ?? []) as unknown as ProductCardData[];
    },
  });

  const activeCat = categories.find((c: { slug: string; name: string }) => c.slug === cat);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {activeCat ? activeCat.name : q ? `Results for "${q}"` : "Browse everything"}
        </h1>
        <p className="text-sm text-muted-foreground">Live inventory from stores nearby.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="space-y-4">
          <Card className="p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="h-4 w-4" /> <span className="font-semibold text-sm">Filters</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ search: (prev) => ({ ...prev, q: text || undefined }) });
              }}
              className="relative mb-4"
            >
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search…" className="pl-8 h-9" />
            </form>

            <div className="mb-4">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Category</div>
              <div className="space-y-1">
                <button
                  onClick={() => navigate({ search: (p) => ({ ...p, cat: undefined }) })}
                  className={`w-full text-left text-sm px-2 py-1 rounded-md ${!cat ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                >All</button>
                {categories.map((c: { id: string; name: string; slug: string; icon: string | null }) => (
                  <button
                    key={c.id}
                    onClick={() => navigate({ search: (p) => ({ ...p, cat: c.slug }) })}
                    className={`w-full text-left text-sm px-2 py-1 rounded-md flex items-center gap-2 ${cat === c.slug ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                  >
                    <span>{c.icon}</span> {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground mb-2">
                <span>Max price</span><span>${maxPrice}</span>
              </div>
              <Slider value={[maxPrice]} min={1} max={50} step={1} onValueChange={(v) => setMaxPrice(v[0])} />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(!!v)} />
              In stock only
            </label>
          </Card>
        </aside>

        <div>
          {isLoading ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card className="p-12 text-center rounded-2xl">
              <p className="font-semibold">No products match your filters.</p>
              <p className="text-sm text-muted-foreground mt-1">Try widening your price range or clearing the category.</p>
              <Link to="/browse" search={{ q: undefined, cat: undefined }}>
                <Button className="mt-4 rounded-full" variant="outline">Clear filters</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
