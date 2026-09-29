import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
  type TechEarnestPickerUser,
} from "@/components/TechEarnestCreate";
import { useHasPermission } from "@/features/auth/AuthContext";
import { LeadFormLayoutEditor } from "./LeadFormLayoutEditor";
import {
  checkLeadDuplicates,
  createLead,
  updateLead,
  type DuplicateCheckResult,
  type Lead,
} from "./crmApi";
import { uploadDocument } from "./foundationApi";
import {
  LEAD_COUNTRIES,
  LEAD_INDUSTRIES,
  LEAD_RATINGS,
  LEAD_SALUTATIONS,
  LEAD_SOURCES,
  LEAD_STATES,
  LEAD_STATUSES,
  noneLabel,
} from "./leadFormConstants";

const leadSchema = z.object({
  ownerId: z.string().optional(),
  regionId: z.string().min(1, "Region is required"),
  salutation: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().min(1, "Required"),
  companyName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  secondaryEmail: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  website: z.string().optional(),
  source: z.string().optional(),
  emailOptOut: z.boolean().optional(),
  industry: z.string().optional(),
  estimatedValue: z.string().optional(),
  designation: z.string().optional(),
  status: z.string().optional(),
  noOfEmployees: z.string().optional(),
  rating: z.string().optional(),
  skypeId: z.string().optional(),
  twitter: z.string().optional(),
  addressCountry: z.string().optional(),
  addressFlat: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
  addressLatitude: z.string().optional(),
  addressLongitude: z.string().optional(),
  description: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

export interface LeadCreateViewProps {
  regions: { id: string; name: string }[];
  users: TechEarnestPickerUser[];
  defaultOwnerId: string;
  defaultRegionId?: string;
  onCancel: () => void;
  onCreated: (lead: Lead, mode: "save" | "saveAndNew") => void;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const sourceOptions = enumPickerOptions(LEAD_SOURCES, noneLabel);
const industryOptions = enumPickerOptions(LEAD_INDUSTRIES, (value) => (value ? value : "None"));
const statusOptions = enumPickerOptions(LEAD_STATUSES);
const ratingOptions = enumPickerOptions(LEAD_RATINGS, noneLabel);
const countryOptions = enumPickerOptions(LEAD_COUNTRIES, noneLabel);
const stateOptions = enumPickerOptions(LEAD_STATES, noneLabel);

function buildCreateBody(values: LeadFormValues): Parameters<typeof createLead>[0] {
  return {
    regionId: values.regionId,
    ownerId: values.ownerId || undefined,
    salutation: values.salutation || undefined,
    firstName: values.firstName || undefined,
    lastName: values.lastName,
    companyName: values.companyName,
    email: values.email || undefined,
    secondaryEmail: values.secondaryEmail || undefined,
    phone: values.phone || undefined,
    mobile: values.mobile || undefined,
    fax: values.fax || undefined,
    website: values.website || undefined,
    source: values.source || undefined,
    emailOptOut: values.emailOptOut ?? false,
    industry: values.industry || undefined,
    estimatedValue: values.estimatedValue ? Number(values.estimatedValue) : undefined,
    designation: values.designation || undefined,
    status: values.status || "NEW",
    noOfEmployees: values.noOfEmployees ? Number(values.noOfEmployees) : undefined,
    rating: values.rating || undefined,
    skypeId: values.skypeId || undefined,
    twitter: values.twitter || undefined,
    addressCountry: values.addressCountry || undefined,
    addressFlat: values.addressFlat || undefined,
    addressStreet: values.addressStreet || undefined,
    addressCity: values.addressCity || undefined,
    addressState: values.addressState || undefined,
    addressZip: values.addressZip || undefined,
    addressLatitude: values.addressLatitude ? Number(values.addressLatitude) : undefined,
    addressLongitude: values.addressLongitude ? Number(values.addressLongitude) : undefined,
    description: values.description || undefined,
  };
}

function TechEarnestField({
  label,
  required,
  error,
  children,
  className = "",
  wide,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`techearnest-field${required ? " techearnest-field--required" : ""}${wide ? " techearnest-field--wide" : ""} ${className}`.trim()}
    >
      <label className={`techearnest-field-label${required ? " required" : ""}`}>{label}</label>
      <div className="techearnest-field-control">
        {children}
        {error ? <div className="invalid-feedback d-block">{error}</div> : null}
      </div>
    </div>
  );
}

export function LeadCreateView({
  regions,
  users,
  defaultOwnerId,
  defaultRegionId,
  onCancel,
  onCreated,
}: LeadCreateViewProps) {
  const canManageLayout = useHasPermission("METADATA_MANAGE");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [dupWarning, setDupWarning] = useState<DuplicateCheckResult | null>(null);
  const [pendingCreate, setPendingCreate] = useState<Parameters<typeof createLead>[0] | null>(null);
  const [saveMode, setSaveMode] = useState<"save" | "saveAndNew">("save");

  const defaults: LeadFormValues = useMemo(
    () => ({
      ownerId: defaultOwnerId,
      regionId: defaultRegionId ?? regions[0]?.id ?? "",
      salutation: "",
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      secondaryEmail: "",
      phone: "",
      mobile: "",
      fax: "",
      website: "",
      source: "",
      emailOptOut: false,
      industry: "",
      estimatedValue: "",
      designation: "",
      status: "",
      noOfEmployees: "",
      rating: "",
      skypeId: "",
      twitter: "",
      addressCountry: "",
      addressFlat: "",
      addressStreet: "",
      addressCity: "",
      addressState: "",
      addressZip: "",
      addressLatitude: "",
      addressLongitude: "",
      description: "",
    }),
    [defaultOwnerId, defaultRegionId, regions],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: defaults,
  });

  const createMutation = useMutation({
    mutationFn: async (body: Parameters<typeof createLead>[0]) => {
      const lead = await createLead(body);
      if (!photoFile) return lead;
      const doc = await uploadDocument("LEAD", lead.id, photoFile);
      return updateLead(lead.id, { photoDocumentId: doc.id });
    },
    onSuccess: (lead) => {
      setFormError(null);
      setPhotoError(null);
      setDupWarning(null);
      setPendingCreate(null);
      onCreated(lead, saveMode);
      if (saveMode === "saveAndNew") {
        clearPhoto();
        reset(defaults);
      }
    },
    onError: () => setFormError("Could not create lead. Check required fields and region."),
  });

  useEffect(() => {
    return () => {
      if (photoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  function clearPhoto() {
    if (photoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file (JPEG, PNG, GIF, or WebP).");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setPhotoError(null);
    if (photoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  async function submit(values: LeadFormValues) {
    const body = buildCreateBody(values);
    try {
      const dup = await checkLeadDuplicates({
        email: body.email,
        companyName: body.companyName,
      });
      if (dup.hasDuplicates) {
        setDupWarning(dup);
        setPendingCreate(body);
        return;
      }
    } catch {
      // allow create if duplicate check fails
    }
    createMutation.mutate(body);
  }

  function requestCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  }

  function clearAddress() {
    setValue("addressCountry", "", { shouldDirty: true });
    setValue("addressFlat", "", { shouldDirty: true });
    setValue("addressStreet", "", { shouldDirty: true });
    setValue("addressCity", "", { shouldDirty: true });
    setValue("addressState", "", { shouldDirty: true });
    setValue("addressZip", "", { shouldDirty: true });
    setValue("addressLatitude", "", { shouldDirty: true });
    setValue("addressLongitude", "", { shouldDirty: true });
  }

  const pending = isSubmitting || createMutation.isPending;

  return (
    <div className="techearnest-create-page">
      <div className="techearnest-create-topbar">
        <div className="techearnest-create-topbar-left">
          <h1 className="techearnest-create-title">Create Lead</h1>
          <button
            type="button"
            className="techearnest-create-layout-link"
            title={canManageLayout ? "Customize lead create form sections" : "View lead create form layout"}
            onClick={() => setLayoutEditorOpen(true)}
          >
            Edit Page Layout
          </button>
        </div>
        <div className="techearnest-create-topbar-actions">
          <button type="button" className="btn btn-light btn-sm techearnest-create-btn" onClick={requestCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm techearnest-create-btn"
            disabled={pending}
            onClick={() => {
              setSaveMode("saveAndNew");
              void handleSubmit(submit)();
            }}
          >
            Save and New
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm techearnest-create-btn techearnest-create-btn--save"
            disabled={pending}
            onClick={() => {
              setSaveMode("save");
              void handleSubmit(submit)();
            }}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <form
        className="techearnest-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSaveMode("save");
          void handleSubmit(submit)();
        }}
      >
        <UnsavedGuard when={isDirty} />
        <input type="hidden" {...register("regionId")} />

        {formError ? <div className="alert alert-danger py-2 mx-4 mt-3 mb-0">{formError}</div> : null}

        {dupWarning?.hasDuplicates ? (
          <div className="alert alert-warning py-2 mx-4 mt-3 mb-0">
            <div className="fw-semibold mb-1">Possible duplicates found</div>
            <ul className="mb-2 small">
              {dupWarning.matches.slice(0, 5).map((match) => (
                <li key={match.id}>
                  {match.firstName} {match.lastName} · {match.companyName ?? "—"} · {match.email ?? "—"} (
                  {match.status})
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-sm btn-warning me-2"
              onClick={() => {
                if (pendingCreate) createMutation.mutate(pendingCreate);
              }}
            >
              Create anyway
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                setDupWarning(null);
                setPendingCreate(null);
              }}
            >
              Review form
            </button>
          </div>
        ) : null}

        <div className="techearnest-create-layout" key={layoutVersion}>
          <div className="techearnest-create-fields">
            <section className="techearnest-create-section techearnest-create-section--lead-image">
              <h2 className="techearnest-create-section-title">Lead Image</h2>
              <div className="techearnest-lead-image-block">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="techearnest-create-avatar-input"
                  onChange={onPhotoSelected}
                />
                <button
                  type="button"
                  className="techearnest-lead-image-btn"
                  onClick={() => photoInputRef.current?.click()}
                  title={photoFile ? "Change lead photo" : "Upload lead photo"}
                  aria-label={photoFile ? "Change lead photo" : "Upload lead photo"}
                >
                  {photoPreviewUrl ? (
                    <img src={photoPreviewUrl} alt="" className="techearnest-lead-image-preview" />
                  ) : (
                    <span className="techearnest-lead-image-placeholder" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <circle cx="12" cy="8" r="4.25" fill="currentColor" />
                        <path
                          d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  )}
                </button>
                {photoFile ? (
                  <div className="techearnest-lead-image-actions">
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => photoInputRef.current?.click()}>
                      Change
                    </button>
                    <span className="text-muted">·</span>
                    <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={clearPhoto}>
                      Remove
                    </button>
                  </div>
                ) : null}
                {photoError ? <div className="small text-danger">{photoError}</div> : null}
              </div>
            </section>

            <section className="techearnest-create-section">
              <h2 className="techearnest-create-section-title">Lead Information</h2>
              <div className="techearnest-create-grid">
                <div className="techearnest-create-col">
                  <TechEarnestField label="Lead Owner">
                    <TechEarnestFormUserSelect
                      control={control}
                      name="ownerId"
                      users={users}
                      allowEmpty={false}
                      searchPlaceholder="Search Users"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="First Name">
                    <div className="input-group input-group-sm">
                      <select className="form-select techearnest-salutation-select" {...register("salutation")}>
                        {LEAD_SALUTATIONS.map((item) => (
                          <option key={item || "none"} value={item}>
                            {item ? item : "—None—"}
                          </option>
                        ))}
                      </select>
                      <input type="text" className="form-control" {...register("firstName")} />
                    </div>
                  </TechEarnestField>

                  <TechEarnestField label="Title" error={errors.designation?.message}>
                    <input type="text" className="form-control form-control-sm" {...register("designation")} />
                  </TechEarnestField>

                  <TechEarnestField label="Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("phone")} />
                  </TechEarnestField>

                  <TechEarnestField label="Mobile">
                    <input type="tel" className="form-control form-control-sm" {...register("mobile")} />
                  </TechEarnestField>

                  <TechEarnestField label="Lead Source">
                    <TechEarnestFormSelect
                      control={control}
                      name="source"
                      options={sourceOptions}
                      searchPlaceholder="Search Lead Sources"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Industry">
                    <TechEarnestFormSelect
                      control={control}
                      name="industry"
                      options={industryOptions}
                      searchPlaceholder="Search Industries"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Annual Revenue" error={errors.estimatedValue?.message}>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input type="number" min={0} step="0.01" className="form-control" {...register("estimatedValue")} />
                      <button type="button" className="btn btn-light techearnest-info-btn" tabIndex={-1} title="Estimated annual revenue">
                        i
                      </button>
                    </div>
                  </TechEarnestField>

                  <TechEarnestField label="Email Opt Out">
                    <div className="form-check techearnest-checkbox-field">
                      <input type="checkbox" className="form-check-input" id="leadEmailOptOut" {...register("emailOptOut")} />
                    </div>
                  </TechEarnestField>
                </div>

                <div className="techearnest-create-col">
                  <TechEarnestField label="Company" required error={errors.companyName?.message}>
                    <input
                      type="text"
                      className={`form-control form-control-sm${errors.companyName ? " is-invalid" : ""}`}
                      {...register("companyName")}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Last Name" required error={errors.lastName?.message}>
                    <input
                      type="text"
                      className={`form-control form-control-sm${errors.lastName ? " is-invalid" : ""}`}
                      {...register("lastName")}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Email" error={errors.email?.message}>
                    <input
                      type="email"
                      className={`form-control form-control-sm${errors.email ? " is-invalid" : ""}`}
                      {...register("email")}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Fax">
                    <input type="text" className="form-control form-control-sm" {...register("fax")} />
                  </TechEarnestField>

                  <TechEarnestField label="Website">
                    <input type="url" className="form-control form-control-sm" {...register("website")} />
                  </TechEarnestField>

                  <TechEarnestField label="Lead Status">
                    <TechEarnestFormSelect
                      control={control}
                      name="status"
                      options={statusOptions}
                      searchPlaceholder="Search Statuses"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="No. of Employees" error={errors.noOfEmployees?.message}>
                    <input type="number" min={0} className="form-control form-control-sm" {...register("noOfEmployees")} />
                  </TechEarnestField>

                  <TechEarnestField label="Rating">
                    <TechEarnestFormSelect
                      control={control}
                      name="rating"
                      options={ratingOptions}
                      searchPlaceholder="Search Ratings"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Skype ID">
                    <input type="text" className="form-control form-control-sm" {...register("skypeId")} />
                  </TechEarnestField>

                  <TechEarnestField label="Secondary Email" error={errors.secondaryEmail?.message}>
                    <input
                      type="email"
                      className={`form-control form-control-sm${errors.secondaryEmail ? " is-invalid" : ""}`}
                      {...register("secondaryEmail")}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Twitter">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">@</span>
                      <input type="text" className="form-control" {...register("twitter")} />
                    </div>
                  </TechEarnestField>
                </div>
              </div>
            </section>

            <section className="techearnest-create-section">
              <h2 className="techearnest-create-section-title">Address Information</h2>
              <div className="techearnest-address-box">
                <div className="techearnest-address-box-title">Address</div>
                <TechEarnestField label="Country / Region" wide>
                  <TechEarnestFormSelect
                    control={control}
                    name="addressCountry"
                    options={countryOptions}
                    searchPlaceholder="Search Countries"
                  />
                </TechEarnestField>
                <TechEarnestField label="Flat / House No. / Building / Apartment Name" wide>
                  <input type="text" className="form-control form-control-sm" {...register("addressFlat")} />
                </TechEarnestField>
                <TechEarnestField label="Street Address" wide>
                  <input type="text" className="form-control form-control-sm" {...register("addressStreet")} />
                </TechEarnestField>
                <TechEarnestField label="City" wide>
                  <input type="text" className="form-control form-control-sm" {...register("addressCity")} />
                </TechEarnestField>
                <TechEarnestField label="State / Province" wide>
                  <TechEarnestFormSelect
                    control={control}
                    name="addressState"
                    options={stateOptions}
                    searchPlaceholder="Search States"
                  />
                </TechEarnestField>
                <TechEarnestField label="Zip / Postal Code" wide>
                  <input type="text" className="form-control form-control-sm" {...register("addressZip")} />
                </TechEarnestField>
                <TechEarnestField label="Coordinates" wide>
                  <div className="techearnest-coordinates">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Latitude"
                      {...register("addressLatitude")}
                    />
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Longitude"
                      {...register("addressLongitude")}
                    />
                  </div>
                </TechEarnestField>
                <div className="techearnest-address-clear">
                  <button type="button" className="btn btn-link btn-sm" onClick={clearAddress}>
                    Clear All
                  </button>
                </div>
              </div>
            </section>

            <section className="techearnest-create-section">
              <h2 className="techearnest-create-section-title">Description Information</h2>
              <TechEarnestField label="Description" wide>
                <textarea className="form-control form-control-sm" rows={5} {...register("description")} />
              </TechEarnestField>
            </section>
          </div>
        </div>
      </form>

      <LeadFormLayoutEditor
        open={layoutEditorOpen}
        onClose={() => setLayoutEditorOpen(false)}
        onPublished={() => setLayoutVersion((value) => value + 1)}
      />
    </div>
  );
}
