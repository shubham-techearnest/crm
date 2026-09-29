import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { FormPolicyStudio } from "./FormPolicyStudio";
import {
  createSysField,
  deactivateSysField,
  discardFormLayoutDraft,
  discardListLayoutDraft,
  getFormLayout,
  getListLayout,
  listRelatedLists,
  listSysFields,
  listSysTables,
  publishRelatedList,
  publishFormLayout,
  publishListLayout,
  saveFormLayoutDraft,
  saveListLayoutDraft,
  saveRelatedList,
  updateSysField,
  updateSysTable,
  type FormLayoutJson,
  type ListLayoutJson,
  type RelatedListLayout,
  type SysField,
  type SysTable,
} from "./metadataApi";
import "./StudioPage.scss";

const FIELD_TYPES = ["STRING", "TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME", "REFERENCE", "ENUM"] as const;
type CanvasTab = "fields" | "form" | "list" | "related" | "policies";

const SUPPORTED_RELATED_TABLES: Record<string, string[]> = {
  account: ["contact", "deal", "activity", "project", "document", "note"],
  contact: ["deal", "activity"],
};

const EMPTY_FORM: FormLayoutJson = {
  sections: [
    { id: "primary", title: "Primary details", disclosure: "ALWAYS", fields: [] },
    { id: "additional", title: "Additional details", disclosure: "MORE", fields: [] },
  ],
};

const EMPTY_LIST: ListLayoutJson = {
  columns: [],
  defaultSort: { field: "createdAt", direction: "DESC" },
};

