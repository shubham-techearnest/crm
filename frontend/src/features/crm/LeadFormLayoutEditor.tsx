import { FormLayoutEditorModal } from "@/components/TechEarnestCreate";

export interface LeadFormLayoutEditorProps {
  open: boolean;
  onClose: () => void;
  onPublished?: () => void;
}

export function LeadFormLayoutEditor({ open, onClose, onPublished }: LeadFormLayoutEditorProps) {
  return (
    <FormLayoutEditorModal
      open={open}
      tableCode="lead"
      entityLabel="Lead"
      layoutKey="CREATE"
      onClose={onClose}
      onPublished={onPublished}
    />
  );
}
