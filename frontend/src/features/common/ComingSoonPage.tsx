import { Link } from "react-router-dom";

export function ComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="coming-soon-card">
      <h1>{title}</h1>
      <p className="text-muted mb-4">{description}</p>
      <p className="small text-muted mb-3">
        Planned in V2 after CRM Foundation. Layout and permissions will match Leads, Accounts, and Deals.
      </p>
      <Link to="/leads" className="btn btn-primary btn-sm">
        Back to Leads
      </Link>
    </div>
  );
}
