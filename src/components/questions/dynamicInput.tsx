'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, CheckCircle2, Circle, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { QuestionConfig, QuestionType, AnswerValue } from "@/types/questions"
import { AsyncSelect } from "@/components/shared/AsyncSelect"
import { toast } from "sonner" 
import { SupplierManager } from "./SupplierManager"
import { normalizeQuestionType, isYearValuesQuestionType } from "@/lib/question-type-utils"
import { YearValuesInput } from "./YearValuesInput"

import type { YearValueField } from "@/lib/year-values"

export type { AnswerValue }

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

export type YearValuesConfig = QuestionConfig & {
  fields?: YearValueField[]
}

interface DynamicInputProps {
  type: string
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

function DebouncedTextarea({
  value,
  onChange,
  placeholder,
  readOnly,
  className,
}: {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
}) {
  const [localValue, setLocalValue] = useState(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { setLocalValue(value) }, [value])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChangeRef.current(String(localValue))
      }
    }, 400)
    return () => clearTimeout(handler)
  }, [localValue, value])

  return (
    <textarea
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      className={cn(
        "flex min-h-[100px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#967635]",
        readOnly && "bg-slate-50 text-slate-600",
        className
      )}
      disabled={readOnly}
    />
  )
}

interface StaticMultiSelectProps {
  options: { label: string; value: string }[]
  value: AnswerValue
  onChange: (val: string) => void
  placeholder?: string
  readOnly?: boolean
}

function StaticMultiSelect({ options, value, onChange, placeholder, readOnly }: StaticMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const safeValueString = value === null || value === undefined || Array.isArray(value)
    ? ''
    : String(value)
  const selectedValues = safeValueString
    ? safeValueString.split(',').map((v) => v.trim()).filter(Boolean)
    : []

  const selectedLabels = selectedValues.map(
    (v) => options.find((o) => o.value === v)?.label || v
  )
  const displayLabel = selectedLabels.length > 0
    ? selectedLabels.join(', ')
    : (placeholder || 'Seleziona...')

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
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] md:w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Cerca..." />
          <CommandList>
            <CommandEmpty>Nessun risultato.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      const newVals = isSelected
                        ? selectedValues.filter((v) => v !== option.value)
                        : [...selectedValues, option.value]
                      onChange(newVals.join(','))
                    }}
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                      isSelected ? "bg-[#967635] border-[#967635] text-white" : "border-slate-300 opacity-50 [&_svg]:invisible"
                    )}>
                      <Check className="h-3 w-3" />
                    </div>
                    <span className="break-words line-clamp-2">{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function DynamicInput({ type, config, value, onChange, onExtraChange, readOnly, toolId}: DynamicInputProps) {
  const normalizedType = normalizeQuestionType(type)

  if (normalizedType === 'supplier_manager') {
    return (
      <SupplierManager 
        value={value as string | null} 
        onChange={onChange} 
        toolId={toolId || ''} 
        readOnly={readOnly} 
      />
    )
  }
  
  if (normalizedType === 'text' || normalizedType === 'number') {
    const stringValue = (value === null || value === undefined || Array.isArray(value)) ? '' : value.toString()
    if (normalizedType === 'text' && config.multiline === true) {
      return (
        <DebouncedTextarea
          placeholder={config.placeholder}
          value={stringValue}
          onChange={onChange}
          className={cn(readOnly && 'bg-slate-50 text-slate-600')}
          readOnly={readOnly}
        />
      )
    }
    return (
      <DebouncedInput
        type={normalizedType === 'number' ? 'number' : 'text'} 
        placeholder={config.placeholder}
        value={stringValue} 
        onChange={onChange} 
        className={cn("focus-visible:ring-[#967635]", readOnly && "bg-slate-50 text-slate-600")}
        readOnly={readOnly} 
      />
    )
  }

  if (normalizedType === 'date_range') {
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

  if (isYearValuesQuestionType(type)) {
    return (
      <YearValuesInput
        config={config as YearValuesConfig}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    )
  }

  if (normalizedType === "select") {
    const stringValue = (value === null || value === undefined || Array.isArray(value)) ? undefined : value.toString()
    const options = config.options as { label: string; value: string }[] | undefined

    if (config.is_multi === true && options?.length) {
      return (
        <StaticMultiSelect
          options={options}
          value={value}
          onChange={onChange}
          placeholder={config.placeholder}
          readOnly={readOnly}
        />
      )
    }

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

  if (normalizedType === 'async_select') {
    const asyncValue =
      value === null || value === undefined
        ? null
        : Array.isArray(value)
          ? value.join(',')
          : String(value)

    return (
      <AsyncSelect
        config={config}
        value={asyncValue}
        onChange={onChange}
        onExtraChange={onExtraChange}
        readOnly={readOnly}
        toolId={toolId}
      />
    )
  }

  if (normalizedType === 'repeater') {
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

  return (
    <div className="text-red-500 text-xs">
      Tipo non supportato: {type || "(vuoto)"}
      {normalizedType && normalizedType !== String(type ?? "").trim() ? ` (normalizzato: ${normalizedType})` : ""}
    </div>
  )
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

// NOTE: AsyncSelect lives in @/components/shared/AsyncSelect (used by Timber/EUDR/FSC).