import { getToolAccess } from '@/lib/tool-auth'
import { EUDR_TOOL_ID } from '@/lib/constants'
import { getMyProfile } from '@/actions/profile'
import { UserProfileSettingsView } from '@/components/profile/UserProfileSettingsView'
import { redirect } from 'next/navigation'

export default async function EudrImpostazioniPage() {
  await getToolAccess(EUDR_TOOL_ID)
  const profileRes = await getMyProfile()

  if (!profileRes.success || !profileRes.data) {
    redirect('/login')
  }

  const profile = profileRes.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Impostazioni</h1>
        <p className="mt-1 text-slate-500">
          Gestisci il profilo di{' '}
          <span className="font-medium text-slate-700">
            {profile.full_name ?? profile.email ?? 'utente'}
          </span>
        </p>
      </div>
      <UserProfileSettingsView profile={profile} />
    </div>
  )
}
