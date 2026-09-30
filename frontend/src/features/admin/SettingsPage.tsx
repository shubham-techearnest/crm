import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { FormActions, FormMoreDetails, FormSection, UnsavedGuard } from "@/components/FormKit";
import { ModuleListShell } from "@/components/ModuleListShell/ModuleListShell";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { useModuleWorkspace } from "@/hooks/useModuleWorkspace";
import { getOrganization, listOrganizations, updateOrganization } from "./adminApi";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  legalName: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  timezone: z.string().min(1),
  locale: z.string().min(1),
  currencyCode: z.string().length(3),
  status: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function SettingsPage() {
  const auth = useAuth();
  const canUpdate = useHasPermission("ORG_UPDATE");
  const queryClient = useQueryClient();
  const orgId = auth.organizationId;
  const { filterOpen, setFilterOpen, viewMode, setViewMode } = useModuleWorkspace(false);
  const [showMore, setShowMore] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const orgQuery = useQuery({
    queryKey: ["admin", "organization", orgId],
    enabled: Boolean(orgId) || true,
    queryFn: async () => {
      if (!orgId) {
        const orgs = await listOrganizations();
        return orgs[0];
      }
      return getOrganization(orgId);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (orgQuery.data) {
      reset({
        name: orgQuery.data.name,
        legalName: orgQuery.data.legalName ?? "",
        email: orgQuery.data.email ?? "",
        phone: orgQuery.data.phone ?? "",
        website: orgQuery.data.website ?? "",
        timezone: orgQuery.data.timezone,
        locale: orgQuery.data.locale,
        currencyCode: orgQuery.data.currencyCode,
        status: orgQuery.data.status,
      });
    }
  }, [orgQuery.data, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateOrganization(orgQuery.data!.id, {
        name: values.name,
        legalName: values.legalName || null,
        email: values.email || null,
        phone: values.phone || null,
        website: values.website || null,
        timezone: values.timezone,
        locale: values.locale,
        currencyCode: values.currencyCode,
        status: values.status,
      }),
    onSuccess: async () => {
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "organization"] });
    },
    onError: () => setSaveError("Could not save organization settings."),
  });

  return (
    <ModuleListShell
      title="Organization settings"
      filterOpen={filterOpen}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewSelector={<span className="module-view-select">Tenant profile</span>}
      toolbarActions={
        <button
          type="button"
          className={`btn btn-sm ${filterOpen ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Info
        </button>
      }
      filterPanel={
        <>
          <p className="module-filter-heading">About</p>
          <div className="module-filter-section">
            <p className="small text-muted mb-0">
              Profile and defaults for the current tenant. Platform users without an organization should open one
              from the platform list.
            </p>
            {orgQuery.data ? (
              <p className="small mt-2 mb-0">
                Slug: <code>{orgQuery.data.slug}</code>
              </p>
            ) : null}
          </div>
        </>
      }
      onCloseFilters={() => setFilterOpen(false)}
      filterPanelTitle="About"
      footerLeft={<span>{orgQuery.data ? `Org: ${orgQuery.data.name}` : "No organization"}</span>}
    >
      {orgQuery.isLoading ? <LoadingState label="Loading settings..." /> : null}
      {orgQuery.error ? <ErrorState title="Unable to load organization" message="Try again." /> : null}
      {!orgQuery.isLoading && !orgQuery.error && !orgQuery.data ? (
        <p className="text-muted p-3 mb-0">No organization in context.</p>
      ) : null}

      {orgQuery.data ? (
        <form
          className="p-3 bg-white"
          onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        >
          <UnsavedGuard when={isDirty && canUpdate} />
          {saveError ? <div className="alert alert-danger py-2">{saveError}</div> : null}
          <FormSection title="Primary details" description="Public tenant identity">
            <div className="col-md-6">
              <FormField
                label="Name"
                required
                error={errors.name}
                disabled={!canUpdate}
                {...register("name")}
              />
            </div>
            <div className="col-md-6">
              <FormField
                label="Legal name"
                error={errors.legalName}
                disabled={!canUpdate}
                {...register("legalName")}
              />
            </div>
            <div className="col-md-4">
              <FormField
                label="Email"
                type="email"
                error={errors.email}
                disabled={!canUpdate}
                {...register("email")}
              />
            </div>
            <div className="col-md-4">
              <FormField label="Phone" error={errors.phone} disabled={!canUpdate} {...register("phone")} />
            </div>
            <div className="col-md-4">
              <FormField
                label="Website"
                error={errors.website}
                disabled={!canUpdate}
                {...register("website")}
              />
            </div>
          </FormSection>
          <FormMoreDetails open={showMore} onToggle={() => setShowMore((v) => !v)}>
            <FormSection title="Locale & status">
              <div className="col-md-4">
                <FormField
                  label="Timezone"
                  required
                  error={errors.timezone}
                  disabled={!canUpdate}
                  {...register("timezone")}
                />
              </div>
              <div className="col-md-4">
                <FormField
                  label="Locale"
                  required
                  error={errors.locale}
                  disabled={!canUpdate}
                  {...register("locale")}
                />
              </div>
              <div className="col-md-2">
                <FormField
                  label="Currency"
                  required
                  error={errors.currencyCode}
                  disabled={!canUpdate}
                  {...register("currencyCode")}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select className="form-select" disabled={!canUpdate} {...register("status")}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </FormSection>
          </FormMoreDetails>
          {canUpdate ? (
            <FormActions
              submitLabel={saveMutation.isSuccess && !isDirty ? "Saved" : "Save settings"}
              submitting={isSubmitting || saveMutation.isPending}
              onCancel={() => {
                if (isDirty && !window.confirm("Discard unsaved changes?")) return;
                if (orgQuery.data) {
                  reset({
                    name: orgQuery.data.name,
                    legalName: orgQuery.data.legalName ?? "",
                    email: orgQuery.data.email ?? "",
                    phone: orgQuery.data.phone ?? "",
                    website: orgQuery.data.website ?? "",
                    timezone: orgQuery.data.timezone,
                    locale: orgQuery.data.locale,
                    currencyCode: orgQuery.data.currencyCode,
                    status: orgQuery.data.status,
                  });
                }
                setShowMore(false);
              }}
            />
          ) : null}
        </form>
      ) : null}
    </ModuleListShell>
  );
}
