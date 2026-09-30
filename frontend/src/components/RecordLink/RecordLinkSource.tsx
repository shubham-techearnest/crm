import { createContext, useContext, type ReactNode } from "react";

/** Label of the record currently on screen; links inside it use this for the "Back to …" hint. */
const RecordLinkSourceContext = createContext<string | undefined>(undefined);

export function RecordLinkSource({ label, children }: { label?: string; children: ReactNode }) {
  return <RecordLinkSourceContext.Provider value={label}>{children}</RecordLinkSourceContext.Provider>;
}

export function useRecordLinkSource(): string | undefined {
  return useContext(RecordLinkSourceContext);
}
