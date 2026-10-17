import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StartGate } from "@/components/start-gate";

export default async function StartPage() {
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/focus?trial=1");
  }
  return <StartGate />;
}
