import { redirect } from 'next/navigation'
import { FscIloEditView } from '@/components/cloud-fsc/ilo/FscIloEditView'
import { FSC_ILO_PATH } from '@/lib/fsc/constants'

type PageProps = {
  params: Promise<{ year: string }>
}

const ILO_MIN_YEAR = 2000

export default async function AutovalutazioneIloYearPage({ params }: PageProps) {
  const { year: yearParam } = await params
  const year = Number.parseInt(yearParam, 10)
  const maxYear = new Date().getFullYear() + 1

  if (Number.isNaN(year) || year < ILO_MIN_YEAR || year > maxYear) {
    redirect(FSC_ILO_PATH)
  }

  return <FscIloEditView referenceYear={year} />
}
