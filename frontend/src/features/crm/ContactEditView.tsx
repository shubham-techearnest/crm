import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import axios from "axios";
import { UnsavedGuard } from "@/components/FormKit";
import {
  enumPickerOptions,
  TechEarnestFormSelect,
  TechEarnestFormUserSelect,
  type TechEarnestPickerUser,
} from "@/components/TechEarnestCreate";
import { TechEarnestCreateField as TechEarnestField } from "@/components/TechEarnestCreate/TechEarnestCreateField";
import { TechEarnestCreateSection } from "@/components/TechEarnestCreate/TechEarnestCreateSection";
import { useCustomFieldsForm } from "@/features/customFields/useCustomFieldsForm";
import { updateContact, type Contact } from "./crmApi";
import type { ApiResponse } from "@/types/api";

const statusOptions = enumPickerOptions(["ACTIVE", "INACTIVE"]);

const contactEditSchema = z.object({
  ownerId: z.string().optional(),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  linkedinUrl: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

type ContactEditFormValues = z.infer<typeof contactEditSchema>;

export interface ContactEditViewProps {
  contact: Contact;
  accountName: string;
  users: TechEarnestPickerUser[];
  onCancel: () => void;
  onUpdated: (contact: Contact) => void;
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const payload = err.response?.data as ApiResponse<unknown> | undefined;
    if (payload?.message) return payload.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function ContactEditView({ contact, accountName, users, onCancel, onUpdated }: ContactEditViewProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const defaults: ContactEditFormValues = useMemo(
    () => ({
      ownerId: contact.ownerId ?? "",
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      mobile: contact.mobile ?? "",
      designation: contact.designation ?? "",
      department: contact.department ?? "",
      linkedinUrl: contact.linkedinUrl ?? "",
      status: contact.status,
      notes: contact.notes ?? "",
    }),
    [contact],
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty: formDirty },
  } = useForm<ContactEditFormValues>({
    resolver: zodResolver(contactEditSchema),
    defaultValues: defaults,
  });
  const customFields = useCustomFieldsForm("contact", contact.id);
  const isDirty = formDirty || customFields.dirty;

  const updateMutation = useMutation({
    mutationFn: (values: ContactEditFormValues) =>
      updateContact(contact.id, {
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
        notes: values.notes || undefined,
      }),
    onSuccess: async (updated) => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs", "CONTACT", contact.id] });
      onUpdated(updated);
    },
    onError: (err) => setFormError(errorMessage(err, "Could not update contact.")),
  });

  function requestCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    onCancel();
  }

  const pending = isSubmitting || updateMutation.isPending;

  return (
    <div className="techearnest-create-page">
      <div className="techearnest-create-topbar">
        <div className="techearnest-create-topbar-left">
          <h1 className="techearnest-create-title">Edit Contact</h1>
        </div>
        <div className="techearnest-create-topbar-actions">
          <button type="button" className="btn btn-light btn-sm techearnest-create-btn" onClick={requestCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm techearnest-create-btn techearnest-create-btn--save"
            disabled={pending}
            onClick={() => void handleSubmit((values) => customFields.prepareSave() && updateMutation.mutate(values))()}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <form
        className="techearnest-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit((values) => customFields.prepareSave() && updateMutation.mutate(values))();
        }}
      >
        <UnsavedGuard when={isDirty} />
        {formError ? <div className="alert alert-danger py-2 mx-4 mt-3 mb-0">{formError}</div> : null}

        <div className="techearnest-create-layout">
          <div className="techearnest-create-fields">
            <TechEarnestCreateSection title="Contact Information">
              <div className="techearnest-create-grid">
                <div className="techearnest-create-col">
                  <TechEarnestField label="Contact Owner">
                    <TechEarnestFormUserSelect control={control} name="ownerId" users={users} allowEmpty={false} />
                  </TechEarnestField>
                  <TechEarnestField label="First Name" required error={errors.firstName?.message}>
                    <input className="form-control form-control-sm" {...register("firstName")} />
                  </TechEarnestField>
                  <TechEarnestField label="Account Name">
                    <input className="form-control form-control-sm" value={accountName} disabled readOnly />
                  </TechEarnestField>
                  <TechEarnestField label="Email" error={errors.email?.message}>
                    <input type="email" className="form-control form-control-sm" {...register("email")} />
                  </TechEarnestField>
                  <TechEarnestField label="Phone">
                    <input type="tel" className="form-control form-control-sm" {...register("phone")} />
                  </TechEarnestField>
                  <TechEarnestField label="Mobile">
                    <input type="tel" className="form-control form-control-sm" {...register("mobile")} />
                  </TechEarnestField>
                </div>
                <div className="techearnest-create-col">
                  <TechEarnestField label="Last Name" required error={errors.lastName?.message}>
                    <input className="form-control form-control-sm" {...register("lastName")} />
                  </TechEarnestField>
                  <TechEarnestField label="Title">
                    <input className="form-control form-control-sm" {...register("designation")} />
                  </TechEarnestField>
                  <TechEarnestField label="Department">
                    <input className="form-control form-control-sm" {...register("department")} />
                  </TechEarnestField>
                  <TechEarnestField label="LinkedIn">
                    <input className="form-control form-control-sm" {...register("linkedinUrl")} />
                  </TechEarnestField>
                  <TechEarnestField label="Status">
                    <TechEarnestFormSelect control={control} name="status" options={statusOptions} allowEmpty={false} />
                  </TechEarnestField>
                </div>
              </div>
            </TechEarnestCreateSection>
            <TechEarnestCreateSection title="Description Information">
              <TechEarnestField label="Description" wide>
                <textarea className="form-control form-control-sm" rows={5} {...register("notes")} />
              </TechEarnestField>
            </TechEarnestCreateSection>
            {customFields.section}
          </div>
        </div>
      </form>
    </div>
  );
}
