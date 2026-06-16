'use server'

import { getCurrentFscCompany } from '@/actions/fsc/company'
import { copyFscIloUserResponses } from '@/actions/fsc/ilo-responses'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FSC_ILO_PATH, fscIloEditPath } from '@/lib/fsc/constants'
import { createFscDocumentSignedUrls } from '@/lib/fsc/documents-download'
import {
  FSC_DOCUMENT_ALLOWED_MIME_TYPES,
  FSC_DOCUMENT_MAX_FILE_SIZE,
  validateFscDocumentFileMetadata,
} from '@/lib/fsc/documents-upload'
import { buildLegacyMigrationPayloads, hasLegacyFormData } from '@/lib/fsc/ilo/legacy-migrate'
import { FSC_ILO_GROUP_NAME } from '@/lib/fsc/ilo/question-ids'
import { mergeFscIloFormData } from '@/lib/fsc/ilo/schema.v1'
import {
  buildFscIloCompiledDocPath,
  buildFscIloCompiledPdfPath,
  FSC_ILO_SCHEMA_VERSION,
} from '@/lib/fsc/ilo/storage-paths'
import { getFscIloStatus } from '@/lib/fsc/ilo/status'
import {
  loadTaggedIloTemplateBuffer,
  renderFscIloWordFromResponses,
} from '@/lib/fsc/ilo/word-export'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscIloAssessment } from '@/types/fsc'
import type { TablesInsert } from '@/types/supabase'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const FSC_BUCKET = 'fsc-documents'
const ILO_MIN_YEAR = 2000

function revalidateIloPaths(referenceYear?: number): void {
  revalidatePath(FSC_ILO_PATH)
  if (referenceYear != null) {
    revalidatePath(fscIloEditPath(referenceYear))
  }
}

type EditorContext = {
  companyId: string
  userId: string
  canEdit: boolean
}

export type FscIloAssessmentWithStatus = FscIloAssessment & {
  status: ReturnType<typeof getFscIloStatus>
  compiled_doc_url?: string | null
  compiled_pdf_url?: string | null
}

async function requireFscContext(): Promise<
  { success: true; data: EditorContext } | { success: false; error: string }
> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const ctx = await getCurrentFscCompany()
  if (!ctx.success || !ctx.data) {
    return { success: false, error: ctx.error ?? 'Impresa FSC non disponibile' }
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return { success: false, error: 'Utente non autenticato' }
  }

  return {
    success: true,
    data: {
      companyId: ctx.data.company.id,
      userId: userData.user.id,
      canEdit: ctx.data.membership.can_edit,
    },
  }
}

function assertCanEdit(ctx: EditorContext): string | null {
  if (!ctx.canEdit) return 'Permesso di modifica non disponibile'
  return null
}

function validateYear(year: number): string | null {
  const maxYear = new Date().getFullYear() + 1
  if (!Number.isInteger(year) || year < ILO_MIN_YEAR || year > maxYear) {
    return `Anno non valido (${ILO_MIN_YEAR}–${maxYear})`
  }
  return null
}

async function getAssessmentRow(
  companyId: string,
  referenceYear: number
): Promise<FscIloAssessment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_ilo_assessments')
    .select('*')
    .eq('company_id', companyId)
    .eq('reference_year', referenceYear)
    .maybeSingle()

  if (error) {
    console.error('getAssessmentRow:', error)
    return null
  }
  return data as FscIloAssessment | null
}

async function sessionHasResponses(sessionId: string | null): Promise<boolean> {
  if (!sessionId) return false
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('user_responses')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  if (error) return false
  return (count ?? 0) > 0
}

async function createIloSession(
  userId: string,
  companyId: string,
  referenceYear: number
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assessment_sessions')
    .insert({
      user_id: userId,
      tool_id: CLOUD_FSC_TOOL_ID,
      session_type: 'ilo',
      status: 'in_progress',
      metadata: { company_id: companyId, reference_year: referenceYear },
    })
    .select('id')
    .single()

  if (error) {
    console.error('createIloSession:', error)
    return null
  }
  return data.id
}

