import { Link } from "react-router-dom";

/** Placeholder for Platform Console modules scheduled in later sprints. */
export function PlatformPlaceholderPage({
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
      <Link to="/platform" className="btn btn-primary btn-sm">
        Back to Platform Dashboard
      </Link>
    </div>
  );
}
