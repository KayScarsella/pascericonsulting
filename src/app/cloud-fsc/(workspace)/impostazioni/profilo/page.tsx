import { getMyProfile } from '@/actions/profile'
import { UserProfileSettingsView } from '@/components/profile/UserProfileSettingsView'
import { redirect } from 'next/navigation'

export default async function CloudFscImpostazioniProfiloPage() {
  const profileRes = await getMyProfile()

  if (!profileRes.success || !profileRes.data) {
    redirect('/login')
  }

  return <UserProfileSettingsView profile={profileRes.data} />
}
