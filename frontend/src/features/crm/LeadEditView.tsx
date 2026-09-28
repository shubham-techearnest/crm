import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import axios from "axios";
import { UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  ZohoFormSelect,
  ZohoFormUserSelect,
  type ZohoPickerUser,
} from "@/components/ZohoCreate";
import { ZohoCreateField as ZohoField } from "@/components/ZohoCreate/ZohoCreateField";
import { ZohoCreateSection } from "@/components/ZohoCreate/ZohoCreateSection";
import { updateLead, type Lead } from "./crmApi";
import { LEAD_SOURCES, LEAD_STATUSES, noneLabel } from "./leadFormConstants";
import type { ApiResponse } from "@/types/api";

const statusOptions = enumPickerOptions(LEAD_STATUSES);
const priorityOptions = enumPickerOptions(["LOW", "MEDIUM", "HIGH"]);
const sourceOptions = enumPickerOptions(LEAD_SOURCES, noneLabel);

const leadEditSchema = z.object({
  ownerId: z.string().optional(),
  companyName: z.string().min(1, "Required"),
  firstName: z.string().optional(),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  estimatedValue: z.string().optional(),
  description: z.string().optional(),
});

type LeadEditFormValues = z.infer<typeof leadEditSchema>;

export interface LeadEditViewProps {
  lead: Lead;
  users: ZohoPickerUser[];
  onCancel: () => void;
  onUpdated: (lead: Lead) => void;
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const payload = err.response?.data as ApiResponse<unknown> | undefined;
    if (payload?.message) return payload.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function LeadEditView({ lead, users, onCancel, onUpdated }: LeadEditViewProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const readOnly = lead.status === "CONVERTED";

  const defaults: LeadEditFormValues = useMemo(
    () => ({
      ownerId: lead.ownerId ?? "",
      companyName: lead.companyName ?? "",
      firstName: lead.firstName ?? "",
      lastName: lead.lastName ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      mobile: lead.mobile ?? "",
      source: lead.source ?? "",
      status: lead.status,
      priority: lead.priority ?? "",
      estimatedValue: lead.estimatedValue != null ? String(lead.estimatedValue) : "",
      description: lead.description ?? "",
    }),
    [lead],
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<LeadEditFormValues>({
    resolver: zodResolver(leadEditSchema),
    defaultValues: defaults,
  });

  const updateMutation = useMutation({
    mutationFn: (values: LeadEditFormValues) =>
      updateLead(lead.id, {
        ownerId: values.ownerId || undefined,
        companyName: values.companyName,
        firstName: values.firstName || undefined,
        lastName: values.lastName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        mobile: values.mobile || undefined,
        source: values.source || undefined,
        status: values.status || undefined,
        priority: values.priority || undefined,
        estimatedValue: values.estimatedValue ? Number(values.estimatedValue) : undefined,
        description: values.description || undefined,
      }),
    onSuccess: async (updated) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs", "LEAD", lead.id] });
      onUpdated(updated);
    },
    onError: (err) => setFormError(errorMessage(err, "Could not update lead.")),
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
          <h1 className="zoho-create-title">Edit Lead</h1>
        </div>
        <div className="zoho-create-topbar-actions">
          <button type="button" className="btn btn-light btn-sm zoho-create-btn" onClick={requestCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm zoho-create-btn zoho-create-btn--save"
            disabled={pending || readOnly}
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
        {readOnly ? (
          <div className="alert alert-warning py-2 mx-4 mt-3 mb-0 small">
            Converted leads cannot be edited.
          </div>
        ) : null}

        <div className="zoho-create-layout">
          <div className="zoho-create-fields">
            <ZohoCreateSection title="Lead Information">
              <div className="zoho-create-grid">
                <div className="zoho-create-col">
                  <ZohoField label="Lead Owner">
                    <ZohoFormUserSelect control={control} name="ownerId" users={users} allowEmpty={false} disabled={readOnly} />
                  </ZohoField>
                  <ZohoField label="Company" required error={errors.companyName?.message}>
                    <input className="form-control form-control-sm" disabled={readOnly} {...register("companyName")} />
                  </ZohoField>
                  <ZohoField label="First Name">
                    <input className="form-control form-control-sm" disabled={readOnly} {...register("firstName")} />
                  </ZohoField>
                  <ZohoField label="Last Name" required error={errors.lastName?.message}>
                    <input className="form-control form-control-sm" disabled={readOnly} {...register("lastName")} />
                  </ZohoField>
                  <ZohoField label="Email" error={errors.email?.message}>
                    <input type="email" className="form-control form-control-sm" disabled={readOnly} {...register("email")} />
                  </ZohoField>
                </div>
                <div className="zoho-create-col">
                  <ZohoField label="Phone">
                    <input className="form-control form-control-sm" disabled={readOnly} {...register("phone")} />
                  </ZohoField>
                  <ZohoField label="Mobile">
                    <input className="form-control form-control-sm" disabled={readOnly} {...register("mobile")} />
                  </ZohoField>
                  <ZohoField label="Lead Source">
                    <ZohoFormSelect control={control} name="source" options={sourceOptions} disabled={readOnly} />
                  </ZohoField>
                  <ZohoField label="Status">
                    <ZohoFormSelect control={control} name="status" options={statusOptions} allowEmpty={false} disabled={readOnly} />
                  </ZohoField>
                  <ZohoField label="Priority">
                    <ZohoFormSelect control={control} name="priority" options={priorityOptions} disabled={readOnly} />
                  </ZohoField>
                  <ZohoField label="Estimated Value">
                    <input type="number" className="form-control form-control-sm" disabled={readOnly} {...register("estimatedValue")} />
                  </ZohoField>
                </div>
              </div>
            </ZohoCreateSection>
            <ZohoCreateSection title="Description Information">
              <ZohoField label="Description" wide>
                <textarea className="form-control form-control-sm" rows={5} disabled={readOnly} {...register("description")} />
              </ZohoField>
            </ZohoCreateSection>
          </div>
        </div>
      </form>
    </div>
  );
}
