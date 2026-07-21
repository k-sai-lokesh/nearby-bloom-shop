export const formatPrice = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
};

export const stockBadge = (stock: number) => {
  if (stock <= 0) return { label: "Out of stock", tone: "destructive" as const };
  if (stock < 5) return { label: `Only ${stock} left`, tone: "destructive" as const };
  if (stock < 10) return { label: `Low stock · ${stock}`, tone: "warning" as const };
  return { label: "In stock", tone: "success" as const };
};
