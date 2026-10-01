import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ModuleFilterDateRange, ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { ACCESS_TOKEN_KEY } from "@/api/client";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listUsers } from "@/features/admin/adminApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { deleteDocument, documentDownloadUrl, listDocuments, uploadDocument, type DocumentMeta } from "@/features/crm/foundationApi";
import { EntityRecordLink, useEntityNames } from "@/components/RecordLink";

const ENTITY_TYPES = ["LEAD", "ACCOUNT", "CONTACT", "DEAL", "PROJECT", "ACTIVITY"] as const;

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const canViewUsers = useHasPermission("USER_VIEW");
  const canUpload = useHasPermission("DOCUMENT_UPLOAD");
  const canDelete = useHasPermission("DOCUMENT_DELETE");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch } = useModuleWorkspace();
  const [entityType, setEntityType] = useState("");
  const [visibility, setVisibility] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadEntityType, setUploadEntityType] = useState<string>("LEAD");
  const [uploadEntityId, setUploadEntityId] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState("INTERNAL");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentMeta | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const listFilters = useMemo(
    () => ({
      visibility: visibility || undefined,
      uploadedBy: uploadedBy || undefined,
      fromTs: createdFrom ? new Date(createdFrom).toISOString() : undefined,
      toTs: createdTo ? new Date(`${createdTo}T23:59:59.999Z`).toISOString() : undefined,
    }),
    [visibility, uploadedBy, createdFrom, createdTo],
  );

  const docsQuery = useQuery({
    queryKey: ["crm", "documents", "recent", entityType, listFilters],
    queryFn: () => listDocuments(entityType || undefined, undefined, listFilters),
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
  });
  const entityName = useEntityNames(docsQuery.data);

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument(uploadEntityType, uploadEntityId.trim(), file, uploadVisibility),
    onSuccess: async () => {
      setUploadError(null);
      setShowUpload(false);
      setUploadEntityId("");
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents"] });
    },
    onError: () => setUploadError("Upload failed. Check entity type/id and permissions."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      setDocumentToDelete(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ["crm", "documents"] });
    },
    onError: () => setDeleteError("Could not delete this document. Check your access and whether the file is still in use."),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (docsQuery.data ?? []).filter((doc) => {
      if (!q) return true;
      return (
        doc.fileName.toLowerCase().includes(q) ||
        doc.entityType.toLowerCase().includes(q) ||
        doc.visibility.toLowerCase().includes(q)
      );
    });
  }, [docsQuery.data, search]);

  const activeFilterCount = [search, entityType, visibility, uploadedBy, createdFrom, createdTo].filter(
    Boolean,
  ).length;

  const openDownload = async (id: string, fileName: string) => {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(documentDownloadUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <ModuleListShell
      title="Documents"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="text-muted small">All Documents</span>}
      filterToggle={{ onToggle: () => setFilterOpen((open) => !open) }}
      primaryAction={
        canUpload ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowUpload((v) => !v)}>
            {showUpload ? "Cancel" : "Upload"}
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Documents by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="File name"
            />
          </div>
          <div className="module-filter-section">
            <h3>Filter by fields</h3>
            <TechEarnestFilterSelect label="Entity type" value={entityType} onChange={setEntityType} options={ENTITY_TYPES.map((value) => ({ value, label: value }))} placeholder="All types" emptyLabel="All types" searchPlaceholder="Search entity types" />
            <TechEarnestFilterSelect label="Visibility" value={visibility} onChange={setVisibility} options={[{ value: "INTERNAL", label: "Internal" }, { value: "CUSTOMER", label: "Customer" }]} placeholder="All visibility" emptyLabel="All visibility" searchPlaceholder="Search visibility" />
            {canViewUsers ? (
              <TechEarnestFilterSelect label="Uploaded by" value={uploadedBy} onChange={setUploadedBy} options={[
                ...(auth.userId ? [{ value: auth.userId, label: "Current user" }] : []),
                ...(usersQuery.data ?? []).map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim(), subtitle: user.email ?? undefined })),
              ]} placeholder="All users" emptyLabel="All users" searchPlaceholder="Search users" />
            ) : null}
            <ModuleFilterDateRange
              label="Created"
              from={createdFrom}
              to={createdTo}
              onFromChange={setCreatedFrom}
              onToChange={setCreatedTo}
            />
          </div>
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setSearch("");
        setEntityType("");
        setVisibility("");
        setUploadedBy("");
        setCreatedFrom("");
        setCreatedTo("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {showUpload ? (
        <div className="border-bottom p-3 bg-white">
          <p className="small text-muted mb-2">Upload requires a related entity (type + record id).</p>
          {uploadError ? <div className="alert alert-danger py-2">{uploadError}</div> : null}
          <div className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label small mb-1">Entity type</label>
              <select
                className="form-select form-select-sm"
                value={uploadEntityType}
                onChange={(e) => setUploadEntityType(e.target.value)}
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-1">Entity ID</label>
              <input
                className="form-control form-control-sm"
                value={uploadEntityId}
                onChange={(e) => setUploadEntityId(e.target.value)}
                placeholder="UUID of lead/account/…"
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Visibility</label>
              <select
                className="form-select form-select-sm"
                value={uploadVisibility}
                onChange={(e) => setUploadVisibility(e.target.value)}
              >
                <option value="INTERNAL">INTERNAL</option>
                <option value="CUSTOMER">CUSTOMER</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">File</label>
              <input
                className="form-control form-control-sm"
                type="file"
                disabled={!uploadEntityId.trim() || uploadMutation.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMutation.mutate(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {docsQuery.isLoading ? <LoadingState label="Loading documents..." /> : null}
      {docsQuery.error ? <ErrorState title="Unable to load documents" message="Try again shortly." /> : null}
      {!docsQuery.isLoading && !docsQuery.error && viewMode === "list" ? (
        <ModuleListTable
          tableCode="document"
          defaultColumns={[
            { field: "fileName", label: "File Name" },
            { field: "entityId", label: "Entity" },
            { field: "visibility", label: "Visibility" },
            { field: "sizeBytes", label: "Size" },
            { field: "createdAt", label: "Uploaded" },
          ]}
          rows={rows}
          rowKey={(doc) => doc.id}
          bulk={{
            noun: "documents",
            exportFileName: "documents",
            rowLabel: (doc) => doc.fileName,
            onComplete: () => void queryClient.invalidateQueries({ queryKey: ["crm", "documents"] }),
            actions: [
              {
                id: "delete",
                label: "Delete",
                tone: "danger",
                visible: canDelete,
                doneLabel: "deleted",
                confirm: "Deleted files can no longer be downloaded.",
                run: (doc) => deleteDocument(doc.id),
              },
            ],
          }}
          onRowClick={(doc) => void openDownload(doc.id, doc.fileName)}
          renderCell={(doc, field) => {
            if (field === "entityId")
              return (
                <EntityRecordLink entityType={doc.entityType} id={doc.entityId}>
                  {entityName(doc.entityType, doc.entityId)}
                </EntityRecordLink>
              );
            if (field === "createdAt") return <span className="small">{new Date(doc.createdAt).toLocaleString()}</span>;
            const value = (doc as unknown as Record<string, unknown>)[field];
            return value == null || value === "" ? "—" : String(value);
          }}
          nameFields={["fileName"]}
          trailingColumn={canDelete ? {
            header: "Actions",
            stopPropagation: true,
            render: (doc) => (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => {
                  setDeleteError(null);
                  setDocumentToDelete(doc);
                }}
              >
                Delete
              </button>
            ),
          } : undefined}
          emptyMessage="No documents match the current filters."
        />
      ) : null}
      {!docsQuery.isLoading && !docsQuery.error && viewMode === "tile" ? (
        <div className="module-tile-grid">
          {rows.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="module-tile text-start"
              onClick={() => openDownload(doc.id, doc.fileName)}
            >
              <div className="tile-title">{doc.fileName}</div>
              <div className="small text-muted">
                {doc.entityType} · {doc.visibility}
              </div>
            </button>
          ))}
          {!rows.length ? <p className="text-muted">No documents.</p> : null}
        </div>
      ) : null}
    </ModuleListShell>
      {documentToDelete && canDelete ? (
        <div className="module-modal-backdrop" role="presentation" onClick={() => deleteMutation.isPending ? null : setDocumentToDelete(null)}>
          <section className="module-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-document-title" onClick={(event) => event.stopPropagation()}>
            <header className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 id="delete-document-title" className="h5 mb-0">Delete document?</h2>
              <button type="button" className="btn-close" aria-label="Close" disabled={deleteMutation.isPending} onClick={() => setDocumentToDelete(null)} />
            </header>
            <p>Delete <strong>{documentToDelete.fileName}</strong>? It will be removed from the record it is attached to.</p>
            {deleteError ? <div className="alert alert-danger py-2" role="alert">{deleteError}</div> : null}
            <footer className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={deleteMutation.isPending} onClick={() => setDocumentToDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(documentToDelete.id)}>
                {deleteMutation.isPending ? "Deleting…" : "Delete document"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
