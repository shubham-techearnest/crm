import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  ZohoFormSelect,
  ZohoFormUserSelect,
  type ZohoPickerOption,
  type ZohoPickerUser,
} from "@/components/ZohoCreate";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import { FormLayoutEditorModal } from "@/components/ZohoCreate/FormLayoutEditorModal";
import { ZohoCreateField as ZohoField } from "@/components/ZohoCreate/ZohoCreateField";
import { ZohoCreateSection } from "@/components/ZohoCreate/ZohoCreateSection";
import { clearAddressFields, ZohoAddressBox } from "@/components/ZohoCreate/ZohoAddressBox";
import { ZohoRecordImage } from "@/components/ZohoCreate/ZohoRecordImage";
import { useZohoRecordPhoto } from "@/components/ZohoCreate/useZohoRecordPhoto";
import { addressPrefix } from "@/components/ZohoCreate/zohoAddressUtils";
import { attachRecordPhoto } from "@/components/ZohoCreate/attachRecordPhoto";
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
  users: ZohoPickerUser[];
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
  users,
  defaultOwnerId,
  defaultAccountId,
  onCancel,
  onCreated,
}: ContactCreateViewProps) {
  const queryClient = useQueryClient();
  const photo = useZohoRecordPhoto();
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"save" | "saveAndNew">("save");
  const [extraAccountOptions, setExtraAccountOptions] = useState<ZohoPickerOption[]>([]);

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
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: defaults,
  });

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
    createMutation.mutate(buildCreateBody(values));
  }

  const pending = isSubmitting || createMutation.isPending;

  return (
    <div className="zoho-create-page">
      <div className="zoho-create-topbar">
        <div className="zoho-create-topbar-left">
          <h1 className="zoho-create-title">Create Contact</h1>
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
              imageLabel="Contact Image"
            />

            <ZohoCreateSection title="Contact Information">
              <div className="zoho-create-grid">
                <div className="zoho-create-col">
                  <ZohoField label="Contact Owner">
                    <ZohoFormUserSelect
                      control={control}
                      name="ownerId"
                      users={users}
                      allowEmpty={false}
                      searchPlaceholder="Search Users"
                    />
                  </ZohoField>

                  <ZohoField label="First Name" required error={errors.firstName?.message}>
                    <div className="input-group input-group-sm">
                      <select className="form-select zoho-salutation-select" {...register("salutation")}>
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
                  </ZohoField>

                  <ZohoField label="Account Name" required error={errors.accountId?.message}>
                    <ZohoFormSelect
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
                        fields: [{ name: "name", label: "Account Name", required: true }],
                        submitLabel: "Save and Select",
                        onSubmit: async (values) => {
                          const account = await createAccount({ name: values.name.trim() });
                          const option = { value: account.id, label: account.name };
                          setExtraAccountOptions((current) => [...current, option]);
                          await queryClient.invalidateQueries({ queryKey: ["crm", "accounts"] });
                          return option;
                        },
                      }}
                    />
                  </ZohoField>

                  <ZohoField label="Email" error={errors.email?.message}>
                    <input type="email" className="form-control form-control-sm" {...register("email")} />
                  </ZohoField>

                  <ZohoField label="Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("phone")} />
                  </ZohoField>

                  <ZohoField label="Other Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("otherPhone")} />
                  </ZohoField>

                  <ZohoField label="Mobile">
                    <input type="tel" className="form-control form-control-sm" {...register("mobile")} />
                  </ZohoField>

                  <ZohoField label="Assistant">
                    <input type="text" className="form-control form-control-sm" {...register("assistant")} />
                  </ZohoField>
                </div>

                <div className="zoho-create-col">
                  <ZohoField label="Lead Source">
                    <ZohoFormSelect
                      control={control}
                      name="leadSource"
                      options={leadSourceOptions}
                      searchPlaceholder="Search Lead Sources"
                    />
                  </ZohoField>

                  <ZohoField label="Last Name" required error={errors.lastName?.message}>
                    <input
                      type="text"
                      className={`form-control form-control-sm${errors.lastName ? " is-invalid" : ""}`}
                      {...register("lastName")}
                    />
                  </ZohoField>

                  <ZohoField label="Title">
                    <input type="text" className="form-control form-control-sm" {...register("designation")} />
                  </ZohoField>

                  <ZohoField label="Department">
                    <input type="text" className="form-control form-control-sm" {...register("department")} />
                  </ZohoField>

                  <ZohoField label="Home Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("homePhone")} />
                  </ZohoField>

                  <ZohoField label="Fax">
                    <input type="text" className="form-control form-control-sm" {...register("fax")} />
                  </ZohoField>

                  <ZohoField label="Date of Birth">
                    <input type="date" className="form-control form-control-sm" {...register("dateOfBirth")} />
                  </ZohoField>

                  <ZohoField label="Asst Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("asstPhone")} />
                  </ZohoField>

                  <ZohoField label="Email Opt Out">
                    <div className="form-check zoho-checkbox-field">
                      <input type="checkbox" className="form-check-input" id="contactEmailOptOut" {...register("emailOptOut")} />
                    </div>
                  </ZohoField>

                  <ZohoField label="Skype ID">
                    <input type="text" className="form-control form-control-sm" {...register("skypeId")} />
                  </ZohoField>

                  <ZohoField label="Secondary Email" error={errors.secondaryEmail?.message}>
                    <input type="email" className="form-control form-control-sm" {...register("secondaryEmail")} />
                  </ZohoField>

                  <ZohoField label="Reporting To">
                    <div className="input-group input-group-sm">
                      <input type="text" className="form-control" {...register("reportingTo")} />
                      <button type="button" className="btn btn-light zoho-lookup-btn" tabIndex={-1} aria-hidden="true">
                        <ToolbarIcon name="users" />
                      </button>
                    </div>
                  </ZohoField>
                </div>
              </div>
            </ZohoCreateSection>

            <section className="zoho-create-section">
              <div className="zoho-address-section-header">
                <h2 className="zoho-create-section-title mb-0">Address Information</h2>
                <button type="button" className="btn btn-light btn-sm" onClick={copyMailingToOther}>
                  Copy Address
                </button>
              </div>
              <div className="zoho-address-dual-grid">
                <ZohoAddressBox
                  title="Mailing Address"
                  prefix={mailingPrefix}
                  register={register}
                  control={control}
                  onClear={() => clearAddressFields(mailingPrefix, setValue)}
                />
                <ZohoAddressBox
                  title="Other Address"
                  prefix={otherPrefix}
                  register={register}
                  control={control}
                  onClear={() => clearAddressFields(otherPrefix, setValue)}
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
        tableCode="contact"
        entityLabel="Contact"
        onClose={() => setLayoutEditorOpen(false)}
      />
    </div>
  );
}
