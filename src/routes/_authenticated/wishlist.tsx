import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wishlist")({
  component: Wishlist,
});

function Wishlist() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlist_items")
        .select("product_id,products(id,name,price,flash_price,is_flash_sale,stock,image_url,stores(name))");
      return (data ?? [])
        .map((r) => r.products as unknown as ProductCardData)
        .filter(Boolean);
    },
  });

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-16">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Your wishlist</h1>
      {items.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-semibold">No saved items yet</p>
          <Link to="/browse" search={{ q: undefined, cat: undefined }}>
            <Button className="mt-4 rounded-full" variant="outline">Discover products</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} p={p} wishlisted />)}
        </div>
      )}
    </div>
  );
}
