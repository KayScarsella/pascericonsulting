import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: Questo aggiorna la sessione se scaduta
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const pathname = request.nextUrl.pathname;
    const allowedWhenResetPending = [
      "/auth/reset-password",
      "/auth/callback",
      "/auth/recovery-callback",
      "/auth/auth-code-error",
      "/auth/forgot-password",
      "/login",
    ];
    const isAllowedPath = allowedWhenResetPending.some(
      (allowedPath) =>
        pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("must_reset_password")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.must_reset_password && !isAllowedPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/reset-password";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}