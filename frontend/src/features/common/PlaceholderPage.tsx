import { EmptyState } from "@/components/EmptyState/EmptyState";

interface PlaceholderPageProps {
  title: string;
  phase: string;
}

export function PlaceholderPage({ title, phase }: PlaceholderPageProps) {
  return (
    <section className="page-card">
      <h1 className="h4 mb-3">{title}</h1>
      <EmptyState
        title={`${title} is not implemented yet`}
        description={`This module is scheduled for ${phase}. The navigation is in place so the shell can be reviewed now.`}
      />
    </section>
  );
}