export function StudioPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("METADATA_MANAGE");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("fields");
  const [layoutKey, setLayoutKey] = useState<"CREATE" | "EDIT">("CREATE");
  const [previewMode, setPreviewMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<string>("STRING");
  const [newFilterable, setNewFilterable] = useState(false);
  const [formDraft, setFormDraft] = useState<FormLayoutJson>(EMPTY_FORM);
  const [listDraft, setListDraft] = useState<ListLayoutJson>(EMPTY_LIST);
  const [relatedDrafts, setRelatedDrafts] = useState<RelatedListLayout[]>([]);
  const [newRelatedChildCode, setNewRelatedChildCode] = useState("");
  const [newRelatedLabel, setNewRelatedLabel] = useState("");
  const [newRelatedPermission, setNewRelatedPermission] = useState("");
  const [newRelatedColumns, setNewRelatedColumns] = useState<string[]>([]);
  const [formDirty, setFormDirty] = useState(false);
  const [listDirty, setListDirty] = useState(false);

  const tablesQuery = useQuery({
    queryKey: ["metadata", "tables"],
    queryFn: listSysTables,
  });
  const tables = tablesQuery.data ?? [];

  const fieldsQuery = useQuery({
    queryKey: ["metadata", "fields", selectedTableId],
    queryFn: () => listSysFields(selectedTableId!),
    enabled: !!selectedTableId,
  });

  const formLayoutQuery = useQuery({
    queryKey: ["metadata", "form-layout", selectedTableId, layoutKey],
    queryFn: () => getFormLayout(selectedTableId!, layoutKey),
    enabled: !!selectedTableId && canvasTab === "form",
    retry: false,
  });

  const listLayoutQuery = useQuery({
    queryKey: ["metadata", "list-layout", selectedTableId],
    queryFn: () => getListLayout(selectedTableId!),
    enabled: !!selectedTableId && canvasTab === "list",
    retry: false,
  });

  const relatedListsQuery = useQuery({
    queryKey: ["metadata", "related-lists", selectedTableId],
    queryFn: () => listRelatedLists(selectedTableId!),
    enabled: !!selectedTableId && canvasTab === "related",
  });

  const childTable = tables.find((table) => table.code === newRelatedChildCode);
  const childFieldsQuery = useQuery({
    queryKey: ["metadata", "fields", childTable?.id],
    queryFn: () => listSysFields(childTable!.id),
    enabled: !!childTable && canvasTab === "related",
  });

  useEffect(() => {
    if (relatedListsQuery.data) setRelatedDrafts(structuredClone(relatedListsQuery.data));
  }, [relatedListsQuery.data]);

  useEffect(() => {
    setNewRelatedLabel(childTable?.plural ?? "");
  }, [childTable?.id, childTable?.plural]);

  useEffect(() => {
    setNewRelatedColumns((childFieldsQuery.data ?? []).filter((field) => field.active).slice(0, 4).map((field) => field.code));
  }, [childFieldsQuery.data]);

  useEffect(() => {
    if (formLayoutQuery.data?.layout) {
      setFormDraft(structuredClone(formLayoutQuery.data.layout));
      setFormDirty(false);
    } else if (formLayoutQuery.isError && selectedTableId) {
      setFormDraft(structuredClone(EMPTY_FORM));
      setFormDirty(false);
    }
  }, [formLayoutQuery.data, formLayoutQuery.isError, selectedTableId, layoutKey]);

  useEffect(() => {
    if (listLayoutQuery.data?.layout) {
      setListDraft(structuredClone(listLayoutQuery.data.layout));
      setListDirty(false);
    } else if (listLayoutQuery.isError && selectedTableId) {
      setListDraft(structuredClone(EMPTY_LIST));
      setListDirty(false);
    }
  }, [listLayoutQuery.data, listLayoutQuery.isError, selectedTableId]);

  const groups = useMemo(
    () => Array.from(new Set(tables.map((t) => t.moduleGroup))).sort(),
    [tables],
  );
  const visibleTables = useMemo(
    () => tables.filter((t) => !groupFilter || t.moduleGroup === groupFilter),
    [tables, groupFilter],
  );
  const selectedTable: SysTable | undefined = tables.find((t) => t.id === selectedTableId);
  const allowedRelatedTables = selectedTable
    ? (SUPPORTED_RELATED_TABLES[selectedTable.code] ?? []).map((code) => tables.find((table) => table.code === code)).filter((table): table is SysTable => !!table)
    : [];
  const fields = fieldsQuery.data ?? [];
  const selectedField: SysField | undefined = fields.find((f) => f.id === selectedFieldId);
  const usedFormFields = useMemo(
    () => new Set(formDraft.sections.flatMap((s) => s.fields)),
    [formDraft],
  );
  const unusedFields = fields.filter((f) => f.active && !usedFormFields.has(f.code));
  const usedListFields = useMemo(() => new Set(listDraft.columns.map((c) => c.field)), [listDraft]);
  const unusedListFields = fields.filter((f) => f.active && !usedListFields.has(f.code));

  const refreshTables = () => queryClient.invalidateQueries({ queryKey: ["metadata", "tables"] });
  const refreshFields = () =>
    queryClient.invalidateQueries({ queryKey: ["metadata", "fields", selectedTableId] });
  const refreshForm = () =>
    queryClient.invalidateQueries({ queryKey: ["metadata", "form-layout", selectedTableId, layoutKey] });
  const refreshList = () =>
    queryClient.invalidateQueries({ queryKey: ["metadata", "list-layout", selectedTableId] });
  const refreshRelatedLists = () =>
    queryClient.invalidateQueries({ queryKey: ["metadata", "related-lists", selectedTableId] });

  const updateTableMutation = useMutation({
    mutationFn: (body: { label?: string; plural?: string; active?: boolean }) =>
      updateSysTable(selectedTableId!, body),
    onSuccess: async () => {
      await refreshTables();
      setToast(previewMode ? "Preview saved locally (publish when ready)" : "Table published");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateFieldMutation = useMutation({
    mutationFn: (body: {
      label?: string;
      helpText?: string;
      active?: boolean;
      fieldType?: string;
      filterable?: boolean;
    }) => updateSysField(selectedFieldId!, body),
    onSuccess: async () => {
      await refreshFields();
      setToast("Field updated");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const createFieldMutation = useMutation({
    mutationFn: () =>
      createSysField(selectedTableId!, {
        code: newCode,
        label: newLabel,
        fieldType: newType,
        filterable: newFilterable,
      }),
    onSuccess: async (field) => {
      await refreshFields();
      setSelectedFieldId(field.id);
      setNewCode("");
      setNewLabel("");
      setNewType("STRING");
      setNewFilterable(false);
      setToast("Custom field created (values stored in custom_fields JSONB map)");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateSysField(selectedFieldId!),
    onSuccess: async () => {
      setSelectedFieldId(null);
      await refreshFields();
      setToast("Field deactivated");
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveFormMutation = useMutation({
    mutationFn: () => saveFormLayoutDraft(selectedTableId!, { layoutKey, layout: formDraft }),
    onSuccess: async () => {
      await refreshForm();
      setFormDirty(false);
      setToast(previewMode ? "Form draft saved (preview)" : "Form draft saved");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const publishFormMutation = useMutation({
    mutationFn: async () => {
      await saveFormLayoutDraft(selectedTableId!, { layoutKey, layout: formDraft });
      return publishFormLayout(selectedTableId!, layoutKey);
    },
    onSuccess: async () => {
      await refreshForm();
      setFormDirty(false);
      setToast("Form layout published — runtime forms update without redeploy");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const discardFormMutation = useMutation({
    mutationFn: () => discardFormLayoutDraft(selectedTableId!, layoutKey),
    onSuccess: async () => {
      await refreshForm();
      setToast("Form draft discarded");
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveListMutation = useMutation({
    mutationFn: () => saveListLayoutDraft(selectedTableId!, { layout: listDraft }),
    onSuccess: async () => {
      await refreshList();
      setListDirty(false);
      setToast("List draft saved");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const publishListMutation = useMutation({
    mutationFn: async () => {
      await saveListLayoutDraft(selectedTableId!, { layout: listDraft });
      return publishListLayout(selectedTableId!);
    },
    onSuccess: async () => {
      await refreshList();
      setListDirty(false);
      setToast("List layout published");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const discardListMutation = useMutation({
    mutationFn: () => discardListLayoutDraft(selectedTableId!),
    onSuccess: async () => {
      await refreshList();
      setToast("List draft discarded");
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveRelatedMutation = useMutation({
    mutationFn: ({ childTableCode, label, sortOrder, permissionCode, columns, active }: {
      childTableCode: string; label: string; sortOrder: number; permissionCode?: string;
      columns: { field: string; label: string; width?: number }[]; active: boolean;
    }) => saveRelatedList(selectedTableId!, { childTableCode, label, sortOrder, permissionCode, columns, active }),
    onSuccess: (saved) => {
      setRelatedDrafts((prev) => {
        const existingDraft = prev.findIndex((item) => item.childTableCode === saved.childTableCode && item.status === "DRAFT");
        if (existingDraft < 0) return [...prev, saved];
        return prev.map((item, index) => index === existingDraft ? saved : item);
      });
      setToast("Related list draft saved");
      setError(null);
      setNewRelatedChildCode("");
      setNewRelatedLabel("");
      setNewRelatedPermission("");
      setNewRelatedColumns([]);
    },
    onError: (err: Error) => setError(err.message),
  });

  const publishRelatedMutation = useMutation({
    mutationFn: publishRelatedList,
    onSuccess: async () => {
      await refreshRelatedLists();
      await queryClient.invalidateQueries({ queryKey: ["metadata", "runtime"] });
      setToast("Related list published");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const moveFormField = (sectionIdx: number, fieldIdx: number, dir: -1 | 1) => {
    setFormDraft((prev) => {
      const next = structuredClone(prev);
      const section = next.sections[sectionIdx];
      const target = fieldIdx + dir;
      if (target < 0 || target >= section.fields.length) return prev;
      const tmp = section.fields[fieldIdx];
      section.fields[fieldIdx] = section.fields[target];
      section.fields[target] = tmp;
      return next;
    });
    setFormDirty(true);
  };

  const removeFormField = (sectionIdx: number, fieldIdx: number) => {
    setFormDraft((prev) => {
      const next = structuredClone(prev);
      next.sections[sectionIdx].fields.splice(fieldIdx, 1);
      return next;
    });
    setFormDirty(true);
  };

  const addFormField = (sectionIdx: number, code: string) => {
    setFormDraft((prev) => {
      const next = structuredClone(prev);
      if (!next.sections[sectionIdx].fields.includes(code)) {
        next.sections[sectionIdx].fields.push(code);
      }
      return next;
    });
    setFormDirty(true);
  };

  const moveListColumn = (idx: number, dir: -1 | 1) => {
    setListDraft((prev) => {
      const next = structuredClone(prev);
      const target = idx + dir;
      if (target < 0 || target >= next.columns.length) return prev;
      const tmp = next.columns[idx];
      next.columns[idx] = next.columns[target];
      next.columns[target] = tmp;
      return next;
    });
    setListDirty(true);
  };

  const removeListColumn = (idx: number) => {
    setListDraft((prev) => {
      const next = structuredClone(prev);
      next.columns.splice(idx, 1);
      return next;
    });
    setListDirty(true);
  };

  const addListColumn = (field: SysField) => {
    setListDraft((prev) => {
      const next = structuredClone(prev);
      if (!next.columns.some((c) => c.field === field.code)) {
        next.columns.push({ field: field.code, label: field.label, width: 140 });
      }
      return next;
    });
    setListDirty(true);
  };

  if (tablesQuery.isLoading) {
    return <LoadingState label="Loading Metadata Studio..." />;
  }
  if (tablesQuery.error) {
    return <ErrorState title="Unable to load Studio" message="Check METADATA_VIEW permission." />;
  }

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div>
          <h1 className="h4 mb-0">Metadata &amp; ACL Studio</h1>
          <p className="text-muted small mb-0">Configure tables, fields, and layouts without code</p>
        </div>
        <div className="studio-header-actions">
          <button
            type="button"
            className={`btn btn-sm ${previewMode ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setPreviewMode((v) => !v)}
          >
            {previewMode ? "Preview on" : "Preview"}
          </button>
          {canvasTab === "fields" ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!canManage || !selectedTable}
              onClick={() => {
                if (!selectedTable) return;
                updateTableMutation.mutate({
                  label: selectedTable.label,
                  plural: selectedTable.plural,
                  active: selectedTable.active,
                });
              }}
            >
              Publish
            </button>
          ) : null}
          {canvasTab === "form" ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={!canManage || !formDirty}
                onClick={() => discardFormMutation.mutate()}
              >
                Discard draft
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={!canManage || !selectedTable}
                onClick={() => saveFormMutation.mutate()}
              >
                Save draft
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!canManage || !selectedTable}
                onClick={() => publishFormMutation.mutate()}
              >
                Publish form
              </button>
            </>
          ) : null}
          {canvasTab === "list" ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={!canManage || !listDirty}
                onClick={() => discardListMutation.mutate()}
              >
                Discard draft
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={!canManage || !selectedTable}
                onClick={() => saveListMutation.mutate()}
              >
                Save draft
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!canManage || !selectedTable}
                onClick={() => publishListMutation.mutate()}
              >
                Publish list
              </button>
            </>
          ) : null}
        </div>
      </header>

      {toast ? <div className="alert alert-success py-2 studio-alert">{toast}</div> : null}
      {error ? <div className="alert alert-danger py-2 studio-alert">{error}</div> : null}

      <div className="studio-layout">
        <aside className="studio-navigator">
          <div className="studio-pane-title">Tables</div>
          <select
            className="form-select form-select-sm mb-2"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            aria-label="Module group"
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          {visibleTables.length === 0 ? (
            <EmptyState title="No tables" description="Dictionary seed is empty." />
          ) : (
            <ul className="studio-table-list">
              {visibleTables.map((table) => (
                <li key={table.id}>
                  <button
                    type="button"
                    className={table.id === selectedTableId ? "active" : ""}
                    onClick={() => {
                      setSelectedTableId(table.id);
                      setSelectedFieldId(null);
                      setToast(null);
                      setError(null);
                      setFormDirty(false);
                      setListDirty(false);
                      setRelatedDrafts([]);
                      setNewRelatedChildCode("");
                      setNewRelatedLabel("");
                      setNewRelatedPermission("");
                      setNewRelatedColumns([]);
                    }}
                  >
                    <span>{table.plural}</span>
                    <span className="text-muted small">{table.moduleGroup}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="studio-canvas">
          <div className="studio-canvas-tabs mb-2">
            {(
              [
                ["fields", "Fields"],
                ["form", "Form layout"],
                ["list", "List layout"],
                ["related", "Related lists"],
                ["policies", "Form policies"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`btn btn-sm ${canvasTab === id ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setCanvasTab(id)}
                disabled={!selectedTableId && id !== "fields"}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="studio-pane-title">Canvas</div>
          {!selectedTable ? (
            <EmptyState
              title="Select a table"
              description="Choose a table from the navigator to inspect fields and layout."
            />
          ) : fieldsQuery.isLoading ? (
            <LoadingState label="Loading fields..." />
          ) : canvasTab === "fields" ? (
            <>
              <div className="studio-canvas-meta mb-3">
                <strong>{selectedTable.plural}</strong>
                <span className="badge text-bg-light ms-2">{selectedTable.code}</span>
                {selectedTable.system ? (
                  <span className="badge text-bg-secondary ms-2">System</span>
                ) : null}
              </div>
              {fields.length === 0 ? (
                <EmptyState title="No fields" description="Add a custom field from the inspector." />
              ) : (
                <table className="table table-sm studio-field-table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Filter</th>
                      <th>System</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr
                        key={field.id}
                        className={field.id === selectedFieldId ? "table-active" : ""}
                        onClick={() => setSelectedFieldId(field.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>{field.label}</td>
                        <td>
                          <code>{field.code}</code>
                        </td>
                        <td>{field.fieldType}</td>
                        <td>{field.filterable ? "Yes" : "—"}</td>
                        <td>{field.system ? "Yes" : "Custom"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : canvasTab === "form" ? (
            <>
              <div className="d-flex align-items-center gap-2 mb-3">
                <strong>{selectedTable.plural}</strong>
                <select
                  className="form-select form-select-sm w-auto"
                  value={layoutKey}
                  onChange={(e) => setLayoutKey(e.target.value as "CREATE" | "EDIT")}
                >
                  <option value="CREATE">CREATE</option>
                  <option value="EDIT">EDIT</option>
                </select>
                <span className="badge text-bg-light">
                  {formLayoutQuery.data?.status ?? "NEW"}
                  {formDirty ? " · dirty" : ""}
                </span>
              </div>
              {formLayoutQuery.isLoading ? (
                <LoadingState label="Loading form layout..." />
              ) : (
                <div className="studio-form-designer">
                  <div className="studio-palette mb-3">
                    <div className="small text-muted mb-1">Unused fields</div>
                    <div className="d-flex flex-wrap gap-1">
                      {unusedFields.length === 0 ? (
                        <span className="text-muted small">All fields placed</span>
                      ) : (
                        unusedFields.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            disabled={!canManage}
                            onClick={() => addFormField(0, f.code)}
                            title="Add to primary section"
                          >
                            {f.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  {formDraft.sections.map((section, sIdx) => (
                    <div key={section.id} className="studio-section mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div>
                          <strong>{section.title}</strong>
                          <span className="badge text-bg-light ms-2">{section.disclosure}</span>
                        </div>
                        {canManage && unusedFields.length > 0 ? (
                          <select
                            className="form-select form-select-sm w-auto"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addFormField(sIdx, e.target.value);
                                e.target.value = "";
                              }
                            }}
                          >
                            <option value="">Add field…</option>
                            {unusedFields.map((f) => (
                              <option key={f.id} value={f.code}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                      <ul className="studio-order-list">
                        {section.fields.map((code, fIdx) => {
                          const meta = fields.find((f) => f.code === code);
                          return (
                            <li key={`${section.id}-${code}`}>
                              <span>{meta?.label ?? code}</span>
                              <code className="small">{code}</code>
                              {canManage ? (
                                <span className="studio-order-actions">
                                  <button type="button" className="btn btn-link btn-sm" onClick={() => moveFormField(sIdx, fIdx, -1)}>
                                    ↑
                                  </button>
                                  <button type="button" className="btn btn-link btn-sm" onClick={() => moveFormField(sIdx, fIdx, 1)}>
                                    ↓
                                  </button>
                                  <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => removeFormField(sIdx, fIdx)}>
                                    Remove
                                  </button>
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  {previewMode ? (
                    <div className="alert alert-info py-2 small mb-0">
                      Preview: primary sections always show; MORE sections use progressive disclosure at runtime.
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : canvasTab === "list" ? (
            <>
              <div className="d-flex align-items-center gap-2 mb-3">
                <strong>{selectedTable.plural} list columns</strong>
                <span className="badge text-bg-light">
                  {listLayoutQuery.data?.status ?? "NEW"}
                  {listDirty ? " · dirty" : ""}
                </span>
              </div>
              {listLayoutQuery.isLoading ? (
                <LoadingState label="Loading list layout..." />
              ) : (
                <div className="studio-list-designer">
                  <div className="studio-palette mb-3">
                    <div className="small text-muted mb-1">Add columns</div>
                    <div className="d-flex flex-wrap gap-1">
                      {unusedListFields.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={!canManage}
                          onClick={() => addListColumn(f)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ul className="studio-order-list">
                    {listDraft.columns.map((col, idx) => (
                      <li key={col.field}>
                        <span>{col.label}</span>
                        <code className="small">{col.field}</code>
                        {canManage ? (
                          <span className="studio-order-actions">
                            <button type="button" className="btn btn-link btn-sm" onClick={() => moveListColumn(idx, -1)}>
                              ↑
                            </button>
                            <button type="button" className="btn btn-link btn-sm" onClick={() => moveListColumn(idx, 1)}>
                              ↓
                            </button>
                            <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => removeListColumn(idx)}>
                              Remove
                            </button>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="row g-2 mt-2">
                    <div className="col-auto">
                      <label className="form-label small mb-1">Default sort field</label>
                      <select
                        className="form-select form-select-sm"
                        value={listDraft.defaultSort?.field ?? "createdAt"}
                        disabled={!canManage}
                        onChange={(e) => {
                          setListDraft((prev) => ({
                            ...prev,
                            defaultSort: {
                              field: e.target.value,
                              direction: prev.defaultSort?.direction ?? "DESC",
                            },
                          }));
                          setListDirty(true);
                        }}
                      >
                        {fields.map((f) => (
                          <option key={f.id} value={f.code}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-auto">
                      <label className="form-label small mb-1">Direction</label>
                      <select
                        className="form-select form-select-sm"
                        value={listDraft.defaultSort?.direction ?? "DESC"}
                        disabled={!canManage}
                        onChange={(e) => {
                          setListDraft((prev) => ({
                            ...prev,
                            defaultSort: {
                              field: prev.defaultSort?.field ?? "createdAt",
                              direction: e.target.value as "ASC" | "DESC",
                            },
                          }));
                          setListDirty(true);
                        }}
                      >
                        <option value="ASC">ASC</option>
                        <option value="DESC">DESC</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : canvasTab === "related" ? (
            <section className="studio-related-designer">
              <div className="studio-canvas-meta mb-3">
                <div>
                  <strong>{selectedTable.plural} related lists</strong>
                  <p className="small text-muted mb-0">Configure only related record types supported by this module.</p>
                </div>
              </div>
              {relatedListsQuery.isLoading ? <LoadingState label="Loading related lists..." /> : null}
              {relatedListsQuery.error ? <ErrorState title="Unable to load related lists" message="Check metadata access and try again." /> : null}
              {!relatedListsQuery.isLoading && !relatedListsQuery.error ? (
                <div className="studio-related-list-items">
                  {relatedDrafts.map((layout) => {
                    const draft = (patch: Partial<RelatedListLayout>) =>
                      setRelatedDrafts((prev) => prev.map((item) => item.id === layout.id ? { ...item, ...patch } : item));
                    return (
                      <article className="studio-related-list-card" key={layout.id}>
                        <div className="studio-related-list-card-head">
                          <div>
                            <strong>{layout.childTableCode}</strong>
                            <span className={`badge ms-2 ${layout.status === "PUBLISHED" ? "text-bg-success" : "text-bg-warning"}`}>{layout.status}</span>
                          </div>
                          <label className="form-check form-switch mb-0">
                            <input className="form-check-input" type="checkbox" checked={layout.active} disabled={!canManage} onChange={(event) => draft({ active: event.target.checked })} />
                            <span className="form-check-label small">Active</span>
                          </label>
                        </div>
                        <div className="row g-2 mt-1">
                          <div className="col-md-5">
                            <label className="form-label small">Label</label>
                            <input className="form-control form-control-sm" value={layout.label} disabled={!canManage} onChange={(event) => draft({ label: event.target.value })} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small">Permission code</label>
                            <input className="form-control form-control-sm" value={layout.permissionCode ?? ""} disabled={!canManage} placeholder="Optional" onChange={(event) => draft({ permissionCode: event.target.value || null })} />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small">Order</label>
                            <input className="form-control form-control-sm" type="number" value={layout.sortOrder} disabled={!canManage} onChange={(event) => draft({ sortOrder: Number(event.target.value) || 0 })} />
                          </div>
                        </div>
                        <div className="small text-muted mt-2">
                          Columns: {layout.columns?.map((column) => column.label).join(", ") || "No columns configured"}
                        </div>
                        <div className="d-flex justify-content-end gap-2 mt-3">
                          <button type="button" className="btn btn-outline-primary btn-sm" disabled={!canManage || saveRelatedMutation.isPending || !layout.label.trim()} onClick={() => saveRelatedMutation.mutate({ childTableCode: layout.childTableCode, label: layout.label.trim(), sortOrder: layout.sortOrder, permissionCode: layout.permissionCode || undefined, columns: layout.columns ?? [], active: layout.active })}>Save draft</button>
                          <button type="button" className="btn btn-primary btn-sm" disabled={!canManage || layout.status === "PUBLISHED" || publishRelatedMutation.isPending} onClick={() => publishRelatedMutation.mutate(layout.id)}>Publish</button>
                        </div>
                      </article>
                    );
                  })}
                  {relatedDrafts.length === 0 ? <EmptyState title="No related lists configured" description="Add a supported relationship to show it on module records." /> : null}
                </div>
              ) : null}
              {allowedRelatedTables.length > 0 ? (
                <div className="studio-related-list-card studio-related-list-create">
                  <h3 className="h6">Add a related list</h3>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label small">Related module</label>
                      <select className="form-select form-select-sm" value={newRelatedChildCode} disabled={!canManage} onChange={(event) => setNewRelatedChildCode(event.target.value)}>
                        <option value="">Choose a module</option>
                        {allowedRelatedTables.filter((table) => !relatedDrafts.some((item) => item.childTableCode === table.code && item.status === "PUBLISHED")).map((table) => <option value={table.code} key={table.id}>{table.plural}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small">Display label</label>
                      <input className="form-control form-control-sm" value={newRelatedLabel} disabled={!canManage} onChange={(event) => setNewRelatedLabel(event.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small">Permission code</label>
                      <input className="form-control form-control-sm" value={newRelatedPermission} disabled={!canManage} placeholder="Optional" onChange={(event) => setNewRelatedPermission(event.target.value)} />
                    </div>
                  </div>
                  {childFieldsQuery.isLoading ? <div className="small text-muted mt-2">Loading available columns…</div> : null}
                  {childTable && !childFieldsQuery.isLoading ? (
                    <fieldset className="mt-3" disabled={!canManage}>
                      <legend className="form-label small">Visible columns</legend>
                      <div className="studio-related-column-options">
                        {(childFieldsQuery.data ?? []).filter((field) => field.active).map((field) => (
                          <label className="form-check" key={field.id}>
                            <input className="form-check-input" type="checkbox" checked={newRelatedColumns.includes(field.code)} onChange={(event) => setNewRelatedColumns((prev) => event.target.checked ? [...prev, field.code] : prev.filter((code) => code !== field.code))} />
                            <span className="form-check-label">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  <div className="d-flex justify-content-end mt-3">
                    <button type="button" className="btn btn-outline-primary btn-sm" disabled={!canManage || !childTable || !newRelatedLabel.trim() || childFieldsQuery.isLoading || saveRelatedMutation.isPending} onClick={() => saveRelatedMutation.mutate({ childTableCode: newRelatedChildCode, label: newRelatedLabel.trim(), sortOrder: relatedDrafts.length * 10 + 10, permissionCode: newRelatedPermission.trim() || undefined, columns: newRelatedColumns.flatMap((code) => { const field = childFieldsQuery.data?.find((candidate) => candidate.code === code); return field ? [{ field: code, label: field.label, width: 160 }] : []; }), active: true })}>Save related list draft</button>
                  </div>
                </div>
              ) : (
                <p className="small text-muted">Related list configuration is available for Account and Contact records where the application has matching related-record views.</p>
              )}
            </section>
          ) : selectedTable.code === "deal" ? (
            <FormPolicyStudio tableId={selectedTable.id} canManage={canManage} />
          ) : (
            <EmptyState
              title="No stage-policy workflow for this module"
              description="Form policies currently run when a deal stage changes and can require a closing date or lost reason."
            />
          )}
        </main>

        <aside className="studio-inspector">
          <div className="studio-pane-title">Properties</div>
          {!selectedTable ? (
            <EmptyState title="Nothing selected" description="Table and field properties appear here." />
          ) : (
            <>
              <section className="mb-3">
                <h3 className="h6">Table</h3>
                <label className="form-label small mb-1">Label</label>
                <input
                  className="form-control form-control-sm mb-2"
                  defaultValue={selectedTable.label}
                  key={`label-${selectedTable.id}`}
                  disabled={!canManage}
                  onBlur={(e) => {
                    if (e.target.value !== selectedTable.label) {
                      updateTableMutation.mutate({ label: e.target.value });
                    }
                  }}
                />
                <label className="form-label small mb-1">Plural</label>
                <input
                  className="form-control form-control-sm mb-2"
                  defaultValue={selectedTable.plural}
                  key={`plural-${selectedTable.id}`}
                  disabled={!canManage}
                  onBlur={(e) => {
                    if (e.target.value !== selectedTable.plural) {
                      updateTableMutation.mutate({ plural: e.target.value });
                    }
                  }}
                />
              </section>

              {canvasTab === "fields" && selectedField ? (
                <section className="mb-3">
                  <h3 className="h6">Field</h3>
                  <label className="form-label small mb-1">Label</label>
                  <input
                    className="form-control form-control-sm mb-2"
                    defaultValue={selectedField.label}
                    key={`flabel-${selectedField.id}`}
                    disabled={!canManage}
                    onBlur={(e) => {
                      if (e.target.value !== selectedField.label) {
                        updateFieldMutation.mutate({ label: e.target.value });
                      }
                    }}
                  />
                  <label className="form-label small mb-1">Help</label>
                  <textarea
                    className="form-control form-control-sm mb-2"
                    rows={2}
                    defaultValue={selectedField.helpText ?? ""}
                    key={`fhelp-${selectedField.id}`}
                    disabled={!canManage}
                    onBlur={(e) => {
                      const next = e.target.value || undefined;
                      if ((selectedField.helpText ?? "") !== (next ?? "")) {
                        updateFieldMutation.mutate({ helpText: next });
                      }
                    }}
                  />
                  <p className="small text-muted mb-2">
                    Code <code>{selectedField.code}</code> · {selectedField.fieldType}
                    {selectedField.system ? " · system (label/help only)" : ""}
                  </p>
                  <label className="form-check small mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={!!selectedField.filterable}
                      disabled={!canManage}
                      onChange={(e) => updateFieldMutation.mutate({ filterable: e.target.checked })}
                    />
                    <span className="form-check-label">Filterable (appears in advanced filter catalog)</span>
                  </label>
                  {canManage && !selectedField.system ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => deactivateMutation.mutate()}
                    >
                      Deactivate
                    </button>
                  ) : null}
                </section>
              ) : null}

              {canvasTab === "fields" && canManage ? (
                <section>
                  <h3 className="h6">Add custom field</h3>
                  <p className="small text-muted">
                    Storage: JSONB <code>custom_fields</code> map on records. Max 50 per table.
                  </p>
                  <input
                    className="form-control form-control-sm mb-2"
                    placeholder="code (camelCase)"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                  />
                  <input
                    className="form-control form-control-sm mb-2"
                    placeholder="Label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                  <select
                    className="form-select form-select-sm mb-2"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <label className="form-check small mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={newFilterable}
                      onChange={(e) => setNewFilterable(e.target.checked)}
                    />
                    <span className="form-check-label">Filterable</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={!newCode.trim() || !newLabel.trim() || createFieldMutation.isPending}
                    onClick={() => createFieldMutation.mutate()}
                  >
                    Add field
                  </button>
                </section>
              ) : null}

              {canvasTab === "form" ? (
                <section>
                  <h3 className="h6">Form layout</h3>
                  <p className="small text-muted mb-0">
                    Place fields into Primary (ALWAYS) or Additional (MORE) sections. Publish updates Lead
                    DynamicForm without redeploy.
                  </p>
                </section>
              ) : null}

              {canvasTab === "list" ? (
                <section>
                  <h3 className="h6">List layout</h3>
                  <p className="small text-muted mb-0">
                    Default columns and sort for ModuleListShell (personal overrides come in US-S9-004).
                  </p>
                </section>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
