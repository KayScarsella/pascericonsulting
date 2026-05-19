import Link from "next/link"
import { Wrench, Shield, ExternalLink, User, Lock, Clock, AlertCircle } from "lucide-react"
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
import type { LandingToolAccess } from "@/lib/landing-data"

type ToolData = NonNullable<LandingToolAccess["tools"]>

export function LandingToolCard({
  toolId,
  tool,
  role,
}: {
  toolId: string
  tool: ToolData
  role: string
}) {
  const isAdmin = role === "admin"
  const isActive = tool.is_active === true
  const targetUrl = resolveToolBasePath(toolId, tool.base_path)
  const isConfigured = !!targetUrl

  return (
    <Card
      className={`group relative flex flex-col overflow-hidden border-slate-200 transition-all duration-300 ${
        isActive && isConfigured
          ? "hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100/50"
          : "border-slate-100 bg-slate-50/50 opacity-80"
      }`}
    >
      <Accent isActive={isActive} isAdmin={isAdmin} />

      <div className={!isActive ? "grayscale filter" : ""}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div
              className={`rounded-lg p-2 text-slate-700 ${!isActive ? "bg-slate-200" : "bg-slate-100"}`}
            >
              {!isActive ? (
                <Clock className="h-6 w-6 text-slate-500" />
              ) : (
                <Wrench className="h-6 w-6" />
              )}
            </div>
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
          </div>
          <CardTitle
            className={`mt-4 text-xl font-semibold ${!isActive ? "text-slate-500" : "text-slate-900"}`}
          >
            {tool.name}
          </CardTitle>
          <CardDescription className="line-clamp-2 text-sm text-slate-500">
            {tool.description || "Nessuna descrizione disponibile."}
          </CardDescription>
        </CardHeader>
      </div>

      <CardContent className="flex-grow">
        {isActive && !isConfigured && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
            <AlertCircle className="w-3 h-3" />
            Configurazione mancante
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        {isActive ? (
          isConfigured ? (
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
          ) : (
            <Button disabled className="w-full gap-2" variant="outline">
              Errore Link
            </Button>
          )
        ) : isAdmin && isConfigured ? (
          <Button
            asChild
            className="w-full gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            variant="outline"
          >
            <Link href={targetUrl!}>
              Anteprima admin <ExternalLink className="h-4 w-4 opacity-70" />
            </Link>
          </Button>
        ) : (
          <Button
            disabled
            className="w-full gap-2 bg-slate-200 text-slate-500 hover:bg-slate-200"
            variant="secondary"
          >
            <Lock className="h-4 w-4" /> Prossimamente
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function Accent({ isActive, isAdmin }: { isActive: boolean; isAdmin: boolean }) {
  return (
    <div
      className={`h-1.5 w-full ${!isActive ? "bg-slate-300" : isAdmin ? "bg-amber-500" : "bg-blue-500"}`}
    />
  )
}
