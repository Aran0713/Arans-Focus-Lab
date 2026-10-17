import { redirect } from "next/navigation";
import { GuestHome } from "@/components/guest-home";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/home");
  }
  return <GuestHome />;
}
