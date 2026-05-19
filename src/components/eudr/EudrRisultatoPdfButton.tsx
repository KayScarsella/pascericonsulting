"use client"

import dynamic from "next/dynamic"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"

const ExportAnalysisPdfButton = dynamic(
  () =>
    import("@/components/ExportAnalysisPdfButton").then((mod) => ({
      default: mod.ExportAnalysisPdfButton,
    })),
  {
    ssr: false,
    loading: () => (
      <Button type="button" variant="outline" disabled className="gap-2">
        Caricamento export PDF…
      </Button>
    ),
  }
)

export type EudrRisultatoPdfButtonProps = ComponentProps<typeof ExportAnalysisPdfButton>

export function EudrRisultatoPdfButton(props: EudrRisultatoPdfButtonProps) {
  return <ExportAnalysisPdfButton {...props} />
}
