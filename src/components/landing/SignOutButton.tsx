"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/actions/auth"

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button
        variant="outline"
        type="submit"
        className="group gap-2 border-slate-300 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Esci
      </Button>
    </form>
  )
}
