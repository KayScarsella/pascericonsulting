import Link from "next/link"
import { Archive } from "lucide-react"

import { WP_ANALYSIS_ARCHIVE_URL } from "@/lib/constants"

export function ArchiveBackButton() {
  return (
    <Link
      href={WP_ANALYSIS_ARCHIVE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border-2 border-[#967635] bg-[#967635] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#7a5f2a] hover:border-[#7a5f2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#967635] focus-visible:ring-offset-2 sm:px-5 sm:text-base"
    >
      <Archive className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
      Torna all&apos;archivio analisi
    </Link>
  )
}
