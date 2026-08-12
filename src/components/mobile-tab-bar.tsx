import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home, Search, ShoppingBag, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { tapFeedback } from "@/lib/native";

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: cartCount = 0 } = useQuery({
    queryKey: ["cart-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase.from("cart_items").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const itemClass = (active: boolean) =>
    cn(
      "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground",
    );

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-50 glass-panel border-t border-glass-border pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch">
        <Link to="/" onClick={() => tapFeedback()} className={itemClass(isActive("/"))}>
          <Home className="h-5 w-5" />
          Home
        </Link>

        <Link
          to="/browse"
          search={{ q: undefined, cat: undefined }}
          onClick={() => tapFeedback()}
          className={itemClass(isActive("/browse"))}
        >
          <Search className="h-5 w-5" />
          Browse
        </Link>

        <Link to="/cart" onClick={() => tapFeedback()} className={itemClass(isActive("/cart"))}>
          <span className="relative">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full gradient-hero text-white text-[9px] font-bold grid place-items-center">
                {cartCount}
              </span>
            )}
          </span>
          Cart
        </Link>

        <Link to="/orders" onClick={() => tapFeedback()} className={itemClass(isActive("/orders"))}>
          <Package className="h-5 w-5" />
          Orders
        </Link>

        <Link
          to={userId ? "/profile" : "/auth"}
          search={userId ? undefined : { redirect: undefined }}
          onClick={() => tapFeedback()}
          className={itemClass(isActive("/profile") || isActive("/auth"))}
        >
          <User className="h-5 w-5" />
          {userId ? "Profile" : "Sign in"}
        </Link>
      </div>
    </nav>
  );
}
