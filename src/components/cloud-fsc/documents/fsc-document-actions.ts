import {
  abortFscEnteUpload,
  abortFscGestioneUpload,
  archiveFscEnteDocument,
  archiveFscGestioneDocument,
  finalizeFscEnteUpload,
  finalizeFscGestioneUpload,
  getFscEnteDownloadUrl,
  getFscGestioneDownloadUrl,
  listFscDocumentVersions,
  listFscEnteDocumentVersions,
  prepareFscEnteNewVersion,
  prepareFscEnteUpload,
  prepareFscGestioneNewVersion,
  prepareFscGestioneUpload,
  updateFscEnteMetadata,
  updateFscGestioneMetadata,
} from '@/actions/fsc/documents'
import type { FscDocumentModuleSlug, FscGestioneCategorySlug } from '@/lib/fsc/constants'
import type { FscDocument } from '@/types/fsc'

export type FscDocumentUploadInput = {
  category: string
  name: string
  reference_year?: number | null
  expires_at?: string | null
  reviewed_at?: string | null
  fileName: string
  fileSize: number
  mimeType: string
}

export type FscDocumentMetadataFields = {
  name?: string
  expires_at?: string | null
  reviewed_at?: string | null
  reference_year?: number | null
}

type FileMeta = { fileName: string; fileSize: number; mimeType: string }
type FinalizeMeta = { fileName: string; mimeType: string; size: number }
type ActionResult = { success: boolean; error?: string }
type PrepareResult = ActionResult & { documentId?: string; storagePath?: string }
type DownloadResult = ActionResult & { url?: string }

export type FscDocumentActions = {
  listVersions: (documentId: string) => Promise<FscDocument[]>
  prepareUpload: (input: FscDocumentUploadInput) => Promise<PrepareResult>
  prepareNewVersion: (documentId: string, fileMeta: FileMeta) => Promise<PrepareResult>
  finalizeUpload: (documentId: string, meta: FinalizeMeta) => Promise<ActionResult>
  abortUpload: (documentId: string) => Promise<ActionResult>
  updateMetadata: (documentId: string, fields: FscDocumentMetadataFields) => Promise<ActionResult>
  archiveDocument: (documentId: string) => Promise<ActionResult>
  getDownloadUrl: (documentId: string) => Promise<DownloadResult>
}

/** Dispatcher client-side: seleziona le server actions del modulo corretto. */
export function getFscDocumentActions(module: FscDocumentModuleSlug): FscDocumentActions {
  if (module === 'ente') {
    return {
      listVersions: listFscEnteDocumentVersions,
      prepareUpload: (input) =>
        prepareFscEnteUpload({
          category: input.category,
          name: input.name,
          // Server-side validation rejects missing/invalid years.
          reference_year: input.reference_year as number,
          expires_at: input.expires_at,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
        }),
      prepareNewVersion: prepareFscEnteNewVersion,
      finalizeUpload: finalizeFscEnteUpload,
      abortUpload: abortFscEnteUpload,
      updateMetadata: (documentId, fields) =>
        updateFscEnteMetadata(documentId, {
          name: fields.name,
          expires_at: fields.expires_at,
          reference_year: fields.reference_year,
        }),
      archiveDocument: archiveFscEnteDocument,
      getDownloadUrl: getFscEnteDownloadUrl,
    }
  }
  return {
    listVersions: listFscDocumentVersions,
    prepareUpload: (input) =>
      prepareFscGestioneUpload({
        category: input.category as FscGestioneCategorySlug,
        name: input.name,
        expires_at: input.expires_at,
        reviewed_at: input.reviewed_at,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
      }),
    prepareNewVersion: prepareFscGestioneNewVersion,
    finalizeUpload: finalizeFscGestioneUpload,
    abortUpload: abortFscGestioneUpload,
    updateMetadata: (documentId, fields) =>
      updateFscGestioneMetadata(documentId, {
        name: fields.name,
        expires_at: fields.expires_at,
        reviewed_at: fields.reviewed_at,
      }),
    archiveDocument: archiveFscGestioneDocument,
    getDownloadUrl: getFscGestioneDownloadUrl,
  }
}
