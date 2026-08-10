import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "delivery-proofs";

/** Vendor-facing: capture a proof photo + optional note, then mark the order delivered. */
export function DeliveryProofDialog({
  orderId,
  onDelivered,
}: {
  orderId: string;
  onDelivered?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please add a proof photo.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Photo must be under 8 MB.");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${orderId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const { error } = await supabase
        .from("orders")
        .update({
          status: "delivered",
          delivery_proof_path: path,
          delivery_note: note.trim() || null,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivered — proof uploaded");
      setOpen(false);
      pick(null);
      setNote("");
      onDelivered?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">
          <Camera className="h-3.5 w-3.5" /> Mark Delivered
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Proof of delivery</DialogTitle>
          <DialogDescription>
            Add a photo of the handover for order #{orderId.slice(0, 8)}. A short note is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor={`proof-${orderId}`}>Proof photo</Label>
            <input
              id={`proof-${orderId}`}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground file:text-sm"
            />
          </div>

          {preview && (
            <img src={preview} alt="Delivery proof preview" className="w-full rounded-2xl border border-border object-cover max-h-56" />
          )}

          <div>
            <Label htmlFor={`note-${orderId}`}>Note (optional)</Label>
            <Textarea
              id={`note-${orderId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="Handed to the customer at the door"
              className="mt-1.5 rounded-2xl"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full"
            disabled={!file || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Customer/vendor-facing: renders the stored proof photo via a signed URL. */
export function DeliveryProofView({
  path,
  note,
  deliveredAt,
}: {
  path?: string | null;
  note?: string | null;
  deliveredAt?: string | null;
}) {
  const { data: url } = useQuery({
    queryKey: ["delivery-proof", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      return data?.signedUrl ?? null;
    },
  });

  if (!path && !note) return null;

  return (
    <div className="mt-3 rounded-2xl border border-success/30 bg-success/5 p-3">
      <p className="text-xs font-semibold flex items-center gap-2 mb-2">
        <ImageIcon className="h-3.5 w-3.5 text-success" /> Proof of delivery
        {deliveredAt && (
          <span className="font-normal text-muted-foreground">· {new Date(deliveredAt).toLocaleString()}</span>
        )}
      </p>
      {url && (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Proof of delivery photo" loading="lazy" className="max-h-48 rounded-xl border border-border object-cover" />
        </a>
      )}
      {note && <p className="mt-2 text-xs text-muted-foreground">“{note}”</p>}
    </div>
  );
}

export function useInvalidateOrders() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["vendor-stats"] });
  };
}
