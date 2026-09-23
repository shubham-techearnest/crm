import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

function assertSuccess(response: ApiResponse<unknown>, fallback = "Request failed"): void {
  if (!response.success) {
    throw new Error(response.message ?? fallback);
  }
}

export interface DocumentMeta {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedBy: string;
  visibility: string;
  createdAt: string;
}

export async function listDocuments(
  entityType?: string,
  entityId?: string,
  filters?: {
    visibility?: string;
    uploadedBy?: string;
    fromTs?: string;
    toTs?: string;
    size?: number;
  },
): Promise<DocumentMeta[]> {
  const { data } = await api.get<ApiResponse<DocumentMeta[]>>("/documents", {
    params:
      entityType && entityId
        ? { entityType, entityId }
        : {
            size: filters?.size ?? 100,
            entityType: entityType || undefined,
            visibility: filters?.visibility || undefined,
            uploadedBy: filters?.uploadedBy || undefined,
            fromTs: filters?.fromTs || undefined,
            toTs: filters?.toTs || undefined,
          },
  });
  return unwrap(data);
}

export async function uploadDocument(
  entityType: string,
  entityId: string,
  file: File,
  visibility = "INTERNAL",
): Promise<DocumentMeta> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<ApiResponse<DocumentMeta>>("/documents", form, {
    params: { entityType, entityId, visibility },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(data);
}

export async function deleteDocument(id: string): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/documents/${id}`);
  assertSuccess(data);
}

export function documentDownloadUrl(id: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
  return `${base}/documents/${id}/download`;
}

export interface Note {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function listNotes(entityType: string, entityId: string): Promise<Note[]> {
  const { data } = await api.get<ApiResponse<Note[]>>("/notes", {
    params: { entityType, entityId },
  });
  return unwrap(data);
}

export async function createNote(entityType: string, entityId: string, body: string): Promise<Note> {
  const { data } = await api.post<ApiResponse<Note>>("/notes", { entityType, entityId, body });
  return unwrap(data);
}

export async function deleteNote(id: string): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/notes/${id}`);
  assertSuccess(data);
}

export interface SavedView {
  id: string;
  organizationId: string;
  ownerId: string;
  module: string;
  name: string;
  visibility: string;
  filter: Record<string, unknown> | null;
  columns: unknown;
  sort: unknown;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listSavedViews(module: string): Promise<SavedView[]> {
  const { data } = await api.get<ApiResponse<SavedView[]>>("/saved-views", { params: { module } });
  return unwrap(data);
}

export async function createSavedView(body: {
  module: string;
  name: string;
  visibility?: string;
  filter?: Record<string, unknown> | null;
  columns?: unknown;
  sort?: unknown;
  isDefault?: boolean;
}): Promise<SavedView> {
  const { data } = await api.post<ApiResponse<SavedView>>("/saved-views", body);
  return unwrap(data);
}

export async function deleteSavedView(id: string): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/saved-views/${id}`);
  assertSuccess(data);
}
