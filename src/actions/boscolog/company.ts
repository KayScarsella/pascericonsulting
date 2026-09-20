'use server'

import { BOSCOLOG_TOOL_ID } from '@/lib/constants'
import { sanitizeDocumentFileName } from '@/lib/documents-upload'
import { getToolAccess } from '@/lib/tool-auth'
import type {
  BoscologCompany,
  BoscologCompanyInput,
  BoscologCompanyMember,
} from '@/types/boscolog'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const LOGO_MAX_BYTES = 200 * 1024
const LOGO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export type BoscologCompanyContextResult = {
  success: boolean
  needsSetup?: boolean
  company?: BoscologCompany | null
  canEdit?: boolean
  membership?: BoscologCompanyMember | null
  logoUrl?: string | null
  error?: string
}

async function resolveCompanyId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data, error } = await supabase.rpc('boscolog_current_user_company_id', {
    _tool_id: BOSCOLOG_TOOL_ID,
  })
  if (error) {
    console.error('boscolog_current_user_company_id:', error)
    return null
  }
  return (data as string | null) ?? null
}

async function signedLogoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  logoPath: string | null | undefined
): Promise<string | null> {
  if (!logoPath) return null
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(logoPath, 3600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function getBoscologCompanyContext(): Promise<BoscologCompanyContextResult> {
  const { userId, role } = await getToolAccess(BOSCOLOG_TOOL_ID)
  const supabase = await createClient()

  const companyId = await resolveCompanyId(supabase)
  if (!companyId) {
    return { success: true, needsSetup: true, company: null, canEdit: false }
  }

  const { data: company, error: companyError } = await supabase
    .from('boscolog_companies')
    .select('*')
    .eq('id', companyId)
    .eq('tool_id', BOSCOLOG_TOOL_ID)
    .single()

  if (companyError || !company) {
    return { success: true, needsSetup: true, company: null, canEdit: false }
  }

  const { data: membership } = await supabase
    .from('boscolog_company_members')
    .select('*')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()

  const canEdit = role === 'admin' || membership?.can_edit === true
  const logoUrl = await signedLogoUrl(supabase, company.logo_path)

  return {
    success: true,
    needsSetup: false,
    company: company as BoscologCompany,
    membership: (membership as BoscologCompanyMember | null) ?? null,
    canEdit,
    logoUrl,
  }
}

export async function createBoscologCompany(
  input: BoscologCompanyInput
): Promise<{ success: boolean; companyId?: string; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)

  const name = input.name?.trim()
  if (!name) {
    return { success: false, error: 'Inserisci la ragione sociale.' }
  }

  const supabase = await createClient()
  const { data: companyId, error } = await supabase.rpc('boscolog_create_company_for_user', {
    _tool_id: BOSCOLOG_TOOL_ID,
    _name: name,
    _vat: input.vat?.trim() || null,
    _cf: input.cf?.trim() || null,
    _address: input.address?.trim() || null,
    _city: input.city?.trim() || null,
    _province: input.province?.trim() || null,
    _cap: input.cap?.trim() || null,
    _phone: input.phone?.trim() || null,
    _email: input.email?.trim() || null,
    _pec: input.pec?.trim() || null,
    _rea: input.rea?.trim() || null,
    _legal_rep: input.legal_rep?.trim() || null,
  })

  if (error || !companyId) {
    return { success: false, error: error?.message ?? 'Creazione impresa fallita' }
  }

  revalidatePath('/boscolog')
  revalidatePath('/boscolog/azienda')
  revalidatePath('/boscolog/anagrafiche')
  return { success: true, companyId: companyId as string }
}

export async function updateBoscologCompany(
  companyId: string,
  input: BoscologCompanyInput
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)

  const name = input.name?.trim()
  if (!name) {
    return { success: false, error: 'Inserisci la ragione sociale.' }
  }

  const ctx = await getBoscologCompanyContext()
  if (!ctx.success || ctx.needsSetup || ctx.company?.id !== companyId || !ctx.canEdit) {
    return { success: false, error: 'Non autorizzato a modificare questa impresa' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('boscolog_companies')
    .update({
      name,
      vat: input.vat?.trim() || null,
      cf: input.cf?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      cap: input.cap?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      pec: input.pec?.trim() || null,
      rea: input.rea?.trim() || null,
      legal_rep: input.legal_rep?.trim() || null,
    })
    .eq('id', companyId)
    .eq('tool_id', BOSCOLOG_TOOL_ID)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/boscolog/azienda')
  return { success: true }
}

export async function uploadBoscologCompanyLogo(
  companyId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)

  const ctx = await getBoscologCompanyContext()
  if (!ctx.success || ctx.company?.id !== companyId || !ctx.canEdit) {
    return { success: false, error: 'Non autorizzato' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) {
    return { success: false, error: 'Seleziona un file immagine' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { success: false, error: 'Il logo deve essere inferiore a 200KB' }
  }
  if (file.type && !LOGO_MIME.includes(file.type as (typeof LOGO_MIME)[number])) {
    return { success: false, error: 'Formato non supportato (JPEG, PNG, WebP, GIF)' }
  }

  const supabase = await createClient()
  const path = `${BOSCOLOG_TOOL_ID}/${companyId}/logo/${Date.now()}_${sanitizeDocumentFileName(file.name)}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage.from('documents').upload(path, buffer, {
    contentType: file.type || 'image/png',
    upsert: false,
  })
  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  const prevPath = ctx.company.logo_path
  const { error: updateError } = await supabase
    .from('boscolog_companies')
    .update({ logo_path: path })
    .eq('id', companyId)
    .eq('tool_id', BOSCOLOG_TOOL_ID)

  if (updateError) {
    await supabase.storage.from('documents').remove([path])
    return { success: false, error: updateError.message }
  }

  if (prevPath && prevPath !== path) {
    await supabase.storage.from('documents').remove([prevPath])
  }

  revalidatePath('/boscolog/azienda')
  return { success: true }
}

export async function removeBoscologCompanyLogo(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)

  const ctx = await getBoscologCompanyContext()
  if (!ctx.success || ctx.company?.id !== companyId || !ctx.canEdit) {
    return { success: false, error: 'Non autorizzato' }
  }

  const prevPath = ctx.company.logo_path
  const supabase = await createClient()
  const { error } = await supabase
    .from('boscolog_companies')
    .update({ logo_path: null })
    .eq('id', companyId)
    .eq('tool_id', BOSCOLOG_TOOL_ID)

  if (error) {
    return { success: false, error: error.message }
  }

  if (prevPath) {
    await supabase.storage.from('documents').remove([prevPath])
  }

  revalidatePath('/boscolog/azienda')
  return { success: true }
}
