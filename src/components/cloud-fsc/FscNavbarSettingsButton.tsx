'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const GOLD_COLOR = '#967635'

type FscNavbarSettingsButtonProps = {
  href?: string
}

export function FscNavbarSettingsButton({ href = '/cloud-fsc/impostazioni' }: FscNavbarSettingsButtonProps) {
  const pathname = usePathname()
  const active = pathname.startsWith(href)

  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-amber-50 text-[#967635]'
          : 'text-slate-500 hover:bg-slate-100 hover:text-[#967635]'
      )}
      style={{ color: active ? GOLD_COLOR : undefined }}
      aria-label="Impostazioni e profilo"
      title="Impostazioni e profilo"
    >
      <Settings className="h-5 w-5" />
    </Link>
  )
}
