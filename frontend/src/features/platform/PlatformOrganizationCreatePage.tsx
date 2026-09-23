import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField/FormField";
import { provisionPlatformOrganization } from "./platformOrgApi";
import { linkProspectOrganization } from "./platformProspectApi";

const schema = z.object({
  name: z.string().min(1, "Required"),
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
  defaultRegionName: z.string().min(1, "Required"),
  defaultRegionCode: z.string().min(1, "Required"),
  adminFirstName: z.string().min(1, "Required"),
  adminLastName: z.string().min(1, "Required"),
  adminEmail: z.string().email("Valid email required"),
  adminPassword: z.string().min(8, "At least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function PlatformOrganizationCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prospectId = searchParams.get("prospectId");
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);

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
    formState: { errors, isSubmitting },
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
      });
      if (prospectId) {
        await linkProspectOrganization(prospectId, org.id);
      }
      return org;
    },
    onSuccess: (org) => navigate(`/platform/organizations/${org.id}`, { replace: true }),
    onError: (err: Error) => setServerError(err.message || "Create failed"),
  });

  async function goNext() {
    const fields =
      step === 1
        ? (["name", "slug", "timezone", "locale", "currencyCode"] as const)
        : step === 2
          ? (["defaultRegionName", "defaultRegionCode"] as const)
          : (["adminFirstName", "adminLastName", "adminEmail", "adminPassword"] as const);
    const ok = await trigger(fields);
    if (ok) {
      setStep((s) => Math.min(3, s + 1));
    }
  }

  return (
    <div className="mw-100" style={{ maxWidth: 640 }}>
      <div className="mb-3">
        <Link to={prospectId ? "/platform/prospects" : "/platform/organizations"} className="small">
          ← {prospectId ? "Prospect Orgs" : "Organizations"}
        </Link>
        <h1 className="h3 mt-2 mb-1">Create organization</h1>
        <p className="text-muted mb-0">
          {prospectId
            ? "Prefill from prospect. On save, prospect is linked to the new tenant org."
            : "Provisions tenant org, default region, roles, and primary admin."}
        </p>
      </div>

      <div className="d-flex gap-2 mb-3 small">
        <span className={step === 1 ? "fw-semibold" : "text-muted"}>1. Organization</span>
        <span className="text-muted">·</span>
        <span className={step === 2 ? "fw-semibold" : "text-muted"}>2. Region</span>
        <span className="text-muted">·</span>
        <span className={step === 3 ? "fw-semibold" : "text-muted"}>3. Admin</span>
      </div>

      {serverError ? <div className="alert alert-danger py-2">{serverError}</div> : null}

      <form
        className="border rounded p-3 bg-light"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
        noValidate
      >
        {step === 1 ? (
          <>
            <FormField label="Name" required error={errors.name} {...register("name")} />
            <FormField label="Slug" required error={errors.slug} {...register("slug")} />
            <FormField label="Legal name" error={errors.legalName} {...register("legalName")} />
            <FormField label="Email" error={errors.email} {...register("email")} />
            <FormField label="Timezone" required error={errors.timezone} {...register("timezone")} />
            <FormField label="Locale" required error={errors.locale} {...register("locale")} />
            <FormField label="Currency" required error={errors.currencyCode} {...register("currencyCode")} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <FormField
              label="Default region name"
              required
              error={errors.defaultRegionName}
              {...register("defaultRegionName")}
            />
            <FormField
              label="Default region code"
              required
              error={errors.defaultRegionCode}
              {...register("defaultRegionCode")}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <FormField
              label="Admin first name"
              required
              error={errors.adminFirstName}
              {...register("adminFirstName")}
            />
            <FormField
              label="Admin last name"
              required
              error={errors.adminLastName}
              {...register("adminLastName")}
            />
            <FormField label="Admin email" required error={errors.adminEmail} {...register("adminEmail")} />
            <FormField
              label="Admin password"
              type="password"
              required
              error={errors.adminPassword}
              {...register("adminPassword")}
            />
          </>
        ) : null}

        <div className="d-flex justify-content-between mt-3">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Back
          </button>
          {step < 3 ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={goNext}>
              Continue
            </button>
          ) : (
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create organization"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
