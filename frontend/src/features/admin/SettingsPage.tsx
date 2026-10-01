import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
} from "@/components/TechEarnestCreate";
import { Link } from "react-router-dom";
import {
  TechEarnestRecordInfoSection,
  TechEarnestRecordSection,
  TechEarnestRecordSummaryStrip,
} from "@/components/TechEarnestRecord";
import { RecordShell } from "@/components/RecordShell";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { getOrganization, listOrganizations, listUsers, updateOrganization, type Organization } from "./adminApi";
import {
  AdminRecordTimeline,
  adminErrorMessage,
  blankToNull,
  confirmDiscard,
  CURRENCY_OPTIONS,
  dash,
  formatDateTime,
  inputClass,
  LOCALE_OPTIONS,
  TIMEZONE_OPTIONS,
  useUserLabel,
  withCurrentOption,
} from "./adminKit";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_OPTIONS = MONTHS.map((label, index) => ({ value: String(index + 1), label }));
const DATE_FORMAT_OPTIONS = optionsFromPairs(
  ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "dd MMM yyyy"].map((value) => ({
    value,
    label: value,
    subtitle: formatSample(value),
  })),
);
const TIME_FORMAT_OPTIONS = [
  { value: "12h", label: "12 hour (02:30 PM)" },
  { value: "24h", label: "24 hour (14:30)" },
];
const WEEK_START_OPTIONS = [
  { value: "MONDAY", label: "Monday" },
  { value: "SUNDAY", label: "Sunday" },
  { value: "SATURDAY", label: "Saturday" },
];
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
];

function formatSample(pattern: string) {
  const sample = new Date(2026, 2, 31);
  const dd = String(sample.getDate()).padStart(2, "0");
  const mm = String(sample.getMonth() + 1).padStart(2, "0");
  return pattern
    .replace("yyyy", String(sample.getFullYear()))
    .replace("MMM", sample.toLocaleString("en-GB", { month: "short" }))
    .replace("MM", mm)
    .replace("dd", dd);
}

const optionalUrl = z
  .string()
  .trim()
  .max(255)
  .refine((value) => !value || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(value), "Enter a valid website")
  .optional();

const schema = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(255),
  legalName: z.string().max(255).optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  website: optionalUrl,
  taxId: z.string().max(64).optional(),
  status: z.string().min(1),
  addressLine: z.string().max(255).optional(),
  city: z.string().max(128).optional(),
  state: z.string().max(128).optional(),
  country: z.string().max(128).optional(),
  postalCode: z.string().max(32).optional(),
  timezone: z.string().min(1, "Time zone is required"),
  locale: z.string().min(1, "Locale is required"),
  currencyCode: z.string().regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code"),
  dateFormat: z.string().min(1),
  timeFormat: z.string().min(1),
  weekStartDay: z.string().min(1),
  fiscalYearStartMonth: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

function toFormValues(org: Organization): FormValues {
  return {
    name: org.name,
    legalName: org.legalName ?? "",
    email: org.email ?? "",
    phone: org.phone ?? "",
    website: org.website ?? "",
    taxId: org.taxId ?? "",
    status: org.status,
    addressLine: org.addressLine ?? "",
    city: org.city ?? "",
    state: org.state ?? "",
    country: org.country ?? "",
    postalCode: org.postalCode ?? "",
    timezone: org.timezone,
    locale: org.locale,
    currencyCode: org.currencyCode,
    dateFormat: org.dateFormat ?? "dd/MM/yyyy",
    timeFormat: org.timeFormat ?? "12h",
    weekStartDay: org.weekStartDay ?? "MONDAY",
    fiscalYearStartMonth: String(org.fiscalYearStartMonth ?? 4),
  };
}

