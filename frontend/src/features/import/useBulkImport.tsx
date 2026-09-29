import { useState, type ReactNode } from "react";
import type { ModuleMenuItem } from "@/components/ModuleListShell/ModuleListShell";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import { useHasPermission } from "@/features/auth/AuthContext";
import { BulkImportDialog } from "./BulkImportDialog";
import type { BulkImportResult } from "./bulkImportApi";
import { MODULE_IMPORT_CONFIGS, type ImportModuleKey } from "./moduleImportConfigs";

export interface BulkImportControls {
  canImport: boolean;
  openDialog: () => void;
  /** Items for the Create ▾ menu and the ⋯ menu. Hidden when the user cannot import. */
  menuItems: ModuleMenuItem[];
  /** "No records yet" panel with Create and Bulk upload buttons. */
  renderEmptyState: (options: { canCreate: boolean; createLabel: string; onCreate: () => void }) => ReactNode;
  dialog: ReactNode;
}

/**
 * Everything a module list page needs for Excel/CSV bulk upload: permission check, menu items, the empty-state
 * button and the dialog element to render once.
 */
export function useBulkImport(
  moduleKey: ImportModuleKey,
  onImported: (result: BulkImportResult) => void | Promise<void>,
): BulkImportControls {
  const config = MODULE_IMPORT_CONFIGS[moduleKey];
  const canImport = useHasPermission(config.permission);
  const [open, setOpen] = useState(false);

  const menuItems: ModuleMenuItem[] = [
    {
      id: `${config.module}-bulk-upload`,
      label: `Bulk upload ${config.plural}`,
      icon: "upload",
      visible: canImport,
      onClick: () => setOpen(true),
    },
  ];

  const renderEmptyState = ({
    canCreate,
    createLabel,
    onCreate,
  }: {
    canCreate: boolean;
    createLabel: string;
    onCreate: () => void;
  }) => (
    <div className="module-list-empty">
      <EmptyState
        workspace
        title={`No ${config.plural} yet`}
        description={
          canImport
            ? `Create your first ${config.singular}, or bulk upload many at once from an Excel or CSV file.`
            : `${capitalize(config.plural)} you create or can access will appear here.`
        }
        action={
          canCreate || canImport ? (
            <div className="module-list-empty-actions">
              {canCreate ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>
                  <ToolbarIcon name="plus" className="module-toolbar-icon" />
                  {createLabel}
                </button>
              ) : null}
              {canImport ? (
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setOpen(true)}>
                  <ToolbarIcon name="upload" className="module-toolbar-icon" />
                  Bulk upload
                </button>
              ) : null}
            </div>
          ) : null
        }
      />
    </div>
  );

  return {
    canImport,
    openDialog: () => setOpen(true),
    menuItems,
    renderEmptyState,
    dialog: (
      <BulkImportDialog
        config={config}
        open={open}
        onClose={() => setOpen(false)}
        onImported={(result) => {
          void onImported(result);
        }}
      />
    ),
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}