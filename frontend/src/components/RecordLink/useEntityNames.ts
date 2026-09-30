import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useHasPermission } from "@/features/auth/AuthContext";
import { listAccounts, listContacts, listDeals, listLeads } from "@/features/crm/crmApi";
import { listProjects } from "@/features/projects/projectApi";
import { RECORD_ROUTES, recordModuleForEntityType } from "./recordRoutes";

interface EntityRef {
  entityType: string;
  entityId: string;
}

/**
 * Resolves display names for polymorphic references (activities, documents, notes, audit rows).
 * Only lists the modules that actually appear in `refs`, and only when the user can view them.
 */
export function useEntityNames(refs: EntityRef[] | undefined) {
  const types = useMemo(() => new Set((refs ?? []).map((ref) => recordModuleForEntityType(ref.entityType))), [refs]);
  const canViewLeads = useHasPermission("LEAD_VIEW");
  const canViewContacts = useHasPermission("CONTACT_VIEW");
  const canViewAccounts = useHasPermission("ACCOUNT_VIEW");
  const canViewDeals = useHasPermission("DEAL_VIEW");
  const canViewProjects = useHasPermission("PROJECT_VIEW");

  const leads = useQuery({
    queryKey: ["crm", "leads", "list", {}],
    queryFn: () => listLeads(),
    enabled: canViewLeads && types.has("lead"),
  });
  const contacts = useQuery({
    queryKey: ["crm", "contacts", {}],
    queryFn: () => listContacts(),
    enabled: canViewContacts && types.has("contact"),
  });
  const accounts = useQuery({
    queryKey: ["crm", "accounts"],
    queryFn: () => listAccounts(),
    enabled: canViewAccounts && types.has("account"),
  });
  const deals = useQuery({
    queryKey: ["crm", "deals", {}],
    queryFn: () => listDeals(),
    enabled: canViewDeals && types.has("deal"),
  });
  const projects = useQuery({
    queryKey: ["projects", "list", {}],
    queryFn: () => listProjects(),
    enabled: canViewProjects && types.has("project"),
  });

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of leads.data ?? []) {
      map.set(lead.id, [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.companyName || "Lead");
    }
    for (const contact of contacts.data ?? []) map.set(contact.id, `${contact.firstName} ${contact.lastName}`.trim());
    for (const account of accounts.data ?? []) map.set(account.id, account.name);
    for (const deal of deals.data ?? []) map.set(deal.id, deal.name);
    for (const project of projects.data ?? []) map.set(project.id, project.name);
    return map;
  }, [leads.data, contacts.data, accounts.data, deals.data, projects.data]);

  /** "Acme Corp (Account)", or "Account · 1a2b3c4d" when the name isn't available. */
  return useCallback(
    (entityType: string, entityId: string) => {
      const module = recordModuleForEntityType(entityType);
      const typeLabel = module ? RECORD_ROUTES[module].label : entityType;
      const name = names.get(entityId);
      return name ? `${name} (${typeLabel})` : `${typeLabel} · ${entityId.slice(0, 8)}`;
    },
    [names],
  );
}
