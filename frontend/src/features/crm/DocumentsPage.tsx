import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { ACCESS_TOKEN_KEY } from "@/api/client";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { listUsers } from "@/features/admin/adminApi";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { documentDownloadUrl, listDocuments, uploadDocument } from "@/features/crm/foundationApi";

const ENTITY_TYPES = ["LEAD", "ACCOUNT", "CONTACT", "DEAL", "PROJECT", "ACTIVITY"] as const;

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const canViewUsers = useHasPermission("USER_VIEW");
  const canUpload = useHasPermission("DOCUMENT_UPLOAD");
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
    <ModuleListShell
      title="Documents"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="text-muted small">All Documents</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
      }
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
            <label className="form-label small mb-1">Entity type</label>
            <select
              className="form-select form-select-sm mb-2"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="">All</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="form-label small mb-1">Visibility</label>
            <select
              className="form-select form-select-sm mb-2"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="">All</option>
              <option value="INTERNAL">INTERNAL</option>
              <option value="CUSTOMER">CUSTOMER</option>
            </select>
            {canViewUsers ? (
              <>
                <label className="form-label small mb-1">Uploaded by</label>
                <select
                  className="form-select form-select-sm mb-2"
                  value={uploadedBy}
                  onChange={(e) => setUploadedBy(e.target.value)}
                >
                  <option value="">All</option>
                  {auth.userId ? <option value={auth.userId}>Current user</option> : null}
                  {(usersQuery.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label className="form-label small mb-1">Created from</label>
            <input
              className="form-control form-control-sm mb-2"
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
            />
            <label className="form-label small mb-1">Created to</label>
            <input
              className="form-control form-control-sm"
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
            />
          </div>
        </>
      }
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
        <div className="module-list-table-wrap">
          <table className="table module-list-table align-middle">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Entity</th>
                <th>Visibility</th>
                <th>Size</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => (
                <tr key={doc.id} onClick={() => openDownload(doc.id, doc.fileName)}>
                  <td className="lead-name">{doc.fileName}</td>
                  <td>
                    {doc.entityType} · <code className="small">{doc.entityId.slice(0, 8)}…</code>
                  </td>
                  <td>{doc.visibility}</td>
                  <td>{doc.sizeBytes ?? "—"}</td>
                  <td className="small">{new Date(doc.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-5">
                    No documents match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
  );
}
