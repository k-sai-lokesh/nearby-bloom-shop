export const ORDER_STAGES = [
  { key: "confirmed", label: "Confirmed", hint: "Order received by the store" },
  { key: "packed", label: "Packed", hint: "Items packed and ready" },
  { key: "out_for_delivery", label: "Out for delivery", hint: "Rider is on the way" },
  { key: "delivered", label: "Delivered", hint: "Handed over to you" },
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number]["key"];

export const stageIndex = (status: string) => {
  const i = ORDER_STAGES.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
};

export const nextStage = (status: string): OrderStage | null => {
  if (status === "cancelled") return null;
  const i = stageIndex(status);
  return i >= ORDER_STAGES.length - 1 ? null : ORDER_STAGES[i + 1]!.key;
};

export const statusLabel = (status: string) =>
  status === "cancelled"
    ? "Cancelled"
    : (ORDER_STAGES.find((s) => s.key === status)?.label ?? status.replace(/_/g, " "));

export const etaText = (eta: string | null | undefined, status: string) => {
  if (status === "delivered") return "Delivered";
  if (status === "cancelled") return "Cancelled";
  if (!eta) return "Arriving soon";
  const mins = Math.round((+new Date(eta) - Date.now()) / 60000);
  if (mins <= 0) return "Arriving any moment";
  if (mins < 60) return `Arriving in ~${mins} min`;
  return `Arriving by ${new Date(eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};
