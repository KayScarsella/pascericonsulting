import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, Users, Mail } from 'lucide-react'

export default async function CloudFscMasterPage() {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  if (role !== 'admin') redirect('/landingPage')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg bg-slate-900 p-6 text-white shadow-lg">
        <div>
          <h1 className="text-2xl font-bold">Master CLOUD FSC</h1>
          <p className="text-slate-300">Gestione utenti e supervisione inviti email.</p>
        </div>
        <Settings className="h-10 w-10 text-[#967635]" aria-hidden />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/cloud-fsc/master/users"
          className="block cursor-pointer rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-[#967635] group"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded bg-amber-50 p-2 transition-colors group-hover:bg-[#967635]">
              <Users className="h-6 w-6 text-[#967635] group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold">Gestione utenti</h3>
          </div>
          <p className="text-sm text-slate-500">Ruoli, inviti e permessi sul tool CLOUD FSC.</p>
        </Link>

        <Link
          href="/cloud-fsc/master/email-supervision"
          className="block cursor-pointer rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-[#967635] group"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded bg-amber-50 p-2 transition-colors group-hover:bg-[#967635]">
              <Mail className="h-6 w-6 text-[#967635] group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold">Supervisione email</h3>
          </div>
          <p className="text-sm text-slate-500">Stato Resend e contatori link invito per utente.</p>
        </Link>
      </div>
    </div>
  )
}
