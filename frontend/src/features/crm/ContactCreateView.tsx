import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
  type TechEarnestPickerOption,
  type TechEarnestPickerUser,
} from "@/components/TechEarnestCreate";
import { FormLayoutEditorModal } from "@/components/TechEarnestCreate/FormLayoutEditorModal";
import { TechEarnestCreateField as TechEarnestField } from "@/components/TechEarnestCreate/TechEarnestCreateField";
import { TechEarnestCreateSection } from "@/components/TechEarnestCreate/TechEarnestCreateSection";
import { clearAddressFields, TechEarnestAddressBox } from "@/components/TechEarnestCreate/TechEarnestAddressBox";
import { TechEarnestRecordImage } from "@/components/TechEarnestCreate/TechEarnestRecordImage";
import { useTechEarnestRecordPhoto } from "@/components/TechEarnestCreate/useTechEarnestRecordPhoto";
import { addressPrefix } from "@/components/TechEarnestCreate/techearnestAddressUtils";
import { attachRecordPhoto } from "@/components/TechEarnestCreate/attachRecordPhoto";
import { useCustomFieldsForm } from "@/features/customFields/useCustomFieldsForm";
import { createAccount, createContact, type Contact } from "./crmApi";
import { LEAD_SALUTATIONS, LEAD_SOURCES, noneLabel } from "./leadFormConstants";

const leadSourceOptions = enumPickerOptions(LEAD_SOURCES, noneLabel);

const mailingPrefix = addressPrefix("mailing");
const otherPrefix = addressPrefix("other");

