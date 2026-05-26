import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PremiumFolderUpsellProps = {
  folderName?: string
  archivePath: string
  variant?: "dialog" | "page"
}

export function PremiumFolderUpsell({
  folderName,
  archivePath,
  variant = "page",
}: PremiumFolderUpsellProps) {
  const title = folderName
    ? `«${folderName}» è riservata agli utenti Premium`
    : "Contenuto riservato agli utenti Premium"

  const body = (
    <>
      <p className="text-slate-600 max-w-md">
        Questa cartella e i documenti al suo interno sono disponibili solo per gli utenti{" "}
        <strong>Premium</strong> o <strong>Admin</strong>. Contatta un amministratore del tool
        per richiedere l&apos;upgrade del tuo account.
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link href={archivePath}>Torna all&apos;archivio</Link>
      </Button>
    </>
  )

  if (variant === "dialog") {
    return (
      <>
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <ShieldAlert className="h-6 w-6 text-amber-600" aria-hidden />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-center">
            Questa cartella e i documenti al suo interno sono disponibili solo per gli utenti
            Premium o Admin. Contatta un amministratore del tool per richiedere l&apos;upgrade del
            tuo account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline">
            <Link href={archivePath}>Torna all&apos;archivio</Link>
          </Button>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
      <div className="p-4 bg-amber-50 rounded-full">
        <ShieldAlert className="w-12 h-12 text-amber-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Accesso Limitato</h2>
      {body}
    </div>
  )
}
