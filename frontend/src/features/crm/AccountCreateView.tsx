import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
  type TechEarnestPickerUser,
} from "@/components/TechEarnestCreate";
import { FormLayoutEditorModal } from "@/components/TechEarnestCreate/FormLayoutEditorModal";
import { TechEarnestCreateField as TechEarnestField } from "@/components/TechEarnestCreate/TechEarnestCreateField";
import { TechEarnestCreateSection } from "@/components/TechEarnestCreate/TechEarnestCreateSection";
import { clearAddressFields, TechEarnestAddressBox } from "@/components/TechEarnestCreate/TechEarnestAddressBox";
import { TechEarnestRecordImage } from "@/components/TechEarnestCreate/TechEarnestRecordImage";
import { useTechEarnestRecordPhoto } from "@/components/TechEarnestCreate/useTechEarnestRecordPhoto";
import { addressPrefix, parseAddressJson, serializeAddressJson, type TechEarnestAddressValues } from "@/components/TechEarnestCreate/techearnestAddressUtils";
import { attachRecordPhoto } from "@/components/TechEarnestCreate/attachRecordPhoto";
import { createAccount, updateAccount, type Account } from "./crmApi";
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
  users: TechEarnestPickerUser[];
  accounts: { id: string; name: string }[];
  defaultOwnerId: string;
  defaultRegionId?: string;
  account?: Account;
  onCancel: () => void;
  onCreated: (account: Account, mode: "save" | "saveAndNew") => void;
}

