import Link from "next/link"
import {
  Wrench,
  Shield,
  ExternalLink,
  User,
  Lock,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { resolveToolBasePath } from "@/lib/tool-paths"
import type { LandingToolRow } from "@/lib/landing-data"

export function LandingToolCard({
  toolId,
  tool,
  hasAccess,
  role,
}: {
  toolId: string
  tool: LandingToolRow
  hasAccess: boolean
  role: string | null
}) {
  const isAdmin = role === "admin"
  const isActive = tool.is_active === true
  const targetUrl = resolveToolBasePath(toolId, tool.base_path)
  const isConfigured = !!targetUrl
  const isLocked = !hasAccess && isActive
  const isInDevelopment = !hasAccess && !isActive

  return (
    <Card
      className={`group relative flex flex-col overflow-hidden border-slate-200 transition-all duration-300 ${
        hasAccess && isActive && isConfigured
          ? "hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100/50"
          : isLocked
            ? "border-amber-200 bg-gradient-to-b from-white to-amber-50/40"
            : "border-slate-100 bg-slate-50/50 opacity-80"
      }`}
    >
      <Accent
        hasAccess={hasAccess}
        isActive={isActive}
        isAdmin={isAdmin}
        isLocked={isLocked}
        isInDevelopment={isInDevelopment}
      />

      <div className={isInDevelopment || (!hasAccess && !isActive) ? "grayscale filter" : ""}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-2">
            <div
              className={`rounded-lg p-2 text-slate-700 ${
                isInDevelopment ? "bg-slate-200" : isLocked ? "bg-amber-100" : "bg-slate-100"
              }`}
            >
              {isInDevelopment ? (
                <Clock className="h-6 w-6 text-slate-500" />
              ) : isLocked ? (
                <Lock className="h-6 w-6 text-amber-700" />
              ) : (
                <Wrench className="h-6 w-6" />
              )}
            </div>
            <StatusBadge
              hasAccess={hasAccess}
              isActive={isActive}
              isAdmin={isAdmin}
              isLocked={isLocked}
              isInDevelopment={isInDevelopment}
            />
          </div>
          <CardTitle
            className={`mt-4 text-xl font-semibold ${
              isInDevelopment ? "text-slate-500" : isLocked ? "text-slate-800" : "text-slate-900"
            }`}
          >
            {tool.name}
          </CardTitle>
          <CardDescription className="line-clamp-2 text-sm text-slate-500">
            {tool.description || "Nessuna descrizione disponibile."}
          </CardDescription>
        </CardHeader>
      </div>

      <CardContent className="flex-grow">
        {isLocked && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
            Modulo attivo: richiedi l&apos;accesso al tuo amministratore per sbloccarlo.
          </div>
        )}
        {isInDevelopment && (
          <div className="flex items-start gap-2 rounded-md bg-slate-100 p-2 text-xs text-slate-600">
            <Clock className="mt-0.5 h-3 w-3 shrink-0" />
            Nuovo modulo in fase di sviluppo: sarà disponibile a breve.
          </div>
        )}
        {hasAccess && isActive && !isConfigured && (
          <div className="mt-2 flex items-center gap-2 rounded bg-amber-50 p-2 text-xs text-amber-600">
            <AlertCircle className="h-3 w-3" />
            Configurazione mancante
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <ToolAction
          hasAccess={hasAccess}
          isActive={isActive}
          isAdmin={isAdmin}
          isConfigured={isConfigured}
          isLocked={isLocked}
          isInDevelopment={isInDevelopment}
          targetUrl={targetUrl}
        />
      </CardFooter>
    </Card>
  )
}

function StatusBadge({
  hasAccess,
  isActive,
  isAdmin,
  isLocked,
  isInDevelopment,
}: {
  hasAccess: boolean
  isActive: boolean
  isAdmin: boolean
  isLocked: boolean
  isInDevelopment: boolean
}) {
  if (isLocked) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" /> Accesso limitato
        </span>
      </Badge>
    )
  }

  if (isInDevelopment) {
    return (
      <Badge variant="secondary" className="bg-slate-200 text-slate-600 hover:bg-slate-200">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> In sviluppo
        </span>
      </Badge>
    )
  }

  if (!hasAccess) {
    return null
  }

  return (
    <Badge
      variant="secondary"
      className={`${
        !isActive
          ? "bg-slate-200 text-slate-500"
          : isAdmin
            ? "bg-amber-100 text-amber-700"
            : "bg-slate-100 text-slate-600"
      } hover:bg-opacity-100`}
    >
      {isAdmin ? (
        <span className="flex items-center gap-1">
          <Shield className="h-3 w-3" /> Admin
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" /> Utente
        </span>
      )}
    </Badge>
  )
}

function ToolAction({
  hasAccess,
  isActive,
  isAdmin,
  isConfigured,
  isLocked,
  isInDevelopment,
  targetUrl,
}: {
  hasAccess: boolean
  isActive: boolean
  isAdmin: boolean
  isConfigured: boolean
  isLocked: boolean
  isInDevelopment: boolean
  targetUrl: string | null
}) {
  if (isLocked) {
    return (
      <Button
        disabled
        className="w-full gap-2 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"
        variant="outline"
      >
        <Lock className="h-4 w-4" /> Richiedi accesso
      </Button>
    )
  }

  if (isInDevelopment) {
    return (
      <Button
        disabled
        className="w-full gap-2 bg-slate-200 text-slate-500 hover:bg-slate-200"
        variant="secondary"
      >
        <Clock className="h-4 w-4" /> Prossimamente
      </Button>
    )
  }

  if (!hasAccess) {
    return null
  }

  if (isActive) {
    if (isConfigured) {
      return (
        <Button
          asChild
          className="w-full gap-2 transition-all group-hover:bg-blue-600 group-hover:text-white"
          variant={isAdmin ? "outline" : "default"}
        >
          <Link href={targetUrl!}>
            Apri Tool{" "}
            <ExternalLink className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100" />
          </Link>
        </Button>
      )
    }

    return (
      <Button disabled className="w-full gap-2" variant="outline">
        Errore Link
      </Button>
    )
  }

  if (isAdmin && isConfigured) {
    return (
      <Button
        asChild
        className="w-full gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
        variant="outline"
      >
        <Link href={targetUrl!}>
          Anteprima admin <ExternalLink className="h-4 w-4 opacity-70" />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      disabled
      className="w-full gap-2 bg-slate-200 text-slate-500 hover:bg-slate-200"
      variant="secondary"
    >
      <Lock className="h-4 w-4" /> Prossimamente
    </Button>
  )
}

function Accent({
  hasAccess,
  isActive,
  isAdmin,
  isLocked,
  isInDevelopment,
}: {
  hasAccess: boolean
  isActive: boolean
  isAdmin: boolean
  isLocked: boolean
  isInDevelopment: boolean
}) {
  let color = "bg-slate-300"
  if (isLocked) color = "bg-amber-400"
  else if (isInDevelopment) color = "bg-slate-300"
  else if (hasAccess && isActive) color = isAdmin ? "bg-amber-500" : "bg-blue-500"

  return <div className={`h-1.5 w-full ${color}`} />
}
