import { loadEudrRisultatoDeferredData } from "@/lib/eudr-risultato-deferred-data"
import { logRoutePerf } from "@/lib/perf-debug"
import type { DdLastRunSnapshot } from "@/features/eudr-due-diligence/aoiRiskGate"
import type { RiskCalculationResult } from "@/lib/eudr-risk-calculator"
import type { EudrDdsType } from "@/types/session"
import { PDF_DISCLAIMERS } from "@/components/ExportAnalysisPdfButton"
import { EudrRisultatoPdfButton } from "@/components/eudr/EudrRisultatoPdfButton"
import { MitigationHistorySection } from "@/components/MitigationHistorySection"

export type EudrRisultatoDeferredProps = {
  sessionId: string
  nomeOperazione: string
  userProfile: {
    full_name?: string | null
    ragione_sociale?: string | null
    cf_partita_iva?: string | null
    indirizzo?: string | null
    cap?: string | null
    citta?: string | null
    provincia?: string | null
    recapito_telefonico?: string | null
    email?: string | null
  } | null
  displayOutcomeDescription: string
  ddsType: EudrDdsType
  specieName: string
  countryName: string
  countryHasConflicts: boolean
  baseEvaluationCode: number | null
  result: RiskCalculationResult
  answersMap: Record<string, string | null>
  answersJsonMap: Record<string, unknown>
  ddLastRunNormalized?: DdLastRunSnapshot
}

export async function EudrRisultatoDeferred(props: EudrRisultatoDeferredProps) {
  const perfStart = Date.now()
  const {
    sessionId,
    nomeOperazione,
    userProfile,
    displayOutcomeDescription,
    ddsType,
    specieName,
    countryName,
    countryHasConflicts,
    baseEvaluationCode,
    result,
    answersMap,
    answersJsonMap,
    ddLastRunNormalized,
  } = props

  const deferred = await loadEudrRisultatoDeferredData({
    sessionId,
    answersMap,
    answersJsonMap,
    result,
    ddLastRun: ddLastRunNormalized,
  })

  logRoutePerf("/EUDR/risultato/deferred", {
    tab: sessionId,
    queryCount: deferred.queryCount,
    durationMs: Date.now() - perfStart,
    storageMs: deferred.storageMs,
  })

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-10">
        <EudrRisultatoPdfButton
          variant="EUDR"
          nomeOperazione={nomeOperazione}
          userProfile={userProfile}
          disclaimerText={PDF_DISCLAIMERS.EUDR}
          outcome={result.outcome}
          outcomeDescription={displayOutcomeDescription}
          ddsType={ddsType}
          specieName={specieName}
          countryName={countryName}
          countryHasConflicts={!!countryHasConflicts}
          expiryDate={result.expiryDate}
          overallRisk={result.overallRisk}
          details={result.details}
          sectionsForPdf={deferred.sectionsForPdf}
          sessionId={sessionId}
          baseEvaluationCode={baseEvaluationCode}
          ddPdfPayload={deferred.ddPdfPayload}
        />
      </div>

      {deferred.mitigationHistory.length > 0 && (
        <MitigationHistorySection
          sessionId={sessionId}
          history={deferred.mitigationHistory}
          questionLabelsMap={deferred.questionLabelsMap}
          currentDetails={result.details}
        />
      )}
    </>
  )
}
