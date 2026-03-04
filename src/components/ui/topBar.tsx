'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
// 1. Importa tutte le icone che pensi di usare nel progetto qui
import { 
  Menu, X, LogOut, Home, FileText, ShieldAlert, Search, 
  Database, Lock, BookOpen, UserCheck, Settings 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const GOLD_COLOR = "#967635"

// 2. Crea una mappa stringa -> componente
const ICON_MAP = {
  Home,
  FileText,
  ShieldAlert,
  Search,
  Database,
  Lock,
  BookOpen,
  UserCheck,
  Settings,
  Menu, // Utile se serve altrove
  LogOut
}

// Tipo per le chiavi disponibili (assicura l'autocomplete)
export type IconName = keyof typeof ICON_MAP

export interface NavItem {
  label: string
  href: string
  // 3. Cambia il tipo da LucideIcon a stringa (IconName)
  iconName: IconName 
  minRole: 'standard' | 'premium' | 'admin'
}

interface ToolNavbarProps {
  toolName: string      
  basePath: string      
  items: NavItem[]      
  userRole: string      
}

export function ToolNavbar({ toolName, basePath, items, userRole }: ToolNavbarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const canView = (minRole: string) => {
    if (userRole === 'admin') return true
    if (userRole === 'premium') return minRole !== 'admin'
    return minRole === 'standard'
  }

  const visibleItems = items.filter(item => canView(item.minRole))

  const isActive = (itemHref: string) => {
    const fullPath = `${basePath}${itemHref}`.replace(/\/$/, '')
    const currentPath = pathname.replace(/\/$/, '')

    if (itemHref === '') {
      return currentPath === fullPath
    }
    return currentPath.startsWith(fullPath)
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          
          {/* Logo & Nome Tool */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white font-bold text-xs">
              {toolName.substring(0, 2).toUpperCase()}
            </div>
            <span className="hidden font-bold text-slate-900 sm:inline-block">
              {toolName}
            </span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 uppercase">
              {userRole}
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex md:gap-x-1">
            {visibleItems.map((item) => {
              const active = isActive(item.href)
              // 4. Recupera l'icona dalla mappa usando la stringa
              const IconComponent = ICON_MAP[item.iconName] || Home // Fallback su Home se non trovata

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
                  <IconComponent 
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
             const IconComponent = ICON_MAP[item.iconName] || Home

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
                <IconComponent className="mr-3 h-5 w-5" style={{ color: active ? GOLD_COLOR : undefined }} />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}