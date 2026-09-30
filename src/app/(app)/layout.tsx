import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LabProvider } from "@/components/lab-provider";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return <LabProvider><AppShell>{children}</AppShell></LabProvider>;
}
