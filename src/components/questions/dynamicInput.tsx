'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, CheckCircle2, Circle, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { QuestionConfig, QuestionType } from "@/types/questions"
import { fetchDynamicOptionsByIds, fetchDynamicOptionsPaged } from "@/actions/questions"
import { toast } from "sonner" 
import { SupplierManager } from "./SupplierManager"

export type AnswerValue = string | number | null | Record<string, unknown>[] | Record<string, unknown>

interface RepeaterField {
    name: string
    label?: string
    type: QuestionType
    config: QuestionConfig
}

export interface RepeaterConfig extends QuestionConfig {
    max_items?: number
    item_label?: string
    fields?: RepeaterField[]
}

interface DynamicInputProps {
  type: QuestionType 
  config: RepeaterConfig 
  value: AnswerValue
  onChange: (val: AnswerValue) => void
  onExtraChange?: (extraData: Record<string, unknown> | null) => void 
  readOnly?: boolean
  toolId?: string
}

// 🛠️ BEST PRACTICE: Interfaccia tipizzata per evitare l'uso di 'any'
interface DebouncedInputProps {
  value: string | number;
  onChange: (value: string) => void;
  type: 'text' | 'number';
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

function DebouncedInput({ 
  value, 
  onChange, 
  type, 
  placeholder, 
  readOnly, 
  className 
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const onChangeRef = useRef(onChange)

  // Teniamo aggiornata la ref dell'onChange senza far scattare l'useEffect
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  
  // Sincronizziamo il valore dall'esterno se cambia (es. reset form o fetch da DB)
  useEffect(() => { setLocalValue(value) }, [value])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChangeRef.current(String(localValue)) // Assicuriamo che esca sempre come stringa
      }
    }, 400) // 400ms di ritardo (debounce)
    
    return () => clearTimeout(handler)
  }, [localValue, value])

  return (
    <Input 
      type={type} 
      placeholder={placeholder}
      value={localValue} 
      onChange={(e) => setLocalValue(e.target.value)} 
      className={className}
      disabled={readOnly} 
    />
  )
}

