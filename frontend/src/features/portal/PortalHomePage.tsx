import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { listPortalDocuments, listPortalInvoices, listPortalProjects } from "./portalApi";

export function PortalHomePage() {
  const projectsQuery = useQuery({ queryKey: ["portal", "projects"], queryFn: listPortalProjects });
  const invoicesQuery = useQuery({ queryKey: ["portal", "invoices"], queryFn: listPortalInvoices });
  const documentsQuery = useQuery({ queryKey: ["portal", "documents"], queryFn: listPortalDocuments });

  if (projectsQuery.isLoading || invoicesQuery.isLoading || documentsQuery.isLoading) {
    return <LoadingState label="Loading your account…" />;
  }

  return (
    <div>
      <h1 className="h3 mb-4">Welcome</h1>
      <div className="row g-3">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h5">Projects</h2>
              <p className="display-6 mb-2">{projectsQuery.data?.length ?? 0}</p>
              <Link to="/portal/projects">View projects</Link>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h5">Invoices</h2>
              <p className="display-6 mb-2">{invoicesQuery.data?.length ?? 0}</p>
              <Link to="/portal/invoices">View invoices</Link>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h5">Documents</h2>
              <p className="display-6 mb-2">{documentsQuery.data?.length ?? 0}</p>
              <Link to="/portal/documents">View documents</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
