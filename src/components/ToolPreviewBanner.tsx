import { Sparkles } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ToolPreviewBanner({ toolName }: { toolName: string }) {
  return (
    <Alert className="rounded-none border-x-0 border-t-0 border-amber-200 bg-amber-50 text-amber-950">
      <Sparkles className="text-amber-700" />
      <AlertTitle className="text-amber-900">{toolName} — versione anteprima</AlertTitle>
      <AlertDescription className="text-amber-800">
        Alcune funzionalità possono cambiare. L&apos;accesso alle sezioni dipende dal ruolo
        assegnato al tool (standard, premium o admin).
      </AlertDescription>
    </Alert>
  )
}