async function ensureAssessmentSession(
  assessment: FscIloAssessment,
  userId: string
): Promise<FscIloAssessment> {
  if (assessment.session_id) return assessment

  const sessionId = await createIloSession(userId, assessment.company_id, assessment.reference_year)
  if (!sessionId) return assessment

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_ilo_assessments')
    .update({ session_id: sessionId })
    .eq('id', assessment.id)
    .select('*')
    .single()

  if (error || !data) return { ...assessment, session_id: sessionId }
  return data as FscIloAssessment
}

async function migrateLegacyFormDataIfNeeded(
  assessment: FscIloAssessment,
  sessionOwnerId: string
): Promise<void> {
  if (!assessment.session_id) return
  if (!(await sessionHasResponses(assessment.session_id)) && hasLegacyFormData(assessment.form_data)) {
    const payloads = buildLegacyMigrationPayloads(assessment.form_data).map((p) => ({
      ...p,
      user_id: sessionOwnerId,
      tool_id: CLOUD_FSC_TOOL_ID,
      session_id: assessment.session_id!,
    })) as TablesInsert<'user_responses'>[]

    if (payloads.length > 0) {
      const supabase = await createClient()
      await supabase.from('user_responses').upsert(payloads, { onConflict: 'session_id, question_id' })
    }
  }
}

async function attachSignedUrls(
  assessment: FscIloAssessment,
  userId: string
): Promise<FscIloAssessmentWithStatus> {
  const withSession = await ensureAssessmentSession(assessment, userId)
  const supabase = await createClient()

  if (withSession.session_id) {
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('user_id')
      .eq('id', withSession.session_id)
      .single()
    if (session?.user_id) {
      await migrateLegacyFormDataIfNeeded(withSession, session.user_id)
    }
  }

  const paths = [withSession.compiled_doc_path, withSession.compiled_pdf_path].filter(
    Boolean
  ) as string[]
  const urls = await createFscDocumentSignedUrls(supabase, paths)
  const hasResponses = await sessionHasResponses(withSession.session_id)
  const hasLegacy = hasLegacyFormData(withSession.form_data)

  return {
    ...withSession,
    form_data: mergeFscIloFormData(withSession.form_data as Record<string, unknown>),
    status: getFscIloStatus(withSession.completed_at, hasResponses || hasLegacy),
    compiled_doc_url: withSession.compiled_doc_path
      ? (urls[withSession.compiled_doc_path] ?? null)
      : null,
    compiled_pdf_url: withSession.compiled_pdf_path
      ? (urls[withSession.compiled_pdf_path] ?? null)
      : null,
  }
}

export async function listFscIloAssessments(): Promise<FscIloAssessmentWithStatus[]> {
  const ctx = await requireFscContext()
  if (!ctx.success) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_ilo_assessments')
    .select('*')
    .eq('company_id', ctx.data.companyId)
    .order('reference_year', { ascending: false })

  if (error) {
    console.error('listFscIloAssessments:', error)
    return []
  }

  return Promise.all(
    (data as FscIloAssessment[]).map((row) => attachSignedUrls(row, ctx.data.userId))
  )
}

export async function getFscIloAssessment(
  referenceYear: number
): Promise<{ success: boolean; data?: FscIloAssessmentWithStatus; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const yearError = validateYear(referenceYear)
  if (yearError) return { success: false, error: yearError }

  const row = await getAssessmentRow(ctx.data.companyId, referenceYear)
  if (!row) return { success: false, error: 'Autovalutazione non trovata' }

  return { success: true, data: await attachSignedUrls(row, ctx.data.userId) }
}

