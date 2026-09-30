import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimeEntry } from "./timesheetApi";
import { WeeklyTimesheetGrid } from "./WeeklyTimesheetGrid";

function entry(workDate: string, hours: number, overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: `${workDate}-${hours}-${Math.random()}`,
    timesheetId: "ts-1",
    projectId: "p-1",
    taskId: null,
    workDate,
    hours,
    description: "Build",
    billable: true,
    billingRate: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function renderGrid(entries: TimeEntry[], onSave = vi.fn()) {
  render(
    <WeeklyTimesheetGrid
      weekStart="2026-09-28"
      entries={entries}
      projectChoices={[{ projectId: "p-1", name: "Horizon", projectCode: null, tasks: [] }]}
      fallbackProjects={[]}
      projectLabel={() => "Horizon"}
      taskLabel={() => null}
      editable
      saving={false}
      copying={false}
      onSave={onSave}
      onCopyLastWeek={vi.fn()}
    />,
  );
  return onSave;
}

describe("WeeklyTimesheetGrid", () => {
  it("merges entries into one row per project and sums same-day hours", () => {
    renderGrid([entry("2026-09-28", 3), entry("2026-09-28", 2), entry("2026-09-29", 4)]);
    expect(screen.getByLabelText("Horizon 2026-09-28")).toHaveValue(5);
    expect(screen.getByLabelText("Horizon 2026-09-29")).toHaveValue(4);
    expect(screen.getByText("Total 9 h · Billable 9 h")).toBeInTheDocument();
  });

  it("saves one entry per non-empty cell and blocks days over 24 hours", () => {
    const onSave = renderGrid([entry("2026-09-28", 8)]);
    const save = screen.getByRole("button", { name: "Save Week" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Horizon 2026-09-30"), { target: { value: "25" } });
    expect(save).toBeDisabled();
    expect(screen.getByText("A day cannot have more than 24 hours logged.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Horizon 2026-09-30"), { target: { value: "6.5" } });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ projectId: "p-1", workDate: "2026-09-28", hours: 8, billable: true }),
      expect.objectContaining({ projectId: "p-1", workDate: "2026-09-30", hours: 6.5, billable: true }),
    ]);
  });

  it("locks rows on ended projects, disables them in the picker and leaves them out of the save", () => {
    const onSave = vi.fn();
    render(
      <WeeklyTimesheetGrid
        weekStart="2026-09-28"
        entries={[entry("2026-09-28", 4), entry("2026-09-28", 3, { projectId: "p-2" })]}
        projectChoices={[
          { projectId: "p-1", name: "Horizon", projectCode: null, tasks: [] },
          { projectId: "p-2", name: "Legacy", projectCode: null, status: "COMPLETED", closed: true, tasks: [] },
        ]}
        fallbackProjects={[]}
        projectLabel={(id) => (id === "p-2" ? "Legacy" : "Horizon")}
        taskLabel={() => null}
        editable
        saving={false}
        copying={false}
        onSave={onSave}
        onCopyLastWeek={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Legacy 2026-09-28")).not.toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Legacy — Completed" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Horizon 2026-09-29"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Week" }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ projectId: "p-1", workDate: "2026-09-28", hours: 4 }),
      expect.objectContaining({ projectId: "p-1", workDate: "2026-09-29", hours: 2 }),
    ]);
  });
});
