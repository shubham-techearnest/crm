import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { useCustomFieldsForm } from "@/features/customFields/useCustomFieldsForm";
import { createAccount, createContact, createDeal, listContacts, type Deal } from "./crmApi";
import { LEAD_SOURCES, noneLabel } from "./leadFormConstants";

const DEAL_STAGES = [
  "NEW",
  "QUALIFICATION",
  "REQUIREMENT",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

const STAGE_DEFAULT_PROBABILITY: Record<string, number> = {
  NEW: 10,
  QUALIFICATION: 10,
  REQUIREMENT: 20,
  PROPOSAL: 50,
  NEGOTIATION: 80,
  WON: 100,
  LOST: 0,
};

const DEAL_TYPES = ["", "New Business", "Existing Business"] as const;

const stageOptions = enumPickerOptions(
  DEAL_STAGES,
  (stage) => stage.charAt(0) + stage.slice(1).toLowerCase(),
);
const dealTypeOptions = enumPickerOptions(DEAL_TYPES, noneLabel);
const sourceOptions = enumPickerOptions(LEAD_SOURCES, noneLabel);

const dealSchema = z.object({
  ownerId: z.string().optional(),
  value: z.string().optional(),
  name: z.string().min(1, "Required"),
  expectedCloseDate: z.string().optional(),
  accountId: z.string().min(1, "Account is required"),
  stage: z.string().optional(),
  dealType: z.string().optional(),
  probability: z.string().optional(),
  nextStep: z.string().optional(),
  source: z.string().optional(),
  campaignSource: z.string().optional(),
  contactId: z.string().optional(),
  description: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

export interface DealCreateViewProps {
  accounts: { id: string; name: string }[];
  regions: { id: string; name: string }[];
  users: TechEarnestPickerUser[];
  defaultOwnerId: string;
  defaultAccountId?: string;
  onCancel: () => void;
  onCreated: (deal: Deal, mode: "save" | "saveAndNew") => void;
}

function contactLabel(contact: { firstName: string; lastName: string }) {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildCreateBody(values: DealFormValues): Parameters<typeof createDeal>[0] {
  return {
    accountId: values.accountId,
    ownerId: values.ownerId || undefined,
    contactId: values.contactId || undefined,
    name: values.name,
    stage: values.stage || "QUALIFICATION",
    value: values.value ? Number(values.value) : undefined,
    probability: values.probability ? Number(values.probability) : undefined,
    expectedCloseDate: values.expectedCloseDate || undefined,
    source: values.source || undefined,
    description: values.description || undefined,
    competitor: values.campaignSource || undefined,
  };
}

export function DealCreateView({
  accounts,
  regions,
  users,
  defaultOwnerId,
  defaultAccountId,
  onCancel,
  onCreated,
}: DealCreateViewProps) {
  const queryClient = useQueryClient();
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"save" | "saveAndNew">("save");
  const [extraAccountOptions, setExtraAccountOptions] = useState<TechEarnestPickerOption[]>([]);
  const [extraContactOptions, setExtraContactOptions] = useState<TechEarnestPickerOption[]>([]);

  const defaults: DealFormValues = useMemo(
    () => ({
      ownerId: defaultOwnerId,
      value: "",
      name: "",
      expectedCloseDate: "",
      accountId: defaultAccountId ?? "",
      stage: "QUALIFICATION",
      dealType: "",
      probability: "10",
      nextStep: "",
      source: "",
      campaignSource: "",
      contactId: "",
      description: "",
    }),
    [defaultOwnerId, defaultAccountId],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty: formDirty },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: defaults,
  });
  const customFields = useCustomFieldsForm("deal");
  const isDirty = formDirty || customFields.dirty;

  const accountId = useWatch({ control, name: "accountId" });
  const amountValue = useWatch({ control, name: "value" });
  const probabilityValue = useWatch({ control, name: "probability" });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "deal-create", accountId],
    queryFn: () => listContacts({ accountId: accountId || undefined }),
    enabled: !!accountId,
  });

  const contacts = contactsQuery.data ?? [];

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
  const contactOptions = useMemo(
    () =>
      optionsFromPairs([
        ...contacts.map((contact) => ({
          value: contact.id,
          label: contactLabel(contact),
          subtitle: contact.email ?? undefined,
        })),
        ...extraContactOptions.map((option) => ({
          value: option.value,
          label: option.label,
          subtitle: option.subtitle,
        })),
      ]),
    [contacts, extraContactOptions],
  );

  const expectedRevenue = useMemo(() => {
    const amount = Number(amountValue);
    const probability = Number(probabilityValue);
    if (!Number.isFinite(amount) || !Number.isFinite(probability)) return "";
    return formatCurrency((amount * probability) / 100);
  }, [amountValue, probabilityValue]);

  const createMutation = useMutation({
    mutationFn: createDeal,
    onSuccess: (deal) => {
      setFormError(null);
      onCreated(deal, saveMode);
      if (saveMode === "saveAndNew") {
        reset(defaults);
      }
    },
    onError: () => setFormError("Could not create deal."),
  });

  function requestCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  }

  function submit(values: DealFormValues) {
    if (!customFields.prepareSave()) return;
    createMutation.mutate(buildCreateBody(values));
  }

  const pending = isSubmitting || createMutation.isPending;

  return (
    <div className="techearnest-create-page">
      <div className="techearnest-create-topbar">
        <div className="techearnest-create-topbar-left">
          <h1 className="techearnest-create-title">Create Deal</h1>
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
            <TechEarnestCreateSection title="Deal Information">
              <div className="techearnest-create-grid">
                <div className="techearnest-create-col">
                  <TechEarnestField label="Deal Owner">
                    <TechEarnestFormUserSelect
                      control={control}
                      name="ownerId"
                      users={users}
                      allowEmpty={false}
                      searchPlaceholder="Search Users"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Amount">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input type="number" min={0} step="0.01" className="form-control" {...register("value")} />
                      <button type="button" className="btn btn-light techearnest-info-btn" tabIndex={-1} title="Deal amount">
                        i
                      </button>
                    </div>
                  </TechEarnestField>

                  <TechEarnestField label="Deal Name" required error={errors.name?.message}>
                    <input
                      type="text"
                      className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
                      {...register("name")}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Closing Date">
                    <input type="date" className="form-control form-control-sm" {...register("expectedCloseDate")} />
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

                  <TechEarnestField label="Stage">
                    <TechEarnestFormSelect
                      control={control}
                      name="stage"
                      options={stageOptions}
                      searchPlaceholder="Search Stages"
                      allowEmpty={false}
                      onValueChange={(next) => {
                        const probability = STAGE_DEFAULT_PROBABILITY[next];
                        if (probability != null) {
                          setValue("probability", String(probability), { shouldDirty: true });
                        }
                      }}
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Type">
                    <TechEarnestFormSelect
                      control={control}
                      name="dealType"
                      options={dealTypeOptions}
                      searchPlaceholder="Search Types"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Probability (%)">
                    <input type="number" min={0} max={100} className="form-control form-control-sm" {...register("probability")} />
                  </TechEarnestField>
                </div>

                <div className="techearnest-create-col">
                  <TechEarnestField label="Next Step">
                    <input type="text" className="form-control form-control-sm" {...register("nextStep")} />
                  </TechEarnestField>

                  <TechEarnestField label="Expected Revenue">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input
                        type="text"
                        className="form-control techearnest-readonly-field"
                        readOnly
                        value={expectedRevenue}
                        tabIndex={-1}
                        aria-readonly="true"
                      />
                      <span className="input-group-text techearnest-lock-icon" aria-hidden="true">
                        <svg viewBox="0 0 16 16" width="12" height="12" focusable="false">
                          <path
                            d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <rect x="3.5" y="7" width="9" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                      </span>
                    </div>
                  </TechEarnestField>

                  <TechEarnestField label="Lead Source">
                    <TechEarnestFormSelect
                      control={control}
                      name="source"
                      options={sourceOptions}
                      searchPlaceholder="Search Lead Sources"
                    />
                  </TechEarnestField>

                  <TechEarnestField label="Campaign Source">
                    <input type="text" className="form-control form-control-sm" {...register("campaignSource")} />
                  </TechEarnestField>

                  <TechEarnestField label="Contact Name">
                    <TechEarnestFormSelect
                      control={control}
                      name="contactId"
                      options={contactOptions}
                      mode="user"
                      searchPlaceholder="Search Contacts"
                      lookupIcon="users"
                      lookupMode="modal"
                      lookupTitle="Select Contact"
                      addNewLabel="New Contact"
                      disabled={!accountId}
                      quickCreate={{
                        title: "Create Contact",
                        fields: [
                          { name: "firstName", label: "First Name", required: true },
                          { name: "lastName", label: "Last Name", required: true },
                          { name: "email", label: "Email", type: "email" },
                        ],
                        submitLabel: "Save and Select",
                        onSubmit: async (values) => {
                          const contact = await createContact({
                            accountId,
                            firstName: values.firstName.trim(),
                            lastName: values.lastName.trim(),
                            email: values.email?.trim() || undefined,
                          });
                          const option = {
                            value: contact.id,
                            label: contactLabel(contact),
                            subtitle: contact.email ?? undefined,
                          };
                          setExtraContactOptions((current) => [...current, option]);
                          await queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
                          return option;
                        },
                      }}
                    />
                  </TechEarnestField>
                </div>
              </div>
            </TechEarnestCreateSection>

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
        tableCode="deal"
        entityLabel="Deal"
        onClose={() => setLayoutEditorOpen(false)}
      />
    </div>
  );
}