export async function createFscIloAssessment(
  referenceYear: number,
  _prefillFromCompany = true
): Promise<{
  success: boolean
  data?: FscIloAssessmentWithStatus
  error?: string
  created?: boolean
}> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const yearError = validateYear(referenceYear)
  if (yearError) return { success: false, error: yearError }

  const existing = await getAssessmentRow(ctx.data.companyId, referenceYear)
  if (existing) {
    return {
      success: true,
      created: false,
      data: await attachSignedUrls(existing, ctx.data.userId),
    }
  }

  const sessionId = await createIloSession(ctx.data.userId, ctx.data.companyId, referenceYear)
  if (!sessionId) {
    return { success: false, error: 'Impossibile creare la sessione autovalutazione' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_ilo_assessments')
    .insert({
      company_id: ctx.data.companyId,
      reference_year: referenceYear,
      session_id: sessionId,
      form_data: {},
      schema_version: FSC_ILO_SCHEMA_VERSION,
    })
    .select('*')
    .single()

  if (error) {
    console.error('createFscIloAssessment:', error)
    return { success: false, error: error.message }
  }

  revalidateIloPaths(referenceYear)
  return {
    success: true,
    created: true,
    data: await attachSignedUrls(data as FscIloAssessment, ctx.data.userId),
  }
}

export async function deleteFscIloAssessment(
  referenceYear: number
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const yearError = validateYear(referenceYear)
  if (yearError) return { success: false, error: yearError }

  const row = await getAssessmentRow(ctx.data.companyId, referenceYear)
  if (!row) return { success: true }

  const supabase = await createClient()
  const sessionId = row.session_id

  const storagePaths = [
    row.compiled_doc_path,
    row.compiled_pdf_path,
    row.template_storage_path,
  ].filter(Boolean) as string[]

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(FSC_BUCKET)
      .remove(storagePaths)
    if (storageError) {
      console.error('deleteFscIloAssessment storage:', storageError)
      return { success: false, error: storageError.message }
    }
  }

  if (sessionId) {
    const { error: deleteSessionError } = await supabase
      .from('assessment_sessions')
      .delete()
      .eq('id', sessionId)

    if (deleteSessionError) {
      return { success: false, error: deleteSessionError.message }
    }
  }

  const { error: deleteAssessmentError } = await supabase
    .from('fsc_ilo_assessments')
    .delete()
    .eq('id', row.id)
    .eq('company_id', ctx.data.companyId)

  if (deleteAssessmentError) {
    return { success: false, error: deleteAssessmentError.message }
  }

  revalidateIloPaths(referenceYear)
  revalidatePath('/cloud-fsc')
  return { success: true }
}

/** @deprecated Responses are saved via SectionList + saveFscIloResponsesBulk */
export async function saveFscIloFormDraft(
  referenceYear: number,
  _formData: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const created = await createFscIloAssessment(referenceYear, false)
  if (!created.success) return { success: false, error: created.error }
  return { success: true }
}

export async function duplicateFscIloFromYear(
  sourceYear: number,
  targetYear: number
): Promise<{ success: boolean; data?: FscIloAssessmentWithStatus; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  if (sourceYear === targetYear) {
    return { success: false, error: 'Anno sorgente e destinazione devono essere diversi' }
  }

  const sourceError = validateYear(sourceYear)
  const targetError = validateYear(targetYear)
  if (sourceError) return { success: false, error: sourceError }
  if (targetError) return { success: false, error: targetError }

  const source = await getAssessmentRow(ctx.data.companyId, sourceYear)
  if (!source) {
    return { success: false, error: `Nessuna autovalutazione trovata per il ${sourceYear}` }
  }

  const sourceWithSession = await ensureAssessmentSession(source, ctx.data.userId)
  if (!sourceWithSession.session_id) {
    return { success: false, error: 'Sessione sorgente non disponibile' }
  }

  let target = await getAssessmentRow(ctx.data.companyId, targetYear)
  if (!target) {
    const created = await createFscIloAssessment(targetYear, false)
    if (!created.success || !created.data) {
      return { success: false, error: created.error ?? 'Impossibile creare autovalutazione destinazione' }
    }
    target = created.data
  }

  const targetWithSession = await ensureAssessmentSession(target, ctx.data.userId)
  if (!targetWithSession.session_id) {
    return { success: false, error: 'Sessione destinazione non disponibile' }
  }

  const supabase = await createClient()
  const { data: targetSession } = await supabase
    .from('assessment_sessions')
    .select('user_id')
    .eq('id', targetWithSession.session_id)
    .single()

  if (!targetSession?.user_id) {
    return { success: false, error: 'Sessione destinazione non valida' }
  }

  const copied = await copyFscIloUserResponses(
    sourceWithSession.session_id,
    targetWithSession.session_id,
    targetSession.user_id
  )
  if (!copied.success) {
    return { success: false, error: copied.error ?? 'Copia risposte fallita' }
  }

  const { data, error } = await supabase
    .from('fsc_ilo_assessments')
    .update({
      duplicated_from_year: sourceYear,
      completed_at: null,
      compiled_doc_path: null,
      compiled_pdf_path: null,
      compiled_word_uploaded_at: null,
    })
    .eq('id', targetWithSession.id)
    .select('*')
    .single()

  // Clear attestor_date via user_responses if present
  await supabase
    .from('user_responses')
    .delete()
    .eq('session_id', targetWithSession.session_id)
    .eq('question_id', 'b0200001-0001-4000-8000-000000000002')

  if (error) return { success: false, error: error.message }

  revalidateIloPaths(targetYear)
  return {
    success: true,
    data: await attachSignedUrls(data as FscIloAssessment, ctx.data.userId),
  }
}

