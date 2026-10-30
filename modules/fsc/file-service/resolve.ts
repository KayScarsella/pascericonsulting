import type { FscStorageOwnerType, FscStorageSlot } from '@/lib/fsc/file-service/policy'
import { createFscFileService } from '@/lib/fsc/file-service/FscFileService'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type DbClient = SupabaseClient<Database>

export async function fscHasActiveFile(
  supabase: DbClient,
  ownerType: FscStorageOwnerType,
  ownerId: string,
  slot: FscStorageSlot | string = 'primary'
): Promise<boolean> {
  const fileService = createFscFileService(supabase)
  const resolved = await fileService.getPathByOwner(ownerType, ownerId, slot)
  return resolved !== null
}

export async function fscResolveStoragePaths(
  supabase: DbClient,
  ownerType: FscStorageOwnerType,
  ownerIds: string[],
  slot: FscStorageSlot | string = 'primary'
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ownerIds.length === 0) return map

  const { data: links } = await supabase
    .from('fsc_storage_object_links')
    .select('owner_id, storage_object_id')
    .eq('owner_type', ownerType)
    .eq('slot', slot)
    .in('owner_id', ownerIds)

  const objectIds = (links ?? []).map((l) => l.storage_object_id)
  if (objectIds.length === 0) return map

  const { data: objects } = await supabase
    .from('fsc_storage_objects')
    .select('id, storage_path')
    .in('id', objectIds)
    .eq('status', 'active')

  const pathByObjectId = new Map((objects ?? []).map((o) => [o.id, o.storage_path]))

  for (const link of links ?? []) {
    const path = pathByObjectId.get(link.storage_object_id)
    if (path) map.set(link.owner_id, path)
  }

  return map
}
