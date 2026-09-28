import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { ErrorState } from "@/components/ErrorState/ErrorState";
import {
  listPortalDocuments,
  listPortalInvoices,
  listPortalProjects,
  type PortalDocumentSummary,
  type PortalInvoiceSummary,
  type PortalProjectSummary,
} from "./portalApi";

type PortalTab = "projects" | "invoices" | "documents";

export function PortalListPage({ tab }: { tab: PortalTab }) {
  const query = useQuery({
    queryKey: ["portal", tab],
    queryFn: () => {
      if (tab === "projects") return listPortalProjects();
      if (tab === "invoices") return listPortalInvoices();
      return listPortalDocuments();
    },
  });

  if (query.isLoading) return <LoadingState label="Loading…" />;
  if (query.error) return <ErrorState title="Unable to load" message="Try again later." />;

  const title = tab === "projects" ? "Projects" : tab === "invoices" ? "Invoices" : "Documents";

  return (
    <div>
      <h1 className="h3 mb-3">{title}</h1>
      <div className="card">
        <table className="table mb-0">
          <thead>
            <tr>
              {tab === "projects" ? (
                <>
                  <th>Name</th>
                  <th>Status</th>
                  <th>End date</th>
                </>
              ) : null}
              {tab === "invoices" ? (
                <>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Due</th>
                </>
              ) : null}
              {tab === "documents" ? (
                <>
                  <th>File</th>
                  <th>Related</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row) => {
              if (tab === "projects") {
                const p = row as PortalProjectSummary;
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.status}</td>
                    <td>{p.endDate ?? "—"}</td>
                  </tr>
                );
              }
              if (tab === "invoices") {
                const inv = row as PortalInvoiceSummary;
                return (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber ?? inv.id.slice(0, 8)}</td>
                    <td>{inv.status}</td>
                    <td>{inv.total}</td>
                    <td>{inv.balanceDue}</td>
                    <td>{inv.dueDate ?? "—"}</td>
                  </tr>
                );
              }
              const doc = row as PortalDocumentSummary;
              return (
                <tr key={doc.id}>
                  <td>{doc.fileName}</td>
                  <td>
                    {doc.entityType} · {doc.entityId.slice(0, 8)}
                  </td>
                </tr>
              );
            })}
            {!query.data?.length ? (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  No records
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
