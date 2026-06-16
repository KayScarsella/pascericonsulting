'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function CloudFscSetupRedirect({
  needsSetup,
  userRole,
}: {
  needsSetup: boolean
  userRole: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!needsSetup) return
    if (userRole === 'admin') return
    if (pathname.startsWith('/cloud-fsc/setup') || pathname.startsWith('/cloud-fsc/master')) return
    router.replace('/cloud-fsc/setup')
  }, [needsSetup, pathname, router, userRole])

  return null
}