const contactSchema = z.object({
  ownerId: z.string().optional(),
  salutation: z.string().optional(),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  accountId: z.string().min(1, "Account is required"),
  leadSource: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  secondaryEmail: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  otherPhone: z.string().optional(),
  homePhone: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  assistant: z.string().optional(),
  asstPhone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  emailOptOut: z.boolean().optional(),
  skypeId: z.string().optional(),
  reportingTo: z.string().optional(),
  linkedinUrl: z.string().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  mailingCountry: z.string().optional(),
  mailingFlat: z.string().optional(),
  mailingStreet: z.string().optional(),
  mailingCity: z.string().optional(),
  mailingState: z.string().optional(),
  mailingZip: z.string().optional(),
  mailingLatitude: z.string().optional(),
  mailingLongitude: z.string().optional(),
  otherCountry: z.string().optional(),
  otherFlat: z.string().optional(),
  otherStreet: z.string().optional(),
  otherCity: z.string().optional(),
  otherState: z.string().optional(),
  otherZip: z.string().optional(),
  otherLatitude: z.string().optional(),
  otherLongitude: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export interface ContactCreateViewProps {
  accounts: { id: string; name: string }[];
  regions: { id: string; name: string }[];
  users: TechEarnestPickerUser[];
  defaultOwnerId: string;
  defaultAccountId?: string;
  onCancel: () => void;
  onCreated: (contact: Contact, mode: "save" | "saveAndNew") => void;
}

function buildCreateBody(values: ContactFormValues): Parameters<typeof createContact>[0] {
  return {
    accountId: values.accountId,
    ownerId: values.ownerId || undefined,
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email || undefined,
    phone: values.phone || undefined,
    mobile: values.mobile || undefined,
    designation: values.designation || undefined,
    department: values.department || undefined,
    linkedinUrl: values.linkedinUrl || undefined,
    status: values.status || "ACTIVE",
    notes: values.description || undefined,
  };
}

export function ContactCreateView({
  accounts,
  regions,
  users,
  defaultOwnerId,
  defaultAccountId,
  onCancel,
  onCreated,
}: ContactCreateViewProps) {
  const queryClient = useQueryClient();
  const photo = useTechEarnestRecordPhoto();
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"save" | "saveAndNew">("save");
  const [extraAccountOptions, setExtraAccountOptions] = useState<TechEarnestPickerOption[]>([]);

  const defaults: ContactFormValues = useMemo(
    () => ({
      ownerId: defaultOwnerId,
      salutation: "",
      firstName: "",
      lastName: "",
      accountId: defaultAccountId ?? "",
      leadSource: "",
      email: "",
      secondaryEmail: "",
      phone: "",
      otherPhone: "",
      homePhone: "",
      mobile: "",
      fax: "",
      designation: "",
      department: "",
      assistant: "",
      asstPhone: "",
      dateOfBirth: "",
      emailOptOut: false,
      skypeId: "",
      reportingTo: "",
      linkedinUrl: "",
      status: "ACTIVE",
      description: "",
      mailingCountry: "",
      mailingFlat: "",
      mailingStreet: "",
      mailingCity: "",
      mailingState: "",
      mailingZip: "",
      mailingLatitude: "",
      mailingLongitude: "",
      otherCountry: "",
      otherFlat: "",
      otherStreet: "",
      otherCity: "",
      otherState: "",
      otherZip: "",
      otherLatitude: "",
      otherLongitude: "",
    }),
    [defaultOwnerId, defaultAccountId],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty: formDirty },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: defaults,
  });
  const customFields = useCustomFieldsForm("contact");
  const isDirty = formDirty || customFields.dirty;

  const accountOptions = useMemo(
    () =>
      optionsFromPairs([
        ...accounts.map((account) => ({ value: account.id, label: account.name })),
        ...extraAccountOptions.map((option) => ({
          value: option.value,
          label: option.label,
          subtitle: option.subtitle,
        })),
      ]),
    [accounts, extraAccountOptions],
  );

  const createMutation = useMutation({
    mutationFn: createContact,
    onSuccess: async (contact) => {
      await attachRecordPhoto("CONTACT", contact.id, photo.photoFile);
      photo.clearPhoto();
      setFormError(null);
      onCreated(contact, saveMode);
      if (saveMode === "saveAndNew") {
        reset(defaults);
      }
    },
    onError: () => setFormError("Could not create contact."),
  });

  function requestCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    photo.clearPhoto();
    onCancel();
  }

  function copyMailingToOther() {
    const values = getValues();
    setValue("otherCountry", values.mailingCountry, { shouldDirty: true });
    setValue("otherFlat", values.mailingFlat, { shouldDirty: true });
    setValue("otherStreet", values.mailingStreet, { shouldDirty: true });
    setValue("otherCity", values.mailingCity, { shouldDirty: true });
    setValue("otherState", values.mailingState, { shouldDirty: true });
    setValue("otherZip", values.mailingZip, { shouldDirty: true });
    setValue("otherLatitude", values.mailingLatitude, { shouldDirty: true });
    setValue("otherLongitude", values.mailingLongitude, { shouldDirty: true });
  }

  function submit(values: ContactFormValues) {
    if (!customFields.prepareSave()) return;
    createMutation.mutate(buildCreateBody(values));
  }

  const pending = isSubmitting || createMutation.isPending;

  return (
    <div className="techearnest-create-page">
      <div className="techearnest-create-topbar">
        <div className="techearnest-create-topbar-left">
          <h1 className="techearnest-create-title">Create Contact</h1>
          <button type="button" className="techearnest-create-layout-link" onClick={() => setLayoutEditorOpen(true)}>
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
              imageLabel="Contact Image"
            />

            <TechEarnestCreateSection title="Contact Information">
              <div className="techearnest-create-grid">
                <div className="techearnest-create-col">
                  <TechEarnestField label="Contact Owner">
                    <TechEarnestFormUserSelect
                      control={control}
                      name="ownerId"
                      users={users}
                      allowEmpty={false}
                      searchPlaceholder="Search Users"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="First Name" required error={errors.firstName?.message}>
                    <div className="input-group input-group-sm">
                      <select className="form-select techearnest-salutation-select" {...register("salutation")}>
                        {LEAD_SALUTATIONS.map((item) => (
                          <option key={item || "none"} value={item}>
                            {item ? item : "—None—"}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className={`form-control${errors.firstName ? " is-invalid" : ""}`}
                        {...register("firstName")}
                      />
                    </div>
                  </TechEarnestField>

                  <TechEarnestField label="Account Name" required error={errors.accountId?.message}>
                    <TechEarnestFormSelect
                      control={control}
                      name="accountId"
                      options={accountOptions}
                      searchPlaceholder="Search Accounts"
                      lookupIcon="building"
                      lookupMode="modal"
                      lookupTitle="Select Account"
                      addNewLabel="New Account"
                      invalid={!!errors.accountId}
                      quickCreate={{
                        title: "Create Account",
                        fields: [
                          { name: "name", label: "Account Name", required: true },
                          { name: "regionId", label: "Region", type: "select", required: true,
                            options: regions.map((region) => ({ value: region.id, label: region.name })) },
                          { name: "accountType", label: "Account Type", type: "select", required: true,
                            options: ["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR"].map((type) => ({ value: type, label: type })) },
                        ],
                        submitLabel: "Save and Select",
                        onSubmit: async (values) => {
                          const account = await createAccount({
                            name: values.name.trim(), regionId: values.regionId, accountType: values.accountType,
                          });
                          const option = { value: account.id, label: account.name };
                          setExtraAccountOptions((current) => [...current, option]);
                          await queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] });
                          return option;
                        },
                      }}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Email" error={errors.email?.message}>
                    <input type="email" className="form-control form-control-sm" {...register("email")} />
                  </TechEarnestField>

                  <TechEarnestField label="Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("phone")} />
                  </TechEarnestField>

                  <TechEarnestField label="Other Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("otherPhone")} />
                  </TechEarnestField>

                  <TechEarnestField label="Mobile">
                    <input type="tel" className="form-control form-control-sm" {...register("mobile")} />
                  </TechEarnestField>

                  <TechEarnestField label="Assistant">
                    <input type="text" className="form-control form-control-sm" {...register("assistant")} />
                  </TechEarnestField>
                </div>

                <div className="techearnest-create-col">
                  <TechEarnestField label="Lead Source">
                    <TechEarnestFormSelect
                      control={control}
                      name="leadSource"
                      options={leadSourceOptions}
                      searchPlaceholder="Search Lead Sources"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Last Name" required error={errors.lastName?.message}>
                    <input
                      type="text"
                      className={`form-control form-control-sm${errors.lastName ? " is-invalid" : ""}`}
                      {...register("lastName")}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Title">
                    <input type="text" className="form-control form-control-sm" {...register("designation")} />
                  </TechEarnestField>

                  <TechEarnestField label="Department">
                    <input type="text" className="form-control form-control-sm" {...register("department")} />
                  </TechEarnestField>

                  <TechEarnestField label="Home Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("homePhone")} />
                  </TechEarnestField>

                  <TechEarnestField label="Fax">
                    <input type="text" className="form-control form-control-sm" {...register("fax")} />
                  </TechEarnestField>

                  <TechEarnestField label="Date of Birth">
                    <input type="date" className="form-control form-control-sm" {...register("dateOfBirth")} />
                  </TechEarnestField>

                  <TechEarnestField label="Asst Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("asstPhone")} />
                  </TechEarnestField>

                  <TechEarnestField label="Email Opt Out">
                    <div className="form-check techearnest-checkbox-field">
                      <input type="checkbox" className="form-check-input" id="contactEmailOptOut" {...register("emailOptOut")} />
                    </div>
                  </TechEarnestField>

                  <TechEarnestField label="Skype ID">
                    <input type="text" className="form-control form-control-sm" {...register("skypeId")} />
                  </TechEarnestField>

                  <TechEarnestField label="Secondary Email" error={errors.secondaryEmail?.message}>
                    <input type="email" className="form-control form-control-sm" {...register("secondaryEmail")} />
                  </TechEarnestField>

                  <TechEarnestField label="Reporting To">
                    <input type="text" className="form-control form-control-sm" {...register("reportingTo")} />
                  </TechEarnestField>
                </div>
              </div>
            </TechEarnestCreateSection>

            <section className="techearnest-create-section">
              <div className="techearnest-address-section-header">
                <h2 className="techearnest-create-section-title mb-0">Address Information</h2>
                <button type="button" className="btn btn-light btn-sm" onClick={copyMailingToOther}>
                  Copy Address
                </button>
              </div>
              <div className="techearnest-address-dual-grid">
                <TechEarnestAddressBox
                  title="Mailing Address"
                  prefix={mailingPrefix}
                  register={register}
                  control={control}
                  onClear={() => clearAddressFields(mailingPrefix, setValue)}
                />
                <TechEarnestAddressBox
                  title="Other Address"
                  prefix={otherPrefix}
                  register={register}
                  control={control}
                  onClear={() => clearAddressFields(otherPrefix, setValue)}
                />
              </div>
            </section>

            <TechEarnestCreateSection title="Description Information">
              <TechEarnestField label="Description" wide>
                <textarea className="form-control form-control-sm" rows={5} {...register("description")} />
              </TechEarnestField>
            </TechEarnestCreateSection>
            {customFields.section}
          </div>
        </div>
      </form>

      <FormLayoutEditorModal
        open={layoutEditorOpen}
        tableCode="contact"
        entityLabel="Contact"
        onClose={() => setLayoutEditorOpen(false)}
      />
    </div>
  );
}