export async function exportFscIloWord(
  referenceYear: number
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const yearError = validateYear(referenceYear)
  if (yearError) return { success: false, error: yearError }

  let row = await getAssessmentRow(ctx.data.companyId, referenceYear)
  if (!row) return { success: false, error: 'Autovalutazione non trovata' }

  row = await ensureAssessmentSession(row, ctx.data.userId)
  if (!row.session_id) return { success: false, error: 'Sessione non disponibile' }

  const supabase = await createClient()
  const [{ data: questions }, { data: responses }] = await Promise.all([
    supabase
      .from('questions')
      .select('id, type, config, section_id')
      .in(
        'section_id',
        (
          await supabase
            .from('sections')
            .select('id')
            .eq('tool_id', CLOUD_FSC_TOOL_ID)
            .eq('group_name', FSC_ILO_GROUP_NAME)
        ).data?.map((s) => s.id) ?? []
      ),
    supabase.from('user_responses').select('question_id, answer_text, answer_json').eq('session_id', row.session_id),
  ])

  try {
    const templateBuffer = loadTaggedIloTemplateBuffer()
    const output = renderFscIloWordFromResponses(
      templateBuffer,
      questions ?? [],
      responses ?? [],
      referenceYear
    )

    const storagePath = buildFscIloCompiledDocPath(ctx.data.companyId, referenceYear)
    const { error: pathError } = await supabase
      .from('fsc_ilo_assessments')
      .update({
        compiled_doc_path: storagePath,
        compiled_word_uploaded_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', ctx.data.companyId)

    if (pathError) return { success: false, error: pathError.message }

    const { error: uploadError } = await supabase.storage
      .from(FSC_BUCKET)
      .upload(storagePath, output, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      })

    if (uploadError) return { success: false, error: uploadError.message }

    const urls = await createFscDocumentSignedUrls(supabase, [storagePath])
    revalidateIloPaths(referenceYear)
    return { success: true, downloadUrl: urls[storagePath] }
  } catch (e) {
    console.error('exportFscIloWord:', e)
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Errore generazione Word',
    }
  }
}

export type PrepareFscIloUploadInput = {
  referenceYear: number
  fileKind: 'word' | 'pdf'
  fileName: string
  fileSize: number
  mimeType: string
}