export function DynamicInput({ type, config, value, onChange, onExtraChange, readOnly, toolId}: DynamicInputProps) {

if (type === 'supplier_manager') {
    return (
      <SupplierManager 
        value={value as string | null} 
        onChange={onChange} 
        toolId={toolId || ''} 
        readOnly={readOnly} 
      />
    )
  }
  
  if (type === 'text' || type === 'number') {
    const stringValue = (value === null || value === undefined || Array.isArray(value)) ? '' : value.toString()
    return (
      <DebouncedInput // 🛠️ Utilizzo del componente debounced
        type={type} 
        placeholder={config.placeholder}
        value={stringValue} 
        onChange={onChange} 
        className={cn("focus-visible:ring-[#967635]", readOnly && "bg-slate-50 text-slate-600")}
        readOnly={readOnly} 
      />
    )
  }

  if (type === 'date_range') {
    const current =
      value && !Array.isArray(value) && typeof value === 'object'
        ? (value as { start?: string | null; end?: string | null })
        : { start: '', end: '' }

    const handleChange = (field: 'start' | 'end', val: string) => {
      const next = { start: current.start || '', end: current.end || '' }
      next[field] = val || ''
      onChange(next as AnswerValue)
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {config.placeholder || 'Data di inizio'}
            </label>
            <Input
              type="date"
              value={current.start || ''}
              onChange={(e) => handleChange('start', e.target.value)}
              className={cn("focus-visible:ring-[#967635]", readOnly && "bg-slate-50 text-slate-600")}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Data di fine
            </label>
            <Input
              type="date"
              value={current.end || ''}
              onChange={(e) => handleChange('end', e.target.value)}
              className={cn("focus-visible:ring-[#967635]", readOnly && "bg-slate-50 text-slate-600")}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'select') {
    const stringValue = (value === null || value === undefined || Array.isArray(value)) ? undefined : value.toString()
    const options = config.options as { label: string; value: string }[] | undefined

    return (
      <Select 
        value={stringValue} 
        onValueChange={onChange}
        disabled={readOnly}
      >
        <SelectTrigger className="focus:ring-[#967635] bg-white">
          <SelectValue placeholder={config.placeholder || "Seleziona..."} />
        </SelectTrigger>
        <SelectContent>
          {options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (type === 'async_select') {
    return (
      <AsyncSelect
        config={config}
        value={value}
        onChange={onChange}
        onExtraChange={onExtraChange}
        readOnly={readOnly}
        toolId={toolId}
      />
    )
  }

  if (type === 'repeater') {
    return (
      <RepeaterInput
        config={config}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        toolId={toolId}
      />
    )
  }

  return <div className="text-red-500 text-xs">Tipo non supportato: {type}</div>
}

// ----------------------------------------------------
// REPEATER INPUT
// ----------------------------------------------------
interface RepeaterInputProps {
    config: RepeaterConfig
    value: AnswerValue
    onChange: (v: Record<string, unknown>[]) => void
    readOnly?: boolean
    toolId?: string
}

function RepeaterInput({ config, value, onChange, readOnly, toolId }: RepeaterInputProps) {
    const items: Record<string, unknown>[] = Array.isArray(value) ? value : []
    const maxItems = config.max_items || 10
    const itemLabel = config.item_label || "Elemento"

    const handleAdd = () => {
        if (items.length < maxItems) onChange([...items, {}])
    }

    const handleRemove = (index: number) => {
        const newItems = [...items]
        newItems.splice(index, 1)
        onChange(newItems)
    }

    const handleFieldChange = (index: number, fieldName: string, val: AnswerValue) => {
        const newItems = [...items]
        newItems[index] = { ...newItems[index], [fieldName]: val }
        onChange(newItems)
    }

    return (
        <div className="w-full flex flex-col gap-8">
            {items.map((item, index) => (
                <div key={index} className="relative flex flex-col gap-6 p-6 md:p-8 bg-slate-50/60 border border-slate-200 rounded-xl shadow-sm">
                    
                    <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#967635] text-xs font-bold text-white shadow-sm">
                                {index + 1}
                            </span>
                            <h4 className="font-bold text-slate-800 text-base uppercase tracking-wider">{itemLabel} {index + 1}</h4>
                        </div>
                        {!readOnly && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleRemove(index)} 
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4 md:mr-2" /> 
                                <span className="hidden md:inline">Rimuovi</span>
                            </Button>
                        )}
                    </div>
                    
                    <div className="flex flex-col gap-4">
                        {config.fields?.map((field) => {
                            const isFieldAnswered = item[field.name] !== undefined && item[field.name] !== null && item[field.name] !== '';
                            
                            return (
                                <div key={field.name} className={cn(
                                    "grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white p-4 md:p-5 rounded-lg border transition-all",
                                    isFieldAnswered ? "border-amber-200 shadow-sm" : "border-slate-100"
                                )}>
                                    
                                    <div className="md:col-span-5 flex gap-3">
                                        <div className="mt-0.5 flex-shrink-0">
                                            {isFieldAnswered ? (
                                                <CheckCircle2 className="w-5 h-5 text-[#967635]" />
                                            ) : (
                                                <Circle className="w-5 h-5 text-slate-300" />
                                            )}
                                        </div>
                                        <label className="text-sm font-semibold text-slate-800 leading-snug">
                                            {field.label}
                                        </label>
                                    </div>

                                    <div className="md:col-span-7">
                                        <DynamicInput
                                            type={field.type}
                                            config={field.config as RepeaterConfig} 
                                            value={(item[field.name] as AnswerValue) || null}
                                            onChange={(val) => handleFieldChange(index, field.name, val)}
                                            readOnly={readOnly}
                                            toolId={toolId}
                                        />
                                    </div>

                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}

            {!readOnly && items.length < maxItems && (
                <div className="flex justify-center pt-2">
                    <Button 
                        variant="outline" 
                        onClick={handleAdd} 
                        className="text-sm font-semibold text-[#967635] border-[#967635]/30 hover:border-[#967635] hover:bg-amber-50 px-6 py-5 rounded-full shadow-sm transition-all"
                    >
                        <Plus className="w-5 h-5 mr-2" /> Aggiungi {itemLabel.toLowerCase()}
                    </Button>
                </div>
            )}
            
            {!readOnly && items.length >= maxItems && (
                <p className="text-sm font-medium text-center text-amber-600 bg-amber-50 py-3 rounded-lg border border-amber-100">
                    Hai raggiunto il limite massimo di {maxItems} {itemLabel.toLowerCase()}.
                </p>
            )}
        </div>
    )
}

// ----------------------------------------------------
// ASYNC SELECT
// ----------------------------------------------------
interface AsyncSelectProps {
    config: QuestionConfig & { source_extra_cols?: string[], is_multi?: boolean, max_selections?: number } 
    value: AnswerValue 
    onChange: (val: string) => void 
    onExtraChange?: (extraData: Record<string, unknown> | null) => void 
    readOnly?: boolean
    toolId?: string
}

function AsyncSelect({ config, value, onChange, onExtraChange, readOnly, toolId }: AsyncSelectProps) {
    const [open, setOpen] = useState(false)
    const [options, setOptions] = useState<{label: string, value: string, extra?: Record<string, unknown>}[]>([])
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
      () => (isMulti ? (safeValueString ? safeValueString.split(',') : []) : (safeValueString ? [safeValueString] : [])),
      [isMulti, safeValueString]
    )
    const selectedValuesKey = useMemo(() => selectedValues.join(','), [selectedValues])

    const dedupeAppend = useCallback((prev: typeof options, next: typeof options) => {
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

    const loadPage = useCallback(async (args: { reset: boolean; cursorOverride?: number | null }) => {
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
          table: config.source_table!,
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
        console.error("Errore caricamento opzioni:", error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    }, [
      config.source_table,
      config.source_label_col,
      config.source_value_col,
      config.source_extra_cols,
      query,
      dedupeAppend,
    ])

    useEffect(() => {
        const hasSavedValue = safeValueString !== ''
        if (!open && !hasSavedValue) return
        if (!config.source_table) return
        // Always reset paging when opened, so large tables can be fully browsed.
        setOptions([])
        setCursor(0)
        setHasMore(true)
        hydratedRef.current = false
        void loadPage({ reset: true, cursorOverride: 0 })
    }, [open, safeValueString, config.source_table, config.source_label_col, config.source_value_col, config.source_extra_cols, loadPage]) 

    useEffect(() => {
        if (options.length > 0 && selectedValues.length > 0 && !hydratedRef.current && !isMulti) {
            const selectedOpt = options.find(o => o.value === selectedValues[0])
            if (selectedOpt && selectedOpt.extra && onExtraChange) {
                onExtraChange(selectedOpt.extra)
            }
            hydratedRef.current = true
        }
    }, [options, selectedValues, onExtraChange, isMulti])

    useEffect(() => {
      // Ensure pre-populated values always show labels (even if not in the first loaded page).
      if (!config.source_table) return
      if (selectedValues.length === 0) return

      const missing = selectedValues.filter((id) => !options.some((o) => o.value === id))
      if (missing.length === 0) return

      let mounted = true
      ;(async () => {
        try {
          const resolved = await fetchDynamicOptionsByIds({
            table: config.source_table!,
            labelCol: config.source_label_col || 'name',
            valueCol: config.source_value_col || 'id',
            extraCols: config.source_extra_cols,
            ids: missing,
            toolId,
          })
          if (!mounted || resolved.length === 0) return
          // Prepend resolved items so the current selection can immediately display.
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
      // selectedValues depends on safeValueString; include both for stability.
      safeValueString,
      selectedValues,
      selectedValuesKey,
      options,
      toolId,
      dedupeAppend,
    ])

    useEffect(() => {
      if (!open) return
      // Debounce search so we don't hammer the server while typing.
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

    const selectedLabels = selectedValues.map(v => options.find(o => o.value === v)?.label || v)
    const displayLabel = selectedLabels.length > 0 ? selectedLabels.join(', ') : (config.placeholder || "Cerca...")

    return (
        <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <Button 
                variant="outline" 
                role="combobox" 
                aria-expanded={open} 
                className={cn("w-full justify-between overflow-hidden bg-white hover:bg-slate-50", readOnly && "opacity-80 bg-slate-50")}
                disabled={readOnly} 
            >
                <span className="truncate flex-1 text-left mr-2 font-normal text-slate-700">
                    {loading && selectedValues.length > 0 ? "Caricamento nome..." : displayLabel}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] md:w-[400px] p-0">
            <Command>
            <CommandInput
              placeholder="Cerca..."
              value={query}
              onValueChange={(v) => setQuery(v)}
            />
            <CommandList
              onScroll={(e) => {
                const el = e.currentTarget
                const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
                if (!nearBottom) return
                if (loading || loadingMore) return
                if (!hasMore) return
                void loadPage({ reset: false, cursorOverride: cursor })
              }}
            >
                {loading && <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2"/>Caricamento...</div>}
                {!loading && options.length === 0 && <CommandEmpty>Nessun risultato.</CommandEmpty>}
                <CommandGroup>
                {options.map((option) => {
                    const isSelected = selectedValues.includes(option.value)
                    return (
                        <CommandItem
                            key={option.value}
                            value={option.label}
                            onSelect={() => {
                                if (isMulti) {
                                    if (!isSelected && maxSelections && selectedValues.length >= maxSelections) {
                                        toast.warning(`Puoi selezionare al massimo ${maxSelections} paesi per questa specie.`);
                                        return;
                                    }

                                    const newVals = isSelected 
                                        ? selectedValues.filter(v => v !== option.value) 
                                        : [...selectedValues, option.value]
                                    onChange(newVals.join(','))
                                } else {
                                    onChange(option.value)
                                    if (onExtraChange) onExtraChange(option.extra || null)
                                    setOpen(false)
                                }
                            }}
                        >
                            {isMulti ? (
                                <div className={cn(
                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                    isSelected ? "bg-[#967635] border-[#967635] text-white" : "border-slate-300 opacity-50 [&_svg]:invisible"
                                )}>
                                    <Check className={cn("h-3 w-3")} />
                                </div>
                            ) : (
                                <Check className={cn("mr-2 h-4 w-4 text-[#967635]", isSelected ? "opacity-100" : "opacity-0")} />
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