import { useMemo, useState } from "react";

export function useModuleWorkspace(defaultFilterOpen = true) {
  const [filterOpen, setFilterOpen] = useState(defaultFilterOpen);
  const [viewMode, setViewMode] = useState<"list" | "tile">("list");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filterCount = useMemo(() => (search.trim() ? 1 : 0), [search]);

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
