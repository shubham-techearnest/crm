import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { adminErrorMessage, CURRENCY_OPTIONS, LOCALE_OPTIONS, TIMEZONE_OPTIONS } from "@/features/admin/adminKit";
import { OrganizationModulePicker } from "./OrganizationModulePicker";
import { getModuleCatalog, provisionPlatformOrganization } from "./platformOrgApi";
import { linkProspectOrganization } from "./platformProspectApi";

const schema = z.object({
  name: z.string().trim().min(1, "Required"),
  slug: z
    .string()
    .min(2, "Required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  legalName: z.string().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  timezone: z.string().min(1),
  locale: z.string().min(1),
  currencyCode: z.string().length(3, "3-letter code"),
  defaultRegionName: z.string().trim().min(1, "Required"),
  defaultRegionCode: z.string().trim().min(1, "Required"),
  adminFirstName: z.string().trim().min(1, "Required"),
  adminLastName: z.string().trim().min(1, "Required"),
  adminEmail: z.string().email("Valid email required"),
  adminPassword: z.string().min(8, "At least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

const STEPS = [
  { title: "Organization", hint: "Name and locale" },
  { title: "Region", hint: "Default region" },
  { title: "Admin", hint: "Sign-in for the org" },
  { title: "Modules", hint: "Sidebar access" },
] as const;

const STEP_FIELDS: (keyof FormValues)[][] = [
  ["name", "slug", "email", "timezone", "locale", "currencyCode"],
  ["defaultRegionName", "defaultRegionCode"],
  ["adminFirstName", "adminLastName", "adminEmail", "adminPassword"],
  [],
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${body}!9`;
}

function SelectField({
  label,
  options,
  registration,
  required,
}: {
  label: string;
  options: { value: string; label: string }[];
  registration: UseFormRegisterReturn;
  required?: boolean;
}) {
  return (
    <div className="mb-3">
      <label htmlFor={registration.name} className={`form-label${required ? " required" : ""}`}>
        {label}
      </label>
      <select id={registration.name} className="form-select" {...registration}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PlatformOrganizationCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prospectId = searchParams.get("prospectId");
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[] | null>(null);

  const catalogQuery = useQuery({ queryKey: ["platform", "module-catalog"], queryFn: getModuleCatalog });
  const modules = selectedModules ?? catalogQuery.data?.map((module) => module.code) ?? [];

  const defaults = useMemo(() => {
    const name = searchParams.get("name") ?? "";
    return {
      name,
      slug: name ? slugify(name) : "",
      legalName: searchParams.get("legalName") ?? "",
      email: searchParams.get("email") ?? "",
      phone: searchParams.get("phone") ?? "",
      website: searchParams.get("website") ?? "",
      timezone: "Asia/Kolkata",
      locale: "en-IN",
      currencyCode: "INR",
      defaultRegionName: "Head Office",
      defaultRegionCode: "HQ",
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPassword: "",
    };
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const org = await provisionPlatformOrganization({
        ...values,
        currencyCode: values.currencyCode.toUpperCase(),
        slug: values.slug.toLowerCase(),
        email: values.email || undefined,
        legalName: values.legalName || undefined,
        phone: values.phone || undefined,
        website: values.website || undefined,
        modules: catalogQuery.data ? modules : undefined,
      });
      if (prospectId) {
        await linkProspectOrganization(prospectId, org.id);
      }
      return org;
    },
    onSuccess: (org) => navigate(`/platform/organizations/${org.id}?created=1`, { replace: true }),
    onError: (err) => setServerError(adminErrorMessage(err, "Could not create the organization")),
  });

  const nameField = register("name", {
    onChange: (event) => {
      if (!slugTouched) setValue("slug", slugify(event.target.value));
    },
  });
  const slugField = register("slug", { onChange: () => setSlugTouched(true) });

  async function goTo(target: number) {
    if (target <= step) {
      setStep(target);
      return;
    }
    for (let index = step; index < target; index += 1) {
      const ok = await trigger(STEP_FIELDS[index]);
      if (!ok) {
        setStep(index);
        return;
      }
    }
    setStep(target);
  }

  const lastStep = STEPS.length - 1;
  const values = watch();

  return (
    <div className="platform-page platform-create">
      <div className="platform-page-head">
        <div>
          <Link to={prospectId ? "/platform/prospects" : "/platform/organizations"} className="platform-back">
            ← {prospectId ? "Prospect Orgs" : "Organizations"}
          </Link>
          <h1 className="platform-page-title">Register organization</h1>
          <p className="platform-page-subtitle">
            {prospectId
              ? "Prefilled from the prospect. On save the prospect is linked to the new organization."
              : "Creates the organization, its default region, standard roles and the organization admin login."}
          </p>
        </div>
      </div>

      <ol className="platform-stepper">
        {STEPS.map((item, index) => (
          <li
            key={item.title}
            className={`platform-step${index === step ? " is-current" : ""}${index < step ? " is-done" : ""}`}
          >
            <button type="button" onClick={() => void goTo(index)}>
              <span className="platform-step-index">{index < step ? "✓" : index + 1}</span>
              <span className="platform-step-text">
                <span className="platform-step-title">{item.title}</span>
                <span className="platform-step-hint">{item.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {serverError ? <div className="alert alert-danger py-2">{serverError}</div> : null}

      <form
        className="platform-card platform-create-card"
        onSubmit={handleSubmit(
          (formValues) => {
            setServerError(null);
            mutation.mutate(formValues);
          },
          (formErrors) => {
            const firstInvalid = STEP_FIELDS.findIndex((fields) => fields.some((field) => formErrors[field]));
            if (firstInvalid >= 0) setStep(firstInvalid);
          },
        )}
        noValidate
      >
        {step === 0 ? (
          <div className="row">
            <div className="col-md-6">
              <FormField label="Organization name" required error={errors.name} {...nameField} />
            </div>
            <div className="col-md-6">
              <FormField
                label="Slug"
                required
                error={errors.slug}
                hint="Unique short name used in URLs"
                {...slugField}
              />
            </div>
            <div className="col-md-6">
              <FormField label="Legal name" error={errors.legalName} {...register("legalName")} />
            </div>
            <div className="col-md-6">
              <FormField label="Company email" type="email" error={errors.email} {...register("email")} />
            </div>
            <div className="col-md-6">
              <FormField label="Phone" error={errors.phone} {...register("phone")} />
            </div>
            <div className="col-md-6">
              <FormField label="Website" error={errors.website} {...register("website")} />
            </div>
            <div className="col-md-4">
              <SelectField label="Timezone" required options={TIMEZONE_OPTIONS} registration={register("timezone")} />
            </div>
            <div className="col-md-4">
              <SelectField label="Locale" required options={LOCALE_OPTIONS} registration={register("locale")} />
            </div>
            <div className="col-md-4">
              <SelectField
                label="Currency"
                required
                options={CURRENCY_OPTIONS}
                registration={register("currencyCode")}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="row">
            <div className="col-md-8">
              <FormField
                label="Default region name"
                required
                error={errors.defaultRegionName}
                {...register("defaultRegionName")}
              />
            </div>
            <div className="col-md-4">
              <FormField
                label="Region code"
                required
                error={errors.defaultRegionCode}
                {...register("defaultRegionCode")}
              />
            </div>
            <p className="text-muted small mb-0">
              The organization admin can add more regions, departments and teams after signing in.
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="row">
            <div className="col-md-6">
              <FormField label="First name" required error={errors.adminFirstName} {...register("adminFirstName")} />
            </div>
            <div className="col-md-6">
              <FormField label="Last name" required error={errors.adminLastName} {...register("adminLastName")} />
            </div>
            <div className="col-12">
              <FormField
                label="Admin email"
                type="email"
                required
                autoComplete="off"
                error={errors.adminEmail}
                hint="The organization admin signs in with this email"
                {...register("adminEmail")}
              />
            </div>
            <div className="col-12">
              <label htmlFor="adminPassword" className="form-label required">
                Admin password
              </label>
              <div className="input-group has-validation">
                <input
                  id="adminPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`form-control${errors.adminPassword ? " is-invalid" : ""}`}
                  {...register("adminPassword")}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPassword((show) => !show)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setValue("adminPassword", generatePassword(), { shouldValidate: true });
                    setShowPassword(true);
                  }}
                >
                  Generate
                </button>
                {errors.adminPassword ? (
                  <div className="invalid-feedback">{errors.adminPassword.message}</div>
                ) : null}
              </div>
              <div className="form-text">At least 8 characters. Share it with the admin securely.</div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-muted small">
              Choose which sidebar modules this organization can use. Its admin can only grant roles access to
              enabled modules. You can change this any time from the organization page.
            </p>
            {catalogQuery.isLoading ? <LoadingState label="Loading modules…" /> : null}
            {catalogQuery.isError ? (
              <div className="alert alert-warning py-2">Modules could not be loaded; every module will be enabled.</div>
            ) : null}
            {catalogQuery.data ? (
              <OrganizationModulePicker modules={catalogQuery.data} value={modules} onChange={setSelectedModules} />
            ) : null}

            <div className="platform-review">
              <h3>Review</h3>
              <dl>
                <dt>Organization</dt>
                <dd>
                  {values.name || "—"} <span className="text-muted">({values.slug || "—"})</span>
                </dd>
                <dt>Region</dt>
                <dd>
                  {values.defaultRegionName} · {values.defaultRegionCode}
                </dd>
                <dt>Admin login</dt>
                <dd>{values.adminEmail || "—"}</dd>
                <dt>Modules</dt>
                <dd>
                  {modules.length} of {catalogQuery.data?.length ?? modules.length} enabled
                </dd>
              </dl>
            </div>
          </>
        ) : null}

        <div className="platform-create-actions">
          <button
            type="button"
            className="btn btn-light border"
            disabled={step === 0 || mutation.isPending}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            Back
          </button>
          {step < lastStep ? (
            <button type="button" className="btn btn-primary" onClick={() => void goTo(step + 1)}>
              Continue
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending || catalogQuery.isLoading}
            >
              {mutation.isPending ? "Creating…" : "Create organization"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
