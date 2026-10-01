import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  optionsFromPairs,
  TechEarnestCreateColumn,
  TechEarnestCreateField,
  TechEarnestCreateGrid,
  TechEarnestCreateSection,
  TechEarnestFormKitCreateView,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
} from "@/components/TechEarnestCreate";
import {
  TechEarnestRecordInfoSection,
  TechEarnestRecordRelatedCard,
  TechEarnestRecordSummaryStrip,
  useRecordNavigation,
} from "@/components/TechEarnestRecord";
import { RecordShell } from "@/components/RecordShell";
import { RecordLink, RelatedRecordList } from "@/components/RecordLink";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { ModuleListTable } from "@/components/ModuleListShell/ModuleListTable";
import { TechEarnestFilterSelect } from "@/components/TechEarnestCreate/TechEarnestFilterSelect";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { useUrlSelection } from "@/hooks/useUrlRecord";
import {
  createRegion,
  getRegion,
  listRegions,
  listUsers,
  regionUpdateBody,
  updateRegion,
  type AdminUser,
  type Region,
  type RegionBody,
} from "./adminApi";
import {
  ACTIVE_STATUS_OPTIONS,
  AdminRecordTimeline,
  adminErrorMessage,
  blankToNull,
  confirmDiscard,
  CURRENCY_OPTIONS,
  dash,
  formatDateTime,
  fullName,
  inputClass,
  TIMEZONE_OPTIONS,
  useUserLabel,
  withCurrentOption,
} from "./adminKit";

const schema = z.object({
  name: z.string().trim().min(1, "Region name is required").max(128),
  code: z
    .string()
    .trim()
    .min(1, "Region code is required")
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _"),
  parentId: z.string().optional(),
  managerId: z.string().optional(),
  status: z.string().min(1),
  timezone: z.string().optional(),
  currencyCode: z.string().optional(),
  description: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  name: "",
  code: "",
  parentId: "",
  managerId: "",
  status: "ACTIVE",
  timezone: "",
  currencyCode: "",
  description: "",
};

function toFormValues(region: Region): FormValues {
  return {
    name: region.name,
    code: region.code,
    parentId: region.parentId ?? "",
    managerId: region.managerId ?? "",
    status: region.status,
    timezone: region.timezone ?? "",
    currencyCode: region.currencyCode ?? "",
    description: region.description ?? "",
  };
}

function toBody(values: FormValues): RegionBody {
  return {
    name: values.name.trim(),
    parentId: values.parentId || null,
    managerId: values.managerId || null,
    status: values.status,
    timezone: values.timezone || null,
    currencyCode: values.currencyCode ? values.currencyCode.toUpperCase() : null,
    description: blankToNull(values.description),
  };
}

/** Ids of the region and all of its descendants, which can't become its parent. */
function descendantIds(regions: Region[], rootId: string) {
  const result = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const region of regions) {
      if (region.parentId && result.has(region.parentId) && !result.has(region.id)) {
        result.add(region.id);
        grew = true;
      }
    }
  }
  return result;
}

function RegionForm({
  region,
  regions,
  users,
  onCancel,
  onSaved,
}: {
  region: Region | null;
  regions: Region[];
  users: AdminUser[];
  onCancel: () => void;
  onSaved: (region: Region, again: boolean) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: region ? toFormValues(region) : DEFAULTS,
  });

  const saveMutation = useMutation({
    mutationFn: ({ values }: { values: FormValues; again: boolean }) =>
      region
        ? updateRegion(region.id, toBody(values))
        : createRegion({ ...toBody(values), code: values.code.trim().toUpperCase() }),
    onSuccess: (saved, { again }) => {
      setFormError(null);
      if (again) reset(DEFAULTS);
      onSaved(saved, again);
    },
    onError: (error) =>
      setFormError(adminErrorMessage(error, region ? "Could not update the region." : "Could not create the region. Check the code is unique.")),
  });

  const submit = (again: boolean) => void handleSubmit((values) => saveMutation.mutate({ values, again }))();

  const parentOptions = useMemo(() => {
    const blocked = region ? descendantIds(regions, region.id) : new Set<string>();
    return optionsFromPairs(
      regions.filter((r) => !blocked.has(r.id)).map((r) => ({ value: r.id, label: r.name, subtitle: r.code })),
    );
  }, [regions, region]);

  return (
    <TechEarnestFormKitCreateView
      title={region ? `Edit ${region.name}` : "Create Region"}
      tableCode="region"
      recordId={region?.id}
      entityLabel="Region"
      pending={saveMutation.isPending}
      isDirty={isDirty}
      formError={formError}
      onCancel={() => confirmDiscard(isDirty) && onCancel()}
      onSave={() => submit(false)}
      onSaveAndNew={region ? undefined : () => submit(true)}
      onSubmit={() => submit(false)}
      showRecordImage={false}
    >
      <TechEarnestCreateSection title="Region Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Region Name" required error={errors.name?.message}>
              <input type="text" className={inputClass(errors.name)} {...register("name")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField
              label="Region Code"
              required
              error={errors.code?.message}
              hint={region ? "The code can't be changed after creation." : "Short unique code, e.g. APAC"}
            >
              <input
                type="text"
                className={inputClass(errors.code)}
                style={{ textTransform: "uppercase" }}
                disabled={!!region}
                {...register("code")}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Parent Region">
              <TechEarnestFormSelect
                control={control}
                name="parentId"
                options={parentOptions}
                searchPlaceholder="Search Regions"
                placeholder="None (top level)"
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Region Manager">
              <TechEarnestFormUserSelect control={control} name="managerId" users={users} placeholder="Select manager" />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Status" required error={errors.status?.message}>
              <TechEarnestFormSelect control={control} name="status" options={ACTIVE_STATUS_OPTIONS} allowEmpty={false} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Locale Defaults">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Time Zone" hint="Leave empty to use the organization time zone.">
              <TechEarnestFormSelect
                control={control}
                name="timezone"
                options={withCurrentOption(TIMEZONE_OPTIONS, watch("timezone"))}
                searchPlaceholder="Search Time Zones"
                placeholder="Organization default"
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Currency" hint="Leave empty to use the organization currency.">
              <TechEarnestFormSelect
                control={control}
                name="currencyCode"
                options={withCurrentOption(CURRENCY_OPTIONS, watch("currencyCode"))}
                searchPlaceholder="Search Currencies"
                placeholder="Organization default"
              />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Description Information">
        <TechEarnestCreateField label="Description" wide error={errors.description?.message}>
          <textarea className={inputClass(errors.description)} rows={3} {...register("description")} />
        </TechEarnestCreateField>
      </TechEarnestCreateSection>
    </TechEarnestFormKitCreateView>
  );
}

