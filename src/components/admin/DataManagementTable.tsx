'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface DataManagementColumn<T> {
  id: string
  header: string
  sortKey?: string
  render: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
}

export interface DataManagementTableProps<T> {
  title: string
  data: T[]
  columns: DataManagementColumn<T>[]
  getRowId: (row: T) => string
  searchPlaceholder?: string
  filterPredicate?: (row: T, search: string) => boolean
  sortConfig?: {
    field: string | null
    dir: 'asc' | 'desc'
    onSort: (field: string) => void
  }
  selectable?: boolean
  onBulkDelete?: (ids: string[]) => Promise<{ success: boolean; error?: string }>
  bulkDeleteLabel?: string
  emptyMessage?: string
  pagination?: {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
  }
  renderRowActions?: (row: T) => React.ReactNode
  resultCountLabel?: React.ReactNode
  /** Rendered in the toolbar row next to the search input (e.g. filter dropdown) */
  toolbarExtra?: React.ReactNode
  /** When provided with sortConfig, sorts the filtered data before display */
  sortCompare?: (a: T, b: T, field: string, dir: 'asc' | 'desc') => number
}

export function DataManagementTable<T>({
  title,
  data,
  columns,
  getRowId,
  searchPlaceholder = 'Cerca...',
  filterPredicate,
  sortConfig,
  selectable = false,
  onBulkDelete,
  bulkDeleteLabel = 'Elimina',
  emptyMessage = 'Nessun elemento.',
  pagination,
  renderRowActions,
  resultCountLabel,
  toolbarExtra,
  sortCompare,
}: DataManagementTableProps<T>) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const filteredData = useMemo(() => {
    if (!search.trim() || !filterPredicate) return data
    const q = search.trim().toLowerCase()
    return data.filter((row) => filterPredicate(row, q))
  }, [data, search, filterPredicate])

  const sortedData = useMemo(() => {
    if (!sortConfig?.field || !sortCompare) return filteredData
    return [...filteredData].sort((a, b) =>
      sortCompare(a, b, sortConfig.field!, sortConfig.dir)
    )
  }, [filteredData, sortConfig?.field, sortConfig?.dir, sortCompare])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedIds.length === sortedData.length) setSelectedIds([])
    else setSelectedIds(sortedData.map((row) => getRowId(row)))
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || !onBulkDelete) return
    if (!confirm(`Eliminare ${selectedIds.length} elemento/i selezionato/i? L'azione è irreversibile.`)) return
    setIsProcessing(true)
    try {
      const res = await onBulkDelete(selectedIds)
      if (res.success) {
        setSelectedIds([])
        toast.success('Elementi eliminati con successo.')
      } else {
        toast.error(res.error ?? 'Errore durante l\'eliminazione.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const renderSortIcon = (sortKey: string) => {
    if (!sortConfig || sortConfig.field !== sortKey)
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-400" />
    return sortConfig.dir === 'asc' ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-slate-700" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-slate-700" />
    )
  }

  const hasActions = Boolean(renderRowActions)
  const colCount = columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            className="h-9 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearch('')}
              aria-label="Cancella ricerca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {toolbarExtra}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          <span className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
            {resultCountLabel ?? `${sortedData.length} risultati`}
            {(search || (filterPredicate && search.trim())) ? (
              <span className="text-slate-400">(filtrati)</span>
            ) : null}
          </span>
        </div>

        {selectable && onBulkDelete && selectedIds.length > 0 && (
          <div className="flex animate-in fade-in slide-in-from-right-2 items-center gap-2">
            <span className="mr-2 text-sm text-slate-500">
              {selectedIds.length} selezionati
            </span>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {bulkDeleteLabel}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                {selectable && (
                  <th className="w-12 p-4">
                    <Checkbox
                      checked={
                        sortedData.length > 0 &&
                        selectedIds.length === sortedData.length
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Seleziona tutti"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={cn(
                      'px-4 py-3',
                      col.headerClassName,
                      sortConfig && col.sortKey &&
                        'cursor-pointer select-none transition-colors hover:bg-slate-100'
                    )}
                    onClick={() =>
                      col.sortKey && sortConfig?.onSort(col.sortKey)
                    }
                  >
                    <span className="inline-flex items-center">
                      {col.header}
                      {col.sortKey && sortConfig && renderSortIcon(col.sortKey)}
                    </span>
                  </th>
                ))}
                {hasActions && (
                  <th className="px-4 py-3 text-right">Azioni</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.length === 0 && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="py-12 text-center text-slate-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {sortedData.map((row) => {
                const rowId = getRowId(row)
                return (
                  <tr
                    key={rowId}
                    className="transition-colors hover:bg-slate-50/50"
                  >
                    {selectable && (
                      <td className="p-4">
                        <Checkbox
                          checked={selectedIds.includes(rowId)}
                          onCheckedChange={() => toggleSelection(rowId)}
                          aria-label={`Seleziona ${rowId}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn('px-4 py-3', col.className)}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                    {hasActions && (
                      <td className="px-4 py-3 text-right">
                        {renderRowActions?.(row)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="text-sm text-slate-500">
            Pagina {pagination.page} di {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Successivo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
