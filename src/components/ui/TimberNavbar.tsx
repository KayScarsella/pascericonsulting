'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, X, LogOut, ShieldAlert, FileText, Search, Home, Database, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ToolRole } from "@/lib/tool-auth"

const GOLD_COLOR = "#967635"

// Configurazione Menu
// minRole indica il livello MINIMO richiesto per vedere la voce
// standard = tutti | premium = premium e admin | admin = solo admin
const NAV_ITEMS = [
  { label: 'Home', href: '', icon: Home, minRole: 'standard' },
  { label: 'Documentazione', href: '/documentation', icon: FileText, minRole: 'standard' },
  { label: 'Analisi Rischio', href: '/risk-analysis', icon: ShieldAlert, minRole: 'premium' },
  { label: 'Cerca', href: '/search', icon: Search, minRole: 'premium' },
  { label: 'Master', href: '/master', icon: Database, minRole: 'admin' },
] as const

interface TimberNavbarProps {
  toolId: string
  userRole: ToolRole
}

export function TimberNavbar({ toolId, userRole }: TimberNavbarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const basePath = `/dashboard/tools/${toolId}`

  // Funzione helper per verificare i permessi gerarchici
  const canView = (minRole: string) => {
    if (userRole === 'admin') return true // Admin vede tutto
    if (userRole === 'premium') return minRole !== 'admin' // Premium vede tutto tranne admin
    return minRole === 'standard' // Standard vede solo standard
  }

  const visibleItems = NAV_ITEMS.filter(item => canView(item.minRole))

  const isActive = (path: string) => {
    if (path === '') return pathname === basePath
    return pathname.startsWith(`${basePath}${path}`)
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white font-bold">
              TR
            </div>
            <span className="hidden font-bold text-slate-900 sm:inline-block">
              Timber Regulation
            </span>
            {/* Badge Ruolo Utente */}
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 uppercase">
              {userRole}
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex md:gap-x-1">
            {visibleItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={`${basePath}${item.href}`}
                  className={cn(
                    "group relative inline-flex items-center px-3 py-2 text-sm font-medium transition-all duration-200 rounded-md",
                    active ? "bg-amber-50/50" : "text-slate-500 hover:bg-slate-50"
                  )}
                  style={{ color: active ? GOLD_COLOR : undefined }}
                >
                  <item.icon 
                    className="mr-2 h-4 w-4 transition-colors group-hover:text-[#967635]" 
                    style={{ color: active ? GOLD_COLOR : undefined }} 
                  />
                  <span className="group-hover:text-[#967635] transition-colors">{item.label}</span>
                  
                  {active && (
                    <span 
                      className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full transition-all" 
                      style={{ backgroundColor: GOLD_COLOR }}
                    />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Mobile Button & Exit */}
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-red-600 gap-2">
              <Link href="/landingPage">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Esci</span>
              </Link>
            </Button>
            <div className="flex md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-2 space-y-1 shadow-lg">
          {visibleItems.map((item) => {
             const active = isActive(item.href)
             return (
              <Link
                key={item.href}
                href={`${basePath}${item.href}`}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-base font-medium transition-colors",
                  active ? "bg-amber-50" : "text-slate-600 hover:bg-slate-50 hover:text-[#967635]"
                )}
                style={{ color: active ? GOLD_COLOR : undefined }}
              >
                <item.icon className="mr-3 h-5 w-5" style={{ color: active ? GOLD_COLOR : undefined }} />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}