// Client-side cart cache helpers wrapping React Query keys.
export const cartKeys = {
  all: ["cart"] as const,
  count: ["cart", "count"] as const,
  wishlist: ["wishlist"] as const,
};