export async function prepareFscIloFileUpload(
  input: PrepareFscIloUploadInput
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const yearError = validateYear(input.referenceYear)
  if (yearError) return { success: false, error: yearError }

  const allowedMimes =
    input.fileKind === 'pdf'
      ? (['application/pdf'] as const)
      : ([
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ] as const)

  const validationError = validateFscIloFileMetadata({
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    allowedMimes,
  })
  if (validationError) return { success: false, error: validationError }

  let row = await getAssessmentRow(ctx.data.companyId, input.referenceYear)
  if (!row) {
    const created = await createFscIloAssessment(input.referenceYear, false)
    if (!created.success) return { success: false, error: created.error }
    row = await getAssessmentRow(ctx.data.companyId, input.referenceYear)
    if (!row) return { success: false, error: 'Autovalutazione non trovata' }
  }

  const storagePath =
    input.fileKind === 'pdf'
      ? buildFscIloCompiledPdfPath(ctx.data.companyId, input.referenceYear, input.fileName)
      : buildFscIloCompiledDocPath(ctx.data.companyId, input.referenceYear, input.fileName)

  const updatePayload =
    input.fileKind === 'pdf'
      ? { compiled_pdf_path: storagePath }
      : {
          compiled_doc_path: storagePath,
          compiled_word_uploaded_at: new Date().toISOString(),
        }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_ilo_assessments')
    .update(updatePayload)
    .eq('id', row.id)
    .eq('company_id', ctx.data.companyId)

  if (error) return { success: false, error: error.message }

  return { success: true, storagePath }
}

export async function finalizeFscIloFileUpload(
  referenceYear: number,
  fileKind: 'word' | 'pdf',
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const row = await getAssessmentRow(ctx.data.companyId, referenceYear)
  if (!row) return { success: false, error: 'Autovalutazione non trovata' }

  const expectedPath = fileKind === 'pdf' ? row.compiled_pdf_path : row.compiled_doc_path
  if (expectedPath !== storagePath) {
    return { success: false, error: 'Path storage non corrispondente' }
  }

  const supabase = await createClient()
  const { error } = await supabase.storage.from(FSC_BUCKET).createSignedUrl(storagePath, 60)
  if (error) {
    return { success: false, error: 'File non trovato in storage. Riprova l\'upload.' }
  }

  revalidateIloPaths(referenceYear)
  return { success: true }
}

export async function markFscIloCompleted(
  referenceYear: number
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const row = await getAssessmentRow(ctx.data.companyId, referenceYear)
  if (!row) return { success: false, error: 'Autovalutazione non trovata' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_ilo_assessments')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('company_id', ctx.data.companyId)

  if (error) return { success: false, error: error.message }

  revalidateIloPaths(referenceYear)
  revalidatePath('/cloud-fsc')
  return { success: true }
}

export async function getFscIloTemplateDownloadUrl(): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : ''

  if (siteUrl) {
    return { success: true, url: `${siteUrl}/fsc/ilo/template_it_coc_v1.2.docx` }
  }

  return { success: true, url: '/fsc/ilo/template_it_coc_v1.2.docx' }
}

export async function getFscIloCompiledDownloadUrl(
  referenceYear: number,
  fileKind: 'word' | 'pdf'
): Promise<{ success: boolean; url?: string; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const row = await getAssessmentRow(ctx.data.companyId, referenceYear)
  if (!row) return { success: false, error: 'Autovalutazione non trovata' }

  const path = fileKind === 'pdf' ? row.compiled_pdf_path : row.compiled_doc_path
  if (!path) return { success: false, error: 'File non disponibile' }

  const supabase = await createClient()
  const urls = await createFscDocumentSignedUrls(supabase, [path])
  const url = urls[path]
  if (!url) return { success: false, error: 'Download non disponibile' }

  return { success: true, url }
}

function validateFscIloFileMetadata(meta: {
  fileName: string
  fileSize: number
  mimeType: string
  allowedMimes: readonly string[]
}): string | null {
  const base = validateFscDocumentFileMetadata(meta)
  if (base) return base

  if (
    meta.mimeType &&
    !meta.allowedMimes.includes(meta.mimeType) &&
    !FSC_DOCUMENT_ALLOWED_MIME_TYPES.includes(
      meta.mimeType as (typeof FSC_DOCUMENT_ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return 'Formato file non consentito per questo upload'
  }

  if (meta.fileSize > FSC_DOCUMENT_MAX_FILE_SIZE) {
    return `File troppo grande (max ${FSC_DOCUMENT_MAX_FILE_SIZE / 1024 / 1024} MB)`
  }

  return null
}
