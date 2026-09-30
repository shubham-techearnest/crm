import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ModuleListShell } from "./ModuleListShell";

function renderShell(props: { activeFilterCount: number; onClearFilters?: () => void; onCloseFilters?: () => void }) {
  render(
    <MemoryRouter>
      <ModuleListShell
        title="Leads"
        filterOpen
        showSortButton={false}
        filterPanel={
          <>
            <div className="module-filter-section">
              <h3>Search</h3>
              <input aria-label="Search leads" />
            </div>
            <div className="module-filter-section is-collapsed">
              <h3>Save view</h3>
              <input aria-label="View name" />
            </div>
          </>
        }
        {...props}
      >
        <div>rows</div>
      </ModuleListShell>
    </MemoryRouter>,
  );
}

describe("ModuleListShell filter panel", () => {
  it("shows the active count with Clear all and Close actions", () => {
    const onClearFilters = vi.fn();
    const onCloseFilters = vi.fn();
    renderShell({ activeFilterCount: 2, onClearFilters, onCloseFilters });

    expect(screen.getByText("Filter Leads by")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    fireEvent.click(screen.getByRole("button", { name: "Close filters" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onCloseFilters).toHaveBeenCalledTimes(1);
  });

  it("hides Clear all when no filters are active", () => {
    renderShell({ activeFilterCount: 0, onClearFilters: vi.fn() });
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("toggles sections from their heading", () => {
    renderShell({ activeFilterCount: 0 });
    const search = screen.getByRole("button", { name: "Search" });
    const saveView = screen.getByRole("button", { name: "Save view" });
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(saveView).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(search);
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(search.parentElement).toHaveClass("is-collapsed");

    fireEvent.keyDown(saveView, { key: "Enter" });
    expect(saveView).toHaveAttribute("aria-expanded", "true");
    expect(saveView.parentElement).not.toHaveClass("is-collapsed");
  });
});