function readAddress(values: AccountFormValues, prefix: Record<keyof TechEarnestAddressValues, keyof AccountFormValues>): TechEarnestAddressValues {
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
  account,
  onCancel,
  onCreated,
}: AccountCreateViewProps) {
  const photo = useTechEarnestRecordPhoto();
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"save" | "saveAndNew">("save");

  const defaults: AccountFormValues = useMemo(() => {
    const billing = parseAddressJson(account?.billingAddress);
    const shipping = parseAddressJson(account?.shippingAddress);
    return {
      regionId: account?.regionId ?? defaultRegionId ?? regions[0]?.id ?? "",
      ownerId: account?.ownerId ?? defaultOwnerId,
      name: account?.name ?? "",
      accountSite: "",
      parentAccountId: "",
      accountNumber: account?.taxNumber ?? "",
      accountType: account?.accountType ?? "PROSPECT",
      industry: account?.industry ?? "",
      annualRevenue: "",
      rating: "",
      email: account?.email ?? "",
      phone: account?.phone ?? "",
      fax: "",
      website: account?.website ?? "",
      tickerSymbol: "",
      ownership: "",
      employees: "",
      sicCode: "",
      status: account?.status ?? "ACTIVE",
      description: account?.description ?? "",
      billingCountry: billing.country,
      billingFlat: billing.flat,
      billingStreet: billing.street,
      billingCity: billing.city,
      billingState: billing.state,
      billingZip: billing.zip,
      billingLatitude: billing.latitude,
      billingLongitude: billing.longitude,
      shippingCountry: shipping.country,
      shippingFlat: shipping.flat,
      shippingStreet: shipping.street,
      shippingCity: shipping.city,
      shippingState: shipping.state,
      shippingZip: shipping.zip,
      shippingLatitude: shipping.latitude,
      shippingLongitude: shipping.longitude,
    };
  }, [account, defaultOwnerId, defaultRegionId, regions]);

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
    mutationFn: (body: Parameters<typeof createAccount>[0]) =>
      account ? updateAccount(account.id, body) : createAccount(body),
    onSuccess: async (account) => {
      await attachRecordPhoto("ACCOUNT", account.id, photo.photoFile);
      photo.clearPhoto();
      setFormError(null);
      onCreated(account, saveMode);
      if (!account && saveMode === "saveAndNew") {
        reset(defaults);
      }
    },
    onError: () => setFormError(account ? "Could not update account." : "Could not create account."),
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
    <div className="techearnest-create-page">
      <div className="techearnest-create-topbar">
        <div className="techearnest-create-topbar-left">
          <h1 className="techearnest-create-title">{account ? "Edit Account" : "Create Account"}</h1>
          <button type="button" className="techearnest-create-layout-link" onClick={() => setLayoutEditorOpen(true)}>
            Edit Page Layout
          </button>
        </div>
        <div className="techearnest-create-topbar-actions">
          <button type="button" className="btn btn-light btn-sm techearnest-create-btn" onClick={requestCancel}>
            Cancel
          </button>
          {!account ? <button
            type="button"
            className="btn btn-light btn-sm techearnest-create-btn"
            disabled={pending}
            onClick={() => {
              setSaveMode("saveAndNew");
              void handleSubmit(submit)();
            }}
          >
            Save and New
          </button> : null}
          <button
            type="button"
            className="btn btn-primary btn-sm techearnest-create-btn techearnest-create-btn--save"
            disabled={pending}
            onClick={() => {
              setSaveMode("save");
              void handleSubmit(submit)();
            }}
          >
            {pending ? (account ? "Updating…" : "Saving…") : account ? "Update" : "Save"}
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
        {formError ? <div className="alert alert-danger py-2 mx-4 mt-3 mb-0">{formError}</div> : null}

        <div className="techearnest-create-layout">
          <div className="techearnest-create-fields">
            <TechEarnestRecordImage
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

            <TechEarnestCreateSection title="Account Information">
              <div className="techearnest-create-grid">
                <div className="techearnest-create-col">
                  <TechEarnestField label="Account Owner">
                    <TechEarnestFormUserSelect
                      control={control}
                      name="ownerId"
                      users={users}
                      allowEmpty={false}
                      searchPlaceholder="Search Users"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Region" required error={errors.regionId?.message}>
                    <TechEarnestFormSelect
                      control={control}
                      name="regionId"
                      options={regionOptions}
                      searchPlaceholder="Search Regions"
                      invalid={!!errors.regionId}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Account Name" required error={errors.name?.message}>
                    <input
                      type="text"
                      className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
                      {...register("name")}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Account Site">
                    <input type="text" className="form-control form-control-sm" {...register("accountSite")} />
                  </TechEarnestField>

                  <TechEarnestField label="Parent Account">
                    <TechEarnestFormSelect
                      control={control}
                      name="parentAccountId"
                      options={parentAccountOptions}
                      searchPlaceholder="Search Accounts"
                      lookupIcon="building"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Account Number">
                    <input type="text" className="form-control form-control-sm" {...register("accountNumber")} />
                  </TechEarnestField>

                  <TechEarnestField label="Account Type" required error={errors.accountType?.message}>
                    <TechEarnestFormSelect
                      control={control}
                      name="accountType"
                      options={accountTypeOptions}
                      searchPlaceholder="Search Types"
                      allowEmpty={false}
                      invalid={!!errors.accountType}
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

                  <TechEarnestField label="Annual Revenue">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input type="number" min={0} step="0.01" className="form-control" {...register("annualRevenue")} />
                      <button type="button" className="btn btn-light techearnest-info-btn" tabIndex={-1} title="Annual revenue">
                        i
                      </button>
                    </div>
                  </TechEarnestField>
                </div>

                <div className="techearnest-create-col">
                  <TechEarnestField label="Rating">
                    <TechEarnestFormSelect
                      control={control}
                      name="rating"
                      options={ratingOptions}
                      searchPlaceholder="Search Ratings"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("phone")} />
                  </TechEarnestField>

                  <TechEarnestField label="Fax">
                    <input type="text" className="form-control form-control-sm" {...register("fax")} />
                  </TechEarnestField>

                  <TechEarnestField label="Website">
                    <input type="url" className="form-control form-control-sm" {...register("website")} />
                  </TechEarnestField>

                  <TechEarnestField label="Ticker Symbol">
                    <input type="text" className="form-control form-control-sm" {...register("tickerSymbol")} />
                  </TechEarnestField>

                  <TechEarnestField label="Ownership">
                    <TechEarnestFormSelect
                      control={control}
                      name="ownership"
                      options={ownershipOptions}
                      searchPlaceholder="Search Ownership"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Employees">
                    <input type="number" min={0} className="form-control form-control-sm" {...register("employees")} />
                  </TechEarnestField>

                  <TechEarnestField label="SIC Code">
                    <input type="text" className="form-control form-control-sm" {...register("sicCode")} />
                  </TechEarnestField>

                  <TechEarnestField label="Email" error={errors.email?.message}>
                    <input type="email" className="form-control form-control-sm" {...register("email")} />
                  </TechEarnestField>
                </div>
              </div>
            </TechEarnestCreateSection>

            <section className="techearnest-create-section">
              <div className="techearnest-address-section-header">
                <h2 className="techearnest-create-section-title mb-0">Address Information</h2>
                <button type="button" className="btn btn-light btn-sm" onClick={copyBillingToShipping}>
                  Copy Address
                </button>
              </div>
              <div className="techearnest-address-dual-grid">
                <TechEarnestAddressBox
                  title="Billing Address"
                  prefix={billingPrefix}
                  register={register}
                  control={control}
                  onClear={() => clearAddressFields(billingPrefix, setValue)}
                />
                <TechEarnestAddressBox
                  title="Shipping Address"
                  prefix={shippingPrefix}
                  register={register}
                  control={control}
                  onClear={() => clearAddressFields(shippingPrefix, setValue)}
                />
              </div>
            </section>

            <TechEarnestCreateSection title="Description Information">
              <TechEarnestField label="Description" wide>
                <textarea className="form-control form-control-sm" rows={5} {...register("description")} />
              </TechEarnestField>
            </TechEarnestCreateSection>
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
