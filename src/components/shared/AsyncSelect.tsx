'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchDynamicOptionsByIds, fetchDynamicOptionsPaged } from '@/actions/questions'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type AsyncSelectSourceConfig = {
  source_table?: string
  source_label_col?: string
  source_value_col?: string
  source_extra_cols?: string[]
  placeholder?: string
  is_multi?: boolean
  max_selections?: number
}

type AsyncSelectOption = {
  label: string
  value: string
  extra?: Record<string, unknown>
}

export type AsyncSelectProps = {
  config: AsyncSelectSourceConfig
  value: string | null | undefined
  onChange: (value: string) => void
  onExtraChange?: (extra: Record<string, unknown> | null) => void
  readOnly?: boolean
  toolId?: string
  /** Opzione per azzerare la selezione (es. specie opzionale). */
  clearLabel?: string
  className?: string
  popoverClassName?: string
}

export function AsyncSelect({
  config,
  value,
  onChange,
  onExtraChange,
  readOnly = false,
  toolId,
  clearLabel,
  className,
  popoverClassName,
}: AsyncSelectProps) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<AsyncSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState<number | null>(0)
  const [hasMore, setHasMore] = useState(true)

  const hydratedRef = useRef(false)
  const queryDebounceRef = useRef<number | null>(null)
  const isMulti = config.is_multi === true
  const maxSelections = config.max_selections

  const safeValueString = value === null || value === undefined || Array.isArray(value) ? '' : String(value)
  const selectedValues = useMemo(
    () =>
      isMulti
        ? safeValueString
          ? safeValueString.split(',')
          : []
        : safeValueString
          ? [safeValueString]
          : [],
    [isMulti, safeValueString]
  )
  const selectedValuesKey = useMemo(() => selectedValues.join(','), [selectedValues])

  const dedupeAppend = useCallback((prev: AsyncSelectOption[], next: AsyncSelectOption[]) => {
    if (next.length === 0) return prev
    const seen = new Set(prev.map((o) => o.value))
    const merged = [...prev]
    for (const opt of next) {
      if (!seen.has(opt.value)) {
        merged.push(opt)
        seen.add(opt.value)
      }
    }
    return merged
  }, [])

  const loadPage = useCallback(
    async (args: { reset: boolean; cursorOverride?: number | null }) => {
      if (!config.source_table) return
      const nextCursor = args.cursorOverride ?? 0
      if (nextCursor == null) return

      const isReset = args.reset
      if (isReset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      try {
        const res = await fetchDynamicOptionsPaged({
          table: config.source_table,
          labelCol: config.source_label_col || 'name',
          valueCol: config.source_value_col || 'id',
          extraCols: config.source_extra_cols,
          search: query.trim() || undefined,
          cursor: nextCursor,
          pageSize: 60,
          toolId,
        })
        setOptions((prev) => (isReset ? res.items : dedupeAppend(prev, res.items)))
        setCursor(res.nextCursor)
        setHasMore(res.nextCursor != null)
      } catch (error) {
        console.error('Errore caricamento opzioni:', error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [
      config.source_table,
      config.source_label_col,
      config.source_value_col,
      config.source_extra_cols,
      query,
      dedupeAppend,
      toolId,
    ]
  )

  useEffect(() => {
    const hasSavedValue = safeValueString !== ''
    if (!open && !hasSavedValue) return
    if (!config.source_table) return
    setOptions([])
    setCursor(0)
    setHasMore(true)
    hydratedRef.current = false
    void loadPage({ reset: true, cursorOverride: 0 })
  }, [
    open,
    safeValueString,
    config.source_table,
    config.source_label_col,
    config.source_value_col,
    config.source_extra_cols,
    loadPage,
  ])

  useEffect(() => {
    if (options.length > 0 && selectedValues.length > 0 && !hydratedRef.current && !isMulti) {
      const selectedOpt = options.find((o) => o.value === selectedValues[0])
      if (selectedOpt?.extra && onExtraChange) {
        onExtraChange(selectedOpt.extra)
      }
      hydratedRef.current = true
    }
  }, [options, selectedValues, onExtraChange, isMulti])

  useEffect(() => {
    if (!config.source_table) return
    if (selectedValues.length === 0) return

    const missing = selectedValues.filter((id) => !options.some((o) => o.value === id))
    if (missing.length === 0) return

    const table = config.source_table
    if (!table) return

    let mounted = true
    ;(async () => {
      try {
        const resolved = await fetchDynamicOptionsByIds({
          table,
          labelCol: config.source_label_col || 'name',
          valueCol: config.source_value_col || 'id',
          extraCols: config.source_extra_cols,
          ids: missing,
          toolId,
        })
        if (!mounted || resolved.length === 0) return
        setOptions((prev) => dedupeAppend(resolved, prev))
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [
    config.source_table,
    config.source_label_col,
    config.source_value_col,
    config.source_extra_cols,
    safeValueString,
    selectedValues,
    selectedValuesKey,
    options,
    toolId,
    dedupeAppend,
  ])

  useEffect(() => {
    if (!open) return
    if (queryDebounceRef.current) window.clearTimeout(queryDebounceRef.current)
    queryDebounceRef.current = window.setTimeout(() => {
      setOptions([])
      setCursor(0)
      setHasMore(true)
      void loadPage({ reset: true, cursorOverride: 0 })
    }, 250)
    return () => {
      if (queryDebounceRef.current) window.clearTimeout(queryDebounceRef.current)
    }
  }, [query, open, loadPage])

  const selectedLabels = selectedValues.map((v) => options.find((o) => o.value === v)?.label || v)
  const displayLabel =
    selectedLabels.length > 0
      ? selectedLabels.join(', ')
      : clearLabel || config.placeholder || 'Cerca...'

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between overflow-hidden bg-white hover:bg-slate-50',
            readOnly && 'opacity-80 bg-slate-50',
            className
          )}
          disabled={readOnly}
        >
          <span className="truncate flex-1 text-left mr-2 font-normal text-slate-700">
            {loading && selectedValues.length > 0 ? 'Caricamento nome...' : displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          'z-[100] w-[var(--radix-popover-trigger-width)] p-0',
          popoverClassName
        )}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="overflow-hidden">
          <CommandInput placeholder="Cerca..." value={query} onValueChange={setQuery} />
          <CommandList
            className="h-52 max-h-52 min-h-0 overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
            onScroll={(e) => {
              const el = e.currentTarget
              const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
              if (!nearBottom) return
              if (loading || loadingMore) return
              if (!hasMore) return
              void loadPage({ reset: false, cursorOverride: cursor })
            }}
          >
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Caricamento...
              </div>
            )}
            {!loading && options.length === 0 && !clearLabel && (
              <CommandEmpty>Nessun risultato.</CommandEmpty>
            )}
            <CommandGroup>
              {clearLabel && !isMulti && (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => {
                    onChange('')
                    onExtraChange?.(null)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 text-[#967635]',
                      !safeValueString ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="text-slate-500">{clearLabel}</span>
                </CommandItem>
              )}
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      if (isMulti) {
                        if (!isSelected && maxSelections && selectedValues.length >= maxSelections) {
                          toast.warning(
                            `Puoi selezionare al massimo ${maxSelections} elementi.`
                          )
                          return
                        }
                        const newVals = isSelected
                          ? selectedValues.filter((v) => v !== option.value)
                          : [...selectedValues, option.value]
                        onChange(newVals.join(','))
                      } else {
                        onChange(option.value)
                        onExtraChange?.(option.extra || null)
                        setOpen(false)
                      }
                    }}
                  >
                    {isMulti ? (
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                          isSelected
                            ? 'bg-[#967635] border-[#967635] text-white'
                            : 'border-slate-300 opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                    ) : (
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 text-[#967635]',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    )}
                    <span className="break-words line-clamp-2">{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {!loading && options.length > 0 && hasMore && (
              <div className="py-3 text-center text-xs text-slate-500">
                {loadingMore ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Caricamento altri risultati…
                  </span>
                ) : (
                  'Scorri per caricare altri risultati…'
                )}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
