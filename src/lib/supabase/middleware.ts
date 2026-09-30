import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoots = ["/home", "/focus", "/stats", "/settings"];

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isProtected = protectedRoots.some((root) => path === root || path.startsWith(`${root}/`));
  if (!user && isProtected) {
    const login = request.nextUrl.clone(); login.pathname = "/login"; login.searchParams.set("next", path); return NextResponse.redirect(login);
  }
  if (user && path === "/login") {
    const next = request.nextUrl.searchParams.get("next") || "/home"; return NextResponse.redirect(new URL(next, request.url));
  }
  return response;
}
