import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import axios from "axios";
import { UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  optionsFromPairs,
  ZohoFormSelect,
  ZohoFormUserSelect,
  type ZohoPickerUser,
} from "@/components/ZohoCreate";
import { ZohoCreateField as ZohoField } from "@/components/ZohoCreate/ZohoCreateField";
import { ZohoCreateSection } from "@/components/ZohoCreate/ZohoCreateSection";
import { listContacts, updateDeal, type Deal } from "./crmApi";
import { LEAD_SOURCES, noneLabel } from "./leadFormConstants";
import type { ApiResponse } from "@/types/api";

const sourceOptions = enumPickerOptions(LEAD_SOURCES, noneLabel);

const dealEditSchema = z.object({
  ownerId: z.string().optional(),
  value: z.string().optional(),
  name: z.string().min(1, "Required"),
  expectedCloseDate: z.string().optional(),
  probability: z.string().optional(),
  source: z.string().optional(),
  campaignSource: z.string().optional(),
  contactId: z.string().optional(),
  description: z.string().optional(),
});

type DealEditFormValues = z.infer<typeof dealEditSchema>;

export interface DealEditViewProps {
  deal: Deal;
  accountName: string;
  users: ZohoPickerUser[];
  onCancel: () => void;
  onUpdated: (deal: Deal) => void;
}

function contactLabel(contact: { firstName: string; lastName: string }) {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const payload = err.response?.data as ApiResponse<unknown> | undefined;
    if (payload?.message) return payload.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function DealEditView({ deal, accountName, users, onCancel, onUpdated }: DealEditViewProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const closeDateLocked = deal.stage === "WON" || deal.wonAt != null;

  const defaults: DealEditFormValues = useMemo(
    () => ({
      ownerId: deal.ownerId ?? "",
      value: deal.value != null ? String(deal.value) : "",
      name: deal.name,
      expectedCloseDate: deal.expectedCloseDate?.slice(0, 10) ?? "",
      probability: deal.probability != null ? String(deal.probability) : "",
      source: deal.source ?? "",
      campaignSource: deal.competitor ?? "",
      contactId: deal.contactId ?? "",
      description: deal.description ?? "",
    }),
    [deal],
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DealEditFormValues>({
    resolver: zodResolver(dealEditSchema),
    defaultValues: defaults,
  });

  const amountValue = useWatch({ control, name: "value" });
  const probabilityValue = useWatch({ control, name: "probability" });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "deal-edit", deal.accountId],
    queryFn: () => listContacts({ accountId: deal.accountId }),
  });

  const contactOptions = useMemo(
    () =>
      optionsFromPairs(
        (contactsQuery.data ?? []).map((contact) => ({
          value: contact.id,
          label: contactLabel(contact),
          subtitle: contact.email ?? undefined,
        })),
      ),
    [contactsQuery.data],
  );

  const expectedRevenue = useMemo(() => {
    const amount = Number(amountValue);
    const probability = Number(probabilityValue);
    if (!Number.isFinite(amount) || !Number.isFinite(probability)) return "";
    return formatCurrency((amount * probability) / 100);
  }, [amountValue, probabilityValue]);

  const updateMutation = useMutation({
    mutationFn: (values: DealEditFormValues) =>
      updateDeal(deal.id, {
        ownerId: values.ownerId || undefined,
        contactId: values.contactId || undefined,
        name: values.name,
        value: values.value ? Number(values.value) : undefined,
        probability: values.probability ? Number(values.probability) : undefined,
        expectedCloseDate: closeDateLocked ? deal.expectedCloseDate : values.expectedCloseDate || undefined,
        source: values.source || undefined,
        description: values.description || undefined,
        competitor: values.campaignSource || undefined,
      }),
    onSuccess: async (updated) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs", "DEAL", deal.id] });
      await queryClient.invalidateQueries({ queryKey: ["crm", "deals", "stage-history", deal.id] });
      onUpdated(updated);
    },
    onError: (err) => setFormError(errorMessage(err, "Could not update deal.")),
  });

  function requestCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  }

  const pending = isSubmitting || updateMutation.isPending;

  return (
    <div className="zoho-create-page">
      <div className="zoho-create-topbar">
        <div className="zoho-create-topbar-left">
          <h1 className="zoho-create-title">Edit Deal</h1>
        </div>
        <div className="zoho-create-topbar-actions">
          <button type="button" className="btn btn-light btn-sm zoho-create-btn" onClick={requestCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm zoho-create-btn zoho-create-btn--save"
            disabled={pending}
            onClick={() => void handleSubmit((values) => updateMutation.mutate(values))()}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <form
        className="zoho-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit((values) => updateMutation.mutate(values))();
        }}
      >
        <UnsavedGuard when={isDirty} />
        {formError ? <div className="alert alert-danger py-2 mx-4 mt-3 mb-0">{formError}</div> : null}
        {closeDateLocked ? (
          <div className="alert alert-info py-2 mx-4 mt-3 mb-0 small">
            This deal is won. Closing date is locked and cannot be changed.
          </div>
        ) : null}

        <div className="zoho-create-layout">
          <div className="zoho-create-fields">
            <ZohoCreateSection title="Deal Information">
              <div className="zoho-create-grid">
                <div className="zoho-create-col">
                  <ZohoField label="Deal Owner">
                    <ZohoFormUserSelect
                      control={control}
                      name="ownerId"
                      users={users}
                      allowEmpty={false}
                      searchPlaceholder="Search Users"
                    />
                  </ZohoField>
                  <ZohoField label="Amount">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input type="number" min={0} step="0.01" className="form-control" {...register("value")} />
                    </div>
                  </ZohoField>
                  <ZohoField label="Deal Name" required error={errors.name?.message}>
                    <input
                      type="text"
                      className={`form-control form-control-sm${errors.name ? " is-invalid" : ""}`}
                      {...register("name")}
                    />
                  </ZohoField>
                  <ZohoField label="Closing Date">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      disabled={closeDateLocked}
                      {...register("expectedCloseDate")}
                    />
                  </ZohoField>
                  <ZohoField label="Account Name">
                    <input type="text" className="form-control form-control-sm" value={accountName} readOnly disabled />
                  </ZohoField>
                  <ZohoField label="Probability (%)">
                    <input type="number" min={0} max={100} className="form-control form-control-sm" {...register("probability")} />
                  </ZohoField>
                </div>
                <div className="zoho-create-col">
                  <ZohoField label="Expected Revenue">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Rs.</span>
                      <input type="text" className="form-control zoho-readonly-field" readOnly value={expectedRevenue} />
                    </div>
                  </ZohoField>
                  <ZohoField label="Lead Source">
                    <ZohoFormSelect control={control} name="source" options={sourceOptions} searchPlaceholder="Search Lead Sources" />
                  </ZohoField>
                  <ZohoField label="Campaign Source">
                    <input type="text" className="form-control form-control-sm" {...register("campaignSource")} />
                  </ZohoField>
                  <ZohoField label="Contact Name">
                    <ZohoFormSelect
                      control={control}
                      name="contactId"
                      options={contactOptions}
                      mode="user"
                      searchPlaceholder="Search Contacts"
                      lookupIcon="users"
                    />
                  </ZohoField>
                </div>
              </div>
            </ZohoCreateSection>
            <ZohoCreateSection title="Description Information">
              <ZohoField label="Description" wide>
                <textarea className="form-control form-control-sm" rows={5} {...register("description")} />
              </ZohoField>
            </ZohoCreateSection>
          </div>
        </div>
      </form>
    </div>
  );
}
