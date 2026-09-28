import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  ZohoFormSelect,
  ZohoFormUserSelect,
  type ZohoPickerUser,
} from "@/components/ZohoCreate";
import { FormLayoutEditorModal } from "@/components/ZohoCreate/FormLayoutEditorModal";
import { ZohoCreateField as ZohoField } from "@/components/ZohoCreate/ZohoCreateField";
import { ZohoCreateSection } from "@/components/ZohoCreate/ZohoCreateSection";
import { clearAddressFields, ZohoAddressBox } from "@/components/ZohoCreate/ZohoAddressBox";
import { ZohoRecordImage } from "@/components/ZohoCreate/ZohoRecordImage";
import { useZohoRecordPhoto } from "@/components/ZohoCreate/useZohoRecordPhoto";
import { addressPrefix, serializeAddressJson, type ZohoAddressValues } from "@/components/ZohoCreate/zohoAddressUtils";
import { attachRecordPhoto } from "@/components/ZohoCreate/attachRecordPhoto";
import { createAccount, type Account } from "./crmApi";
import { LEAD_INDUSTRIES, LEAD_RATINGS, noneLabel } from "./leadFormConstants";

const billingPrefix = addressPrefix("billing");
const shippingPrefix = addressPrefix("shipping");

const ACCOUNT_TYPES = ["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR"] as const;
const OWNERSHIP_TYPES = ["", "Public", "Private", "Subsidiary", "Other"] as const;

const accountTypeOptions = enumPickerOptions(ACCOUNT_TYPES);
const industryOptions = enumPickerOptions(LEAD_INDUSTRIES, (value) => (value ? value : "None"));
const ratingOptions = enumPickerOptions(LEAD_RATINGS, noneLabel);
const ownershipOptions = enumPickerOptions(OWNERSHIP_TYPES, noneLabel);

const accountSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  ownerId: z.string().optional(),
  name: z.string().min(1, "Required"),
  accountSite: z.string().optional(),
  parentAccountId: z.string().optional(),
  accountNumber: z.string().optional(),
  accountType: z.string().min(1, "Type is required"),
  industry: z.string().optional(),
  annualRevenue: z.string().optional(),
  rating: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  website: z.string().optional(),
  tickerSymbol: z.string().optional(),
  ownership: z.string().optional(),
  employees: z.string().optional(),
  sicCode: z.string().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  billingCountry: z.string().optional(),
  billingFlat: z.string().optional(),
  billingStreet: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
  billingLatitude: z.string().optional(),
  billingLongitude: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingFlat: z.string().optional(),
  shippingStreet: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingZip: z.string().optional(),
  shippingLatitude: z.string().optional(),
  shippingLongitude: z.string().optional(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export interface AccountCreateViewProps {
  regions: { id: string; name: string }[];
  users: ZohoPickerUser[];
  accounts: { id: string; name: string }[];
  defaultOwnerId: string;
  defaultRegionId?: string;
  onCancel: () => void;
  onCreated: (account: Account, mode: "save" | "saveAndNew") => void;
}

function readAddress(values: AccountFormValues, prefix: Record<keyof ZohoAddressValues, keyof AccountFormValues>): ZohoAddressValues {
  return {
    country: String(values[prefix.country] ?? ""),
    flat: String(values[prefix.flat] ?? ""),
    street: String(values[prefix.street] ?? ""),
    city: String(values[prefix.city] ?? ""),
    state: String(values[prefix.state] ?? ""),
    zip: String(values[prefix.zip] ?? ""),
    latitude: String(values[prefix.latitude] ?? ""),
    longitude: String(values[prefix.longitude] ?? ""),
  };
}

function buildCreateBody(values: AccountFormValues): Parameters<typeof createAccount>[0] {
  return {
    regionId: values.regionId,
    ownerId: values.ownerId || undefined,
    name: values.name,
    accountType: values.accountType,
    industry: values.industry || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
    website: values.website || undefined,
    status: values.status || "ACTIVE",
    taxNumber: values.accountNumber || values.sicCode || undefined,
    billingAddress: serializeAddressJson(readAddress(values, billingPrefix)),
    shippingAddress: serializeAddressJson(readAddress(values, shippingPrefix)),
    description: values.description || undefined,
  };
}

export function AccountCreateView({
  regions,
  users,
  accounts,
  defaultOwnerId,
  defaultRegionId,
  onCancel,
  onCreated,
}: AccountCreateViewProps) {
  const photo = useZohoRecordPhoto();
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"save" | "saveAndNew">("save");

  const defaults: AccountFormValues = useMemo(
    () => ({
      regionId: defaultRegionId ?? regions[0]?.id ?? "",
      ownerId: defaultOwnerId,
      name: "",
      accountSite: "",
      parentAccountId: "",
      accountNumber: "",
      accountType: "PROSPECT",
      industry: "",
      annualRevenue: "",
      rating: "",
      email: "",
      phone: "",
      fax: "",
      website: "",
      tickerSymbol: "",
      ownership: "",
      employees: "",
      sicCode: "",
      status: "ACTIVE",
      description: "",
      billingCountry: "",
      billingFlat: "",
      billingStreet: "",
      billingCity: "",
      billingState: "",
      billingZip: "",
      billingLatitude: "",
      billingLongitude: "",
      shippingCountry: "",
      shippingFlat: "",
      shippingStreet: "",
      shippingCity: "",
      shippingState: "",
      shippingZip: "",
      shippingLatitude: "",
      shippingLongitude: "",
    }),
    [defaultOwnerId, defaultRegionId, regions],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: defaults,
  });

  const regionOptions = useMemo(
    () => optionsFromPairs(regions.map((region) => ({ value: region.id, label: region.name }))),
    [regions],
  );
  const parentAccountOptions = useMemo(
    () => optionsFromPairs(accounts.map((account) => ({ value: account.id, label: account.name }))),
    [accounts],
  );

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async (account) => {
      await attachRecordPhoto("ACCOUNT", account.id, photo.photoFile);
      photo.clearPhoto();
      setFormError(null);
      onCreated(account, saveMode);
      if (saveMode === "saveAndNew") {
        reset(defaults);
      }
    },
    onError: () => setFormError("Could not create account."),
  });

  function requestCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    photo.clearPhoto();
    onCancel();
  }

  function copyBillingToShipping() {
    const values = getValues();
    setValue("shippingCountry", values.billingCountry, { shouldDirty: true });
    setValue("shippingFlat", values.billingFlat, { shouldDirty: true });
    setValue("shippingStreet", values.billingStreet, { shouldDirty: true });
    setValue("shippingCity", values.billingCity, { shouldDirty: true });
    setValue("shippingState", values.billingState, { shouldDirty: true });
    setValue("shippingZip", values.billingZip, { shouldDirty: true });
    setValue("shippingLatitude", values.billingLatitude, { shouldDirty: true });
    setValue("shippingLongitude", values.billingLongitude, { shouldDirty: true });
  }

  function submit(values: AccountFormValues) {
    createMutation.mutate(buildCreateBody(values));
  }

  const pending = isSubmitting || createMutation.isPending;

  return (
    <div className="zoho-create-page">
      <div className="zoho-create-topbar">
        <div className="zoho-create-topbar-left">
          <h1 className="zoho-create-title">Create Account</h1>
          <button type="button" className="zoho-create-layout-link" onClick={() => setLayoutEditorOpen(true)}>
            Edit Page Layout
          </button>
        </div>
        <div className="zoho-create-topbar-actions">
          <button type="button" className="btn btn-light btn-sm zoho-create-btn" onClick={requestCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm zoho-create-btn"
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
            className="btn btn-primary btn-sm zoho-create-btn zoho-create-btn--save"
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
        className="zoho-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSaveMode("save");
          void handleSubmit(submit)();
        }}
      >
        <UnsavedGuard when={isDirty} />
        {formError ? <div className="alert alert-danger py-2 mx-4 mt-3 mb-0">{formError}</div> : null}

        <div className="zoho-create-layout">
          <div className="zoho-create-fields">
            <ZohoRecordImage
              photoInputRef={photo.photoInputRef}
              photoPreviewUrl={photo.photoPreviewUrl}
              photoError={photo.photoError}
              hasPhoto={!!photo.photoFile}
              onPhotoSelected={photo.onPhotoSelected}
              onPickPhoto={photo.openPhotoPicker}
              onClearPhoto={photo.clearPhoto}
              imageLabel="Account Image"
              variant="building"
            />

            <ZohoCreateSection title="Account Information">
              <div className="zoho-create-grid">
                <div className="zoho-create-col">
                  <ZohoField label="Account Owner">
                    <ZohoFormUserSelect
                      control={control}
                      name="ownerId"
                      users={users}
                      allowEmpty={false}
                      searchPlaceholder="Search Users"
                    />
                  </ZohoField>

                  <ZohoField label="Region" required error={errors.regionId?.message}>
                    <ZohoFormSelect
                      control={control}
                      name="regionId"
                      options={regionOptions}
                      searchPlaceholder="Search Regions"
                      invalid={!!errors.regionId}
                    />
                  </ZohoField>

                  <ZohoField label="Account Name" required error={errors.name?.message}>
                    <input
                      type="text"
                      className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
                      {...register("name")}
                    />
                  </ZohoField>

                  <ZohoField label="Account Site">
                    <input type="text" className="form-control form-control-sm" {...register("accountSite")} />
                  </ZohoField>

                  <ZohoField label="Parent Account">
                    <ZohoFormSelect
                      control={control}
                      name="parentAccountId"
                      options={parentAccountOptions}
                      searchPlaceholder="Search Accounts"
                      lookupIcon="building"
                    />
                  </ZohoField>

                  <ZohoField label="Account Number">
                    <input type="text" className="form-control form-control-sm" {...register("accountNumber")} />
                  </ZohoField>

                  <ZohoField label="Account Type" required error={errors.accountType?.message}>
                    <ZohoFormSelect
                      control={control}
                      name="accountType"
                      options={accountTypeOptions}
                      searchPlaceholder="Search Types"
                      allowEmpty={false}
                      invalid={!!errors.accountType}
                    />
                  </ZohoField>

                  <ZohoField label="Industry">
                    <ZohoFormSelect
                      control={control}
                      name="industry"
                      options={industryOptions}
                      searchPlaceholder="Search Industries"
                    />
                  </ZohoField>

                  <ZohoField label="Annual Revenue">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input type="number" min={0} step="0.01" className="form-control" {...register("annualRevenue")} />
                      <button type="button" className="btn btn-light zoho-info-btn" tabIndex={-1} title="Annual revenue">
                        i
                      </button>
                    </div>
                  </ZohoField>
                </div>

                <div className="zoho-create-col">
                  <ZohoField label="Rating">
                    <ZohoFormSelect
                      control={control}
                      name="rating"
                      options={ratingOptions}
                      searchPlaceholder="Search Ratings"
                    />
                  </ZohoField>

                  <ZohoField label="Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("phone")} />
                  </ZohoField>

                  <ZohoField label="Fax">
                    <input type="text" className="form-control form-control-sm" {...register("fax")} />
                  </ZohoField>

                  <ZohoField label="Website">
                    <input type="url" className="form-control form-control-sm" {...register("website")} />
                  </ZohoField>

                  <ZohoField label="Ticker Symbol">
                    <input type="text" className="form-control form-control-sm" {...register("tickerSymbol")} />
                  </ZohoField>

                  <ZohoField label="Ownership">
                    <ZohoFormSelect
                      control={control}
                      name="ownership"
                      options={ownershipOptions}
                      searchPlaceholder="Search Ownership"
                    />
                  </ZohoField>

                  <ZohoField label="Employees">
                    <input type="number" min={0} className="form-control form-control-sm" {...register("employees")} />
                  </ZohoField>

                  <ZohoField label="SIC Code">
                    <input type="text" className="form-control form-control-sm" {...register("sicCode")} />
                  </ZohoField>

                  <ZohoField label="Email" error={errors.email?.message}>
                    <input type="email" className="form-control form-control-sm" {...register("email")} />
                  </ZohoField>
                </div>
              </div>
            </ZohoCreateSection>

            <section className="zoho-create-section">
              <div className="zoho-address-section-header">
                <h2 className="zoho-create-section-title mb-0">Address Information</h2>
                <button type="button" className="btn btn-light btn-sm" onClick={copyBillingToShipping}>
                  Copy Address
                </button>
              </div>
              <div className="zoho-address-dual-grid">
                <ZohoAddressBox
                  title="Billing Address"
                  prefix={billingPrefix}
                  register={register}
                  control={control}
                  onClear={() => clearAddressFields(billingPrefix, setValue)}
                />
                <ZohoAddressBox
                  title="Shipping Address"
                  prefix={shippingPrefix}
                  register={register}
                  control={control}
                  onClear={() => clearAddressFields(shippingPrefix, setValue)}
                />
              </div>
            </section>

            <ZohoCreateSection title="Description Information">
              <ZohoField label="Description" wide>
                <textarea className="form-control form-control-sm" rows={5} {...register("description")} />
              </ZohoField>
            </ZohoCreateSection>
          </div>
        </div>
      </form>

      <FormLayoutEditorModal
        open={layoutEditorOpen}
        tableCode="account"
        entityLabel="Account"
        onClose={() => setLayoutEditorOpen(false)}
      />
    </div>
  );
}
