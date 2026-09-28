import { useMemo, useState } from "react";
import { countActiveFilters } from "@/components/ModuleListShell/moduleWorkspaceUi";

export { countActiveFilters };

export function useModuleWorkspace(defaultFilterOpen = true) {
  const [filterOpen, setFilterOpen] = useState(defaultFilterOpen);
  const [viewMode, setViewMode] = useState<"list" | "tile">("list");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filterCount = useMemo(() => countActiveFilters(search), [search]);

  return {
    filterOpen,
    setFilterOpen,
    viewMode,
    setViewMode,
    search,
    setSearch,
    showForm,
    setShowForm,
    filterCount,
  };
}
