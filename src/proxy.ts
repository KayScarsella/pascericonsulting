import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy"; // Nota: dobbiamo creare questo piccolo helper

export default async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Applica il middleware a tutte le rotte tranne:
     * - _next/static (file statici)
     * - _next/image (immagini ottimizzate)
     * - favicon.ico (icona)
     * - immagini varie (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};