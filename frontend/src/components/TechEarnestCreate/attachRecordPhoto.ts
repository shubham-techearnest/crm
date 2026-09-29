import { uploadDocument } from "@/features/crm/foundationApi";

export async function attachRecordPhoto(entityType: string, entityId: string, photoFile: File | null | undefined) {
  if (!photoFile) return;
  await uploadDocument(entityType, entityId, photoFile);
}