export function RegionsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission("REGION_MANAGE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const { filterOpen, setFilterOpen, viewMode, setViewMode, search, setSearch } = useModuleWorkspace();
  const [statusFilter, setStatusFilter] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const regionsQuery = useQuery({ queryKey: ["admin", "regions"], queryFn: listRegions });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
    retry: false,
  });
  const regions = regionsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const userLabel = useUserLabel(usersQuery.data);
  const [selected, setSelected] = useUrlSelection(regionsQuery.data, { fetchById: getRegion });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "regions"] });

  const regionName = useMemo(() => {
    const map = new Map(regions.map((r) => [r.id, r.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [regions]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regions.filter((region) => {
      if (statusFilter && region.status !== statusFilter) return false;
      if (parentFilter && region.parentId !== parentFilter) return false;
      if (!q) return true;
      return [region.name, region.code, regionName(region.parentId), region.description ?? ""]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [regions, search, statusFilter, parentFilter, regionName]);

  const recordNav = useRecordNavigation(rows, selected, (item) => {
    setActionError(null);
    setSelected(item);
  });

  const statusMutation = useMutation({
    mutationFn: ({ region, status }: { region: Region; status: string }) =>
      updateRegion(region.id, regionUpdateBody(region, { status })),
    onSuccess: async (region) => {
      setActionError(null);
      setSelected(region);
      await invalidate();
    },
    onError: (error) => setActionError(adminErrorMessage(error, "Could not change the region status.")),
  });

  const parentOptions = useMemo(
    () => optionsFromPairs(regions.map((r) => ({ value: r.id, label: r.name }))),
    [regions],
  );

  if (formMode && canManage) {
    return (
      <RegionForm
        key={formMode === "edit" ? selected?.id : "new"}
        region={formMode === "edit" ? selected : null}
        regions={regions}
        users={users}
        onCancel={() => setFormMode(null)}
        onSaved={(region, again) => {
          void invalidate();
          if (again) return;
          setFormMode(null);
          setSelected(region);
        }}
      />
    );
  }

  if (selected) {
    const children = regions.filter((r) => r.parentId === selected.id);
    const members = users.filter((u) => u.regionId === selected.id || u.regionIds.includes(selected.id));
    return (
      <RecordShell
        layout="page"
        title={selected.name}
        subtitle={selected.code}
        avatarLabel={selected.name}
        avatarVariant="building"
        status={<StatusBadge status={selected.status} />}
        recordKey={selected.id}
        customFieldsTable="region"
        onBack={recordNav.goBack}
        onPrev={recordNav.goPrev}
        onNext={recordNav.goNext}
        hasPrev={recordNav.hasPrev}
        hasNext={recordNav.hasNext}
        relatedLinks={[
          { id: "sub-regions", label: "Sub-regions" },
          { id: "users", label: "Users" },
        ]}
        primaryAction={
          canManage ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode("edit")}>
              Edit
            </button>
          ) : null
        }
        secondaryActions={
          canManage ? (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({ region: selected, status: selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
              }
            >
              {selected.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </button>
          ) : null
        }
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
                {actionError ? <div className="alert alert-danger py-2 small">{actionError}</div> : null}
                <TechEarnestRecordSummaryStrip
                  fields={[
                    { label: "Region Code", value: <code>{selected.code}</code> },
                    { label: "Parent Region", value: <RecordLink module="region" id={selected.parentId}>{regionName(selected.parentId)}</RecordLink> },
                    { label: "Manager", value: <RecordLink module="user" id={selected.managerId}>{userLabel(selected.managerId)}</RecordLink> },
                    { label: "Users", value: canViewUsers ? members.length : "—" },
                    { label: "Status", value: <StatusBadge status={selected.status} /> },
                  ]}
                />
                <TechEarnestRecordInfoSection
                  title="Region Information"
                  fields={[
                    { label: "Region Name", value: selected.name },
                    { label: "Region Code", value: selected.code },
                    { label: "Parent Region", value: regionName(selected.parentId) },
                    { label: "Region Manager", value: userLabel(selected.managerId) },
                    { label: "Time Zone", value: dash(selected.timezone) },
                    { label: "Currency", value: dash(selected.currencyCode) },
                    { label: "Status", value: selected.status },
                    { label: "Created", value: formatDateTime(selected.createdAt) },
                    { label: "Modified", value: formatDateTime(selected.updatedAt) },
                  ]}
                />
                {selected.description ? (
                  <TechEarnestRecordInfoSection
                    title="Description Information"
                    collapsible={false}
                    fields={[{ label: "Description", value: selected.description }]}
                  />
                ) : null}
                <TechEarnestRecordRelatedCard
                  id="techearnest-record-section-sub-regions"
                  title={`Sub-regions (${children.length})`}
                  isEmpty={!children.length}
                >
                  <RelatedRecordList
                    module="region"
                    items={children.map((r) => ({ id: r.id, label: r.name, secondary: r.code, trailing: <StatusBadge status={r.status} /> }))}
                  />
                </TechEarnestRecordRelatedCard>
                <TechEarnestRecordRelatedCard
                  id="techearnest-record-section-users"
                  title={`Users (${members.length})`}
                  isEmpty={!members.length}
                  emptyLabel={canViewUsers ? "No users in this region" : "You don't have access to users"}
                >
                  <RelatedRecordList
                    module="user"
                    loading={usersQuery.isLoading}
                    items={members.map((u) => ({
                      id: u.id,
                      label: fullName(u),
                      secondary: u.regionId === selected.id ? "Home region" : "Region access",
                      trailing: <StatusBadge status={u.status} />,
                    }))}
                  />
                </TechEarnestRecordRelatedCard>
              </>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            content: <AdminRecordTimeline entityType="REGION" entityLabel="Region" record={selected} userLabel={userLabel} />,
          },
        ]}
      />
    );
  }

  return (
    <ModuleListShell
      title="Regions"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">All Regions</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter
        </button>
      }
      primaryAction={
        canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode("create")}>
            Add region
          </button>
        ) : null
      }
      filterPanel={
        <>
          <p className="module-filter-heading">Filter Regions by</p>
          <div className="module-filter-section">
            <h3>Search</h3>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, or parent"
            />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={ACTIVE_STATUS_OPTIONS} placeholder="All statuses" emptyLabel="All statuses" searchPlaceholder="Search region statuses" />
          </div>
          <div className="module-filter-section">
            <TechEarnestFilterSelect label="Parent Region" value={parentFilter} onChange={setParentFilter} options={parentOptions} placeholder="Any parent" emptyLabel="Any parent" searchPlaceholder="Search regions" />
          </div>
        </>
      }
      activeFilterCount={[search.trim(), statusFilter, parentFilter].filter(Boolean).length}
      onClearFilters={() => {
        setSearch("");
        setStatusFilter("");
        setParentFilter("");
      }}
      onCloseFilters={() => setFilterOpen(false)}
      footerLeft={<span>Total Records: {rows.length}</span>}
    >
      {regionsQuery.isLoading ? <LoadingState label="Loading regions..." /> : null}
      {regionsQuery.error ? <ErrorState title="Unable to load regions" message="Try again." /> : null}

      {!regionsQuery.isLoading && !regionsQuery.error ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {viewMode === "list" ? (
            <ModuleListTable
              tableCode="region"
              defaultColumns={[
                { field: "name", label: "Name" },
                { field: "code", label: "Code" },
                { field: "status", label: "Status" },
                { field: "parentId", label: "Parent" },
                { field: "managerId", label: "Manager" },
                { field: "currencyCode", label: "Currency" },
              ]}
              rows={rows}
              rowKey={(region) => region.id}
              onRowClick={(region) => setSelected(region)}
              bulk={{
                noun: "regions",
                exportFileName: "regions",
                onComplete: () => void invalidate(),
                actions: [
                  {
                    id: "activate",
                    label: "Activate",
                    tone: "success",
                    visible: canManage,
                    doneLabel: "activated",
                    applies: (region) => region.status !== "ACTIVE",
                    run: (region) => updateRegion(region.id, regionUpdateBody(region, { status: "ACTIVE" })),
                  },
                  {
                    id: "deactivate",
                    label: "Deactivate",
                    tone: "warning",
                    visible: canManage,
                    doneLabel: "deactivated",
                    applies: (region) => region.status === "ACTIVE",
                    confirm: "Inactive regions stay on existing records but should not be used for new ones.",
                    run: (region) => updateRegion(region.id, regionUpdateBody(region, { status: "INACTIVE" })),
                  },
                ],
              }}
              renderCell={(region, field) => {
                if (field === "code") return <code>{region.code}</code>;
                if (field === "status") return <StatusBadge status={region.status} />;
                if (field === "parentId") return regionName(region.parentId);
                if (field === "managerId") return userLabel(region.managerId);
                const value = (region as unknown as Record<string, unknown>)[field];
                return value == null || value === "" ? "—" : String(value);
              }}
              nameFields={["name"]}
              emptyMessage="No regions match the current filters."
            />
          ) : (
            <div className="module-tile-grid">
              {rows.map((region) => (
                <button key={region.id} type="button" className="module-tile text-start" onClick={() => setSelected(region)}>
                  <div className="tile-title">{region.name}</div>
                  <div className="small text-muted">
                    {region.code} · {region.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModuleListShell>
  );
}
