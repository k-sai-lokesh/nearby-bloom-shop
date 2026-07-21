import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, ShoppingBag, Search, MapPin, User, LogOut, Package, LayoutDashboard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: cartCount = 0 } = useQuery({
    queryKey: ["cart-count", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { count } = await supabase
        .from("cart_items")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: isVendor = false } = useQuery({
    queryKey: ["is-vendor", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session!.user.id)
        .eq("role", "vendor")
        .maybeSingle();
      return !!data;
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/browse", search: { q: q || undefined, cat: undefined } });
  }

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-glass-border">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-9 rounded-xl gradient-hero grid place-items-center text-white font-bold">H</div>
          <span className="font-display font-bold text-lg hidden sm:inline">HyperLocal</span>
        </Link>

        <form onSubmit={onSubmit} className="flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search local goods, bakery, produce…"
            className="pl-9 h-10 rounded-full bg-background/70 border-border"
          />
        </form>

        <nav className="flex items-center gap-1">
          <Link to="/browse" search={{ q: undefined, cat: undefined }} className="hidden md:inline-flex">
            <Button variant="ghost" size="sm" className="gap-2">
              <MapPin className="h-4 w-4" /> Nearby
            </Button>
          </Link>
          {session ? (
            <>
              <Link to="/wishlist">
                <Button variant="ghost" size="icon" aria-label="Wishlist"><Heart className="h-5 w-5" /></Button>
              </Link>
              <Link to="/cart" className="relative">
                <Button variant="ghost" size="icon" aria-label="Cart">
                  <ShoppingBag className="h-5 w-5" />
                </Button>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full gradient-hero text-white text-[10px] font-bold grid place-items-center">
                    {cartCount}
                  </span>
                )}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account"><User className="h-5 w-5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{session.user.email}</div>
                  <DropdownMenuSeparator />
                  {isVendor && (
                    <DropdownMenuItem asChild>
                      <Link to="/vendor"><LayoutDashboard className="mr-2 h-4 w-4" />Vendor dashboard</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild><Link to="/orders"><Package className="mr-2 h-4 w-4" />My orders</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/wishlist"><Heart className="mr-2 h-4 w-4" />Wishlist</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/profile"><User className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/auth" search={{ redirect: undefined }}>
              <Button size="sm" className="rounded-full gradient-hero text-white shadow-[var(--shadow-glow)]">
                Sign in
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-6 md:grid-cols-3 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-hero" />
            <span className="font-display font-bold">HyperLocal Connect</span>
          </div>
          <p className="mt-2 text-muted-foreground max-w-xs">
            Real-time hyperlocal commerce. Fresh from stores in your neighborhood.
          </p>
        </div>
        <div>
          <p className="font-semibold mb-2">Shop</p>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link to="/browse" search={{ q: undefined, cat: undefined }}>All products</Link></li>
            <li><Link to="/browse" search={{ q: undefined, cat: "bakery" }}>Bakery</Link></li>
            <li><Link to="/browse" search={{ q: undefined, cat: "groceries" }}>Groceries</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-2">Account</p>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link to="/orders">Orders</Link></li>
            <li><Link to="/wishlist">Wishlist</Link></li>
            <li><Link to="/profile">Profile</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} HyperLocal Connect
      </div>
    </footer>
  );
}
