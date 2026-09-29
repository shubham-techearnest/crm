/**
 * Importable modules. Target fields are not listed here: they come from the server schema
 * (GET /imports/{module}/schema) so the importer is the single source of truth.
 */
export interface ModuleImportConfig {
  module: string;
  singular: string;
  plural: string;
  permission: string;
}

export const MODULE_IMPORT_CONFIGS = {
  leads: { module: "leads", singular: "lead", plural: "leads", permission: "LEAD_IMPORT" },
  contacts: { module: "contacts", singular: "contact", plural: "contacts", permission: "CONTACT_IMPORT" },
  accounts: { module: "accounts", singular: "account", plural: "accounts", permission: "ACCOUNT_IMPORT" },
  deals: { module: "deals", singular: "deal", plural: "deals", permission: "DEAL_IMPORT" },
  projects: { module: "projects", singular: "project", plural: "projects", permission: "PROJECT_IMPORT" },
  resources: { module: "resources", singular: "resource", plural: "resources", permission: "RESOURCE_IMPORT" },
  invoices: { module: "invoices", singular: "invoice", plural: "invoices", permission: "INVOICE_IMPORT" },
  "purchase-orders": {
    module: "purchase-orders",
    singular: "purchase order",
    plural: "purchase orders",
    permission: "PO_IMPORT",
  },
} satisfies Record<string, ModuleImportConfig>;

export type ImportModuleKey = keyof typeof MODULE_IMPORT_CONFIGS;
