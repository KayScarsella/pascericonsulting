import { LogOut } from "lucide-react"
import { signOutAction } from "@/actions/auth"

/** Server-only logout control — avoids client JS on landing (better FCP). */
export function SignOutForm() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="group inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Esci
      </button>
    </form>
  )
}