function SettingsForm({ org, onCancel, onSaved }: { org: Organization; onCancel: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(org) });

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateOrganization(org.id, {
        name: values.name.trim(),
        legalName: blankToNull(values.legalName),
        email: blankToNull(values.email),
        phone: blankToNull(values.phone),
        website: blankToNull(values.website),
        taxId: blankToNull(values.taxId),
        status: values.status,
        addressLine: blankToNull(values.addressLine),
        city: blankToNull(values.city),
        state: blankToNull(values.state),
        country: blankToNull(values.country),
        postalCode: blankToNull(values.postalCode),
        timezone: values.timezone,
        locale: values.locale,
        currencyCode: values.currencyCode.toUpperCase(),
        dateFormat: values.dateFormat,
        timeFormat: values.timeFormat,
        weekStartDay: values.weekStartDay,
        fiscalYearStartMonth: Number(values.fiscalYearStartMonth),
      }),
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "organization"] });
      onSaved();
    },
    onError: (error) => setFormError(adminErrorMessage(error, "Could not save organization settings.")),
  });

  const submit = () => void handleSubmit((values) => saveMutation.mutate(values))();

  return (
    <TechEarnestFormKitCreateView
      title="Edit Organization Settings"
      entityLabel="Organization"
      pending={saveMutation.isPending}
      isDirty={isDirty}
      formError={formError}
      onCancel={() => confirmDiscard(isDirty) && onCancel()}
      onSave={submit}
      onSubmit={submit}
      showRecordImage={false}
    >
      <TechEarnestCreateSection title="Organization Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Organization Name" required error={errors.name?.message}>
              <input type="text" className={inputClass(errors.name)} {...register("name")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Email" error={errors.email?.message}>
              <input type="email" className={inputClass(errors.email)} {...register("email")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Website" error={errors.website?.message}>
              <input type="text" className={inputClass(errors.website)} placeholder="https://example.com" {...register("website")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Status" required>
              <TechEarnestFormSelect control={control} name="status" options={STATUS_OPTIONS} allowEmpty={false} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Legal Name" error={errors.legalName?.message}>
              <input type="text" className={inputClass(errors.legalName)} {...register("legalName")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Phone" error={errors.phone?.message}>
              <input type="tel" className={inputClass(errors.phone)} {...register("phone")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Tax ID / GSTIN" error={errors.taxId?.message}>
              <input type="text" className={inputClass(errors.taxId)} {...register("taxId")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Slug" hint="Used in URLs and can't be changed.">
              <input type="text" className={inputClass()} value={org.slug} disabled readOnly />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Address Information">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Street" error={errors.addressLine?.message}>
              <input type="text" className={inputClass(errors.addressLine)} {...register("addressLine")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="State" error={errors.state?.message}>
              <input type="text" className={inputClass(errors.state)} {...register("state")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Zip / Postal Code" error={errors.postalCode?.message}>
              <input type="text" className={inputClass(errors.postalCode)} {...register("postalCode")} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="City" error={errors.city?.message}>
              <input type="text" className={inputClass(errors.city)} {...register("city")} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Country" error={errors.country?.message}>
              <input type="text" className={inputClass(errors.country)} {...register("country")} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>

      <TechEarnestCreateSection title="Locale & Formats">
        <TechEarnestCreateGrid>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Time Zone" required error={errors.timezone?.message}>
              <TechEarnestFormSelect
                control={control}
                name="timezone"
                options={withCurrentOption(TIMEZONE_OPTIONS, watch("timezone"))}
                searchPlaceholder="Search Time Zones"
                allowEmpty={false}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Currency" required error={errors.currencyCode?.message}>
              <TechEarnestFormSelect
                control={control}
                name="currencyCode"
                options={withCurrentOption(CURRENCY_OPTIONS, watch("currencyCode"))}
                searchPlaceholder="Search Currencies"
                allowEmpty={false}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Time Format" required>
              <TechEarnestFormSelect control={control} name="timeFormat" options={TIME_FORMAT_OPTIONS} allowEmpty={false} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Fiscal Year Starts" required hint="Used for fiscal-year reports and targets.">
              <TechEarnestFormSelect control={control} name="fiscalYearStartMonth" options={MONTH_OPTIONS} allowEmpty={false} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
          <TechEarnestCreateColumn>
            <TechEarnestCreateField label="Locale" required error={errors.locale?.message}>
              <TechEarnestFormSelect
                control={control}
                name="locale"
                options={withCurrentOption(LOCALE_OPTIONS, watch("locale"))}
                searchPlaceholder="Search Locales"
                allowEmpty={false}
              />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Date Format" required>
              <TechEarnestFormSelect control={control} name="dateFormat" options={DATE_FORMAT_OPTIONS} allowEmpty={false} />
            </TechEarnestCreateField>
            <TechEarnestCreateField label="Week Starts On" required>
              <TechEarnestFormSelect control={control} name="weekStartDay" options={WEEK_START_OPTIONS} allowEmpty={false} />
            </TechEarnestCreateField>
          </TechEarnestCreateColumn>
        </TechEarnestCreateGrid>
      </TechEarnestCreateSection>
    </TechEarnestFormKitCreateView>
  );
}

const CUSTOMIZABLE_TABLES = [
  { code: "lead", label: "Leads" },
  { code: "account", label: "Accounts" },
  { code: "contact", label: "Contacts" },
  { code: "deal", label: "Deals" },
  { code: "project", label: "Projects" },
  { code: "project_task", label: "Tasks" },
  { code: "resource", label: "Resources" },
  { code: "user", label: "Users" },
  { code: "role", label: "Roles" },
  { code: "region", label: "Regions" },
  { code: "department", label: "Departments" },
  { code: "team", label: "Teams" },
];

function CustomizationPanel({
  canViewMetadata,
  canViewAcl,
  canViewFieldAcl,
}: {
  canViewMetadata: boolean;
  canViewAcl: boolean;
  canViewFieldAcl: boolean;
}) {
  return (
    <>
      {canViewMetadata ? (
        <TechEarnestRecordSection title="Fields & Form Layouts">
          <p className="small text-muted">
            Add custom fields to any table, then arrange them on the create/edit form. Custom fields show up in
            Manage Columns on the list view and on each record's overview. Standard fields keep their built-in
            positions.
          </p>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-2">
              <thead>
                <tr>
                  <th>Module</th>
                  <th className="text-end">Customize</th>
                </tr>
              </thead>
              <tbody>
                {CUSTOMIZABLE_TABLES.map((table) => (
                  <tr key={table.code}>
                    <td>{table.label}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link className="btn btn-outline-secondary" to={`/admin/studio?table=${table.code}&tab=fields`}>
                          Fields
                        </Link>
                        <Link className="btn btn-outline-secondary" to={`/admin/studio?table=${table.code}&tab=form`}>
                          Form layout
                        </Link>
                        <Link className="btn btn-outline-secondary" to={`/admin/studio?table=${table.code}&tab=list`}>
                          List layout
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link to="/admin/studio" className="btn btn-link btn-sm px-0">
            Open Metadata Studio for all tables
          </Link>
        </TechEarnestRecordSection>
      ) : null}
      {canViewAcl || canViewFieldAcl ? (
        <TechEarnestRecordSection title="Access Control">
          <p className="small text-muted">Control which roles can read or edit each table and each field, including custom fields.</p>
          <div className="d-flex gap-2">
            {canViewAcl ? (
              <Link to="/admin/acl-matrix" className="btn btn-outline-secondary btn-sm">
                Table ACL
              </Link>
            ) : null}
            {canViewFieldAcl ? (
              <Link to="/admin/field-acl" className="btn btn-outline-secondary btn-sm">
                Field ACL
              </Link>
            ) : null}
          </div>
        </TechEarnestRecordSection>
      ) : null}
    </>
  );
}

export function SettingsPage() {
  const auth = useAuth();
  const canUpdate = useHasPermission("ORG_UPDATE");
  const canViewUsers = useHasPermission("USER_VIEW");
  const canViewMetadata = useHasPermission("METADATA_VIEW");
  const canViewAcl = useHasPermission("ACL_VIEW");
  const canViewFieldAcl = useHasPermission("FIELD_ACL_VIEW");
  const orgId = auth.organizationId;
  const [editing, setEditing] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const orgQuery = useQuery({
    queryKey: ["admin", "organization", orgId],
    queryFn: async () => {
      if (!orgId) {
        const orgs = await listOrganizations();
        return orgs[0] ?? null;
      }
      return getOrganization(orgId);
    },
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
    retry: false,
  });
  const userLabel = useUserLabel(usersQuery.data);

  if (orgQuery.isLoading) return <LoadingState label="Loading settings..." />;
  if (orgQuery.error) return <ErrorState title="Unable to load organization" message="Try again." />;
  const org = orgQuery.data;
  if (!org) return <p className="text-muted p-3 mb-0">No organization in context.</p>;

  if (editing && canUpdate) {
    return (
      <SettingsForm
        org={org}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          setSavedNotice(true);
        }}
      />
    );
  }

  const address = [org.addressLine, org.city, org.state, org.country].filter(Boolean).join(", ");
  const monthName = MONTHS[(org.fiscalYearStartMonth ?? 4) - 1] ?? "—";

  return (
    <RecordShell
      layout="page"
      title={org.name}
      subtitle={org.legalName ?? undefined}
      avatarLabel={org.name}
      avatarVariant="building"
      status={<StatusBadge status={org.status} />}
      recordKey={org.id}
      relatedLinks={[
        { id: "address", label: "Address" },
        { id: "locale", label: "Locale & Formats" },
      ]}
      primaryAction={
        canUpdate ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setSavedNotice(false);
              setEditing(true);
            }}
          >
            Edit
          </button>
        ) : null
      }
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <>
              {savedNotice ? <div className="alert alert-success py-2 small">Organization settings saved.</div> : null}
              <TechEarnestRecordSummaryStrip
                fields={[
                  { label: "Slug", value: <code>{org.slug}</code> },
                  { label: "Currency", value: org.currencyCode },
                  { label: "Time Zone", value: org.timezone },
                  { label: "Fiscal Year Starts", value: monthName },
                  { label: "Status", value: <StatusBadge status={org.status} /> },
                ]}
              />
              <TechEarnestRecordInfoSection
                title="Organization Information"
                fields={[
                  { label: "Organization Name", value: org.name },
                  { label: "Legal Name", value: dash(org.legalName) },
                  { label: "Email", value: dash(org.email) },
                  { label: "Phone", value: dash(org.phone) },
                  { label: "Website", value: dash(org.website) },
                  { label: "Tax ID / GSTIN", value: dash(org.taxId) },
                  { label: "Status", value: org.status },
                  { label: "Created", value: formatDateTime(org.createdAt) },
                  { label: "Modified", value: formatDateTime(org.updatedAt) },
                ]}
              />
              <section id="techearnest-record-section-address">
                <TechEarnestRecordInfoSection
                  title="Address Information"
                  collapsible={false}
                  fields={[
                    { label: "Address", value: address || "—" },
                    { label: "Zip / Postal Code", value: dash(org.postalCode) },
                  ]}
                />
              </section>
              <section id="techearnest-record-section-locale">
                <TechEarnestRecordInfoSection
                  title="Locale & Formats"
                  fields={[
                    { label: "Time Zone", value: TIMEZONE_OPTIONS.find((o) => o.value === org.timezone)?.label ?? org.timezone },
                    { label: "Locale", value: LOCALE_OPTIONS.find((o) => o.value === org.locale)?.label ?? org.locale },
                    { label: "Currency", value: CURRENCY_OPTIONS.find((o) => o.value === org.currencyCode)?.label ?? org.currencyCode },
                    { label: "Date Format", value: `${org.dateFormat} (${formatSample(org.dateFormat)})` },
                    { label: "Time Format", value: TIME_FORMAT_OPTIONS.find((o) => o.value === org.timeFormat)?.label ?? org.timeFormat },
                    { label: "Week Starts On", value: WEEK_START_OPTIONS.find((o) => o.value === org.weekStartDay)?.label ?? org.weekStartDay },
                    { label: "Fiscal Year Starts", value: monthName },
                  ]}
                />
              </section>
            </>
          ),
        },
        ...(canViewMetadata || canViewAcl || canViewFieldAcl
          ? [
              {
                id: "customization",
                label: "Customization",
                content: (
                  <CustomizationPanel
                    canViewMetadata={canViewMetadata}
                    canViewAcl={canViewAcl}
                    canViewFieldAcl={canViewFieldAcl}
                  />
                ),
              },
            ]
          : []),
        {
          id: "timeline",
          label: "Timeline",
          content: <AdminRecordTimeline entityType="ORGANIZATION" entityLabel="Organization" record={org} userLabel={userLabel} />,
        },
      ]}
    />
  );
}
