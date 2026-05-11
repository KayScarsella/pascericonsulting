import { redirect } from 'next/navigation'

/** Compatibilità con link vecchi: reindirizza alle pagine dedicate invito vs recupero. */
export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>
}) {
  const sp = await searchParams
  const reason = typeof sp.reason === 'string' ? sp.reason : Array.isArray(sp.reason) ? sp.reason[0] : undefined
  if (reason === 'recovery') {
    redirect('/auth/recupero-non-valido')
  }
  redirect('/auth/invito-non-valido')
}
