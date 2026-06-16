import { redirect } from 'next/navigation'
import { FscIloListView } from '@/components/cloud-fsc/ilo/FscIloListView'
import { fscIloEditPath } from '@/lib/fsc/constants'

type PageProps = {
  searchParams: Promise<{ year?: string }>
}

export default async function AutovalutazioneIloPage({ searchParams }: PageProps) {
  const sp = await searchParams
  if (sp.year) {
    const parsed = Number.parseInt(sp.year, 10)
    if (!Number.isNaN(parsed)) {
      redirect(fscIloEditPath(parsed))
    }
  }

  return <FscIloListView />
}
