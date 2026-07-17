import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? "");
      const { data } = await supabase.from("profiles").select("*").maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setAddress(data.address ?? "");
        setCity(data.city ?? "");
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: u.user.id, full_name: fullName, phone, address, city,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Your profile</h1>
      <Card className="p-6 rounded-2xl">
        <form onSubmit={save} className="space-y-4">
          <div><Label>Email</Label><Input value={email} disabled /></div>
          <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <Button type="submit" disabled={loading} className="rounded-full gradient-hero text-white">Save changes</Button>
        </form>
      </Card>
    </div>
  );
}
