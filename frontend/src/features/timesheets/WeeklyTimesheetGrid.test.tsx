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
    expect(screen.getAllByText("9")).toHaveLength(2);
  });

  it("saves one entry per non-empty cell and blocks days over 24 hours", () => {
    const onSave = renderGrid([entry("2026-09-28", 8)]);
    const save = screen.getByRole("button", { name: "Save Week" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Horizon 2026-09-30"), { target: { value: "25" } });
    expect(save).toBeDisabled();
    expect(screen.getByText("A day cannot have more than 24 hours.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Horizon 2026-09-30"), { target: { value: "6.5" } });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ projectId: "p-1", workDate: "2026-09-28", hours: 8, billable: true }),
      expect.objectContaining({ projectId: "p-1", workDate: "2026-09-30", hours: 6.5, billable: true }),
    ]);
  });

  it("edits each day's note in a popup and saves it with that day's hours", () => {
    const onSave = renderGrid([
      entry("2026-09-28", 8, { description: "Sprint planning" }),
      entry("2026-09-29", 5, { description: "API work" }),
    ]);
    fireEvent.change(screen.getByLabelText("Horizon 2026-09-30"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Notes (2)" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Horizon note 2026-09-28")).toHaveValue("Sprint planning");
    expect(screen.getByLabelText("Horizon note 2026-09-29")).toHaveValue("API work");
    expect(screen.queryByLabelText("Horizon note 2026-10-01")).not.toBeInTheDocument();
    expect(screen.getByText("2 of 3 days described")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Horizon note 2026-09-30"), { target: { value: "Code review" } });
    expect(screen.getByText("3 of 3 days described")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Notes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Week" }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ workDate: "2026-09-28", hours: 8, description: "Sprint planning" }),
      expect.objectContaining({ workDate: "2026-09-29", hours: 5, description: "API work" }),
      expect.objectContaining({ workDate: "2026-09-30", hours: 3, description: "Code review" }),
    ]);
  });

  it("lists allocated projects as ready-to-fill rows and offers copying last week on an empty week", () => {
    const onSave = renderGrid([]);
    expect(screen.getByRole("button", { name: "Copy last week" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Horizon 2026-09-28"), { target: { value: "6" } });
    expect(screen.queryByRole("button", { name: "Copy last week" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Week" }));
    expect(onSave).toHaveBeenCalledWith([expect.objectContaining({ projectId: "p-1", workDate: "2026-09-28", hours: 6 })]);
  });

  it("copies one day's note to every logged day from the notes popup", () => {
    const onSave = renderGrid([entry("2026-09-28", 8, { description: null }), entry("2026-09-29", 4, { description: null })]);
    fireEvent.click(screen.getByRole("button", { name: "+ Add notes" }));
    fireEvent.change(screen.getByLabelText("Horizon note 2026-09-28"), { target: { value: "Checkout API" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this note for all 2 days" }));
    expect(screen.getByLabelText("Horizon note 2026-09-29")).toHaveValue("Checkout API");
    fireEvent.click(screen.getByRole("button", { name: "Save Notes" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Week" }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ workDate: "2026-09-28", description: "Checkout API" }),
      expect.objectContaining({ workDate: "2026-09-29", description: "Checkout API" }),
    ]);
  });

  it("removes projects not worked on and adds projects or tasks back", () => {
    const onEntriesChange = vi.fn();
    render(
      <WeeklyTimesheetGrid
        weekStart="2026-09-28"
        entries={[]}
        projectChoices={[
          { projectId: "p-1", name: "Horizon", projectCode: null, tasks: [{ taskId: "t-1", name: "Design", status: null }] },
          { projectId: "p-2", name: "Apollo", projectCode: null, tasks: [] },
        ]}
        fallbackProjects={[]}
        projectLabel={(id) => (id === "p-2" ? "Apollo" : "Horizon")}
        taskLabel={(id) => (id === "t-1" ? "Design" : null)}
        editable
        saving={false}
        copying={false}
        onSave={vi.fn()}
        onCopyLastWeek={vi.fn()}
        onEntriesChange={onEntriesChange}
        showSaveControls={false}
      />,
    );
    expect(screen.getByLabelText("Apollo 2026-09-28")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Apollo" }));
    expect(screen.queryByLabelText("Apollo 2026-09-28")).not.toBeInTheDocument();

    const picker = screen.getByLabelText("Add project or task");
    fireEvent.change(picker, { target: { value: "p-1|t-1" } });
    expect(screen.getByRole("button", { name: "Remove Horizon › Design" })).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: "p-2|" } });
    expect(screen.getByLabelText("Apollo 2026-09-28")).toBeInTheDocument();
  });

  it("reports entries to the create form and hides its own save buttons", () => {
    const onEntriesChange = vi.fn();
    render(
      <WeeklyTimesheetGrid
        weekStart="2026-09-28"
        entries={[]}
        projectChoices={[{ projectId: "p-1", name: "Horizon", projectCode: null, tasks: [] }]}
        fallbackProjects={[]}
        projectLabel={() => "Horizon"}
        taskLabel={() => null}
        editable
        saving={false}
        copying={false}
        onSave={vi.fn()}
        onCopyLastWeek={vi.fn()}
        onEntriesChange={onEntriesChange}
        showSaveControls={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Save Week" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Horizon 2026-09-28"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Horizon 2026-09-29"), { target: { value: "4.5" } });
    expect(onEntriesChange).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({ workDate: "2026-09-28", hours: 7 }),
        expect.objectContaining({ workDate: "2026-09-29", hours: 4.5 }),
      ],
      true,
    );
  });

  it("explains that future hours can only be saved as a draft", () => {
    render(
      <WeeklyTimesheetGrid
        weekStart="2099-01-05"
        entries={[entry("2099-01-05", 8)]}
        projectChoices={[{ projectId: "p-1", name: "Horizon", projectCode: null, tasks: [] }]}
        fallbackProjects={[]}
        projectLabel={() => "Horizon"}
        taskLabel={() => null}
        editable
        saving={false}
        copying={false}
        onSave={vi.fn()}
        onCopyLastWeek={vi.fn()}
      />,
    );
    expect(screen.getByText(/can only be saved as a draft/)).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Horizon 2026-09-29"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Week" }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ projectId: "p-1", workDate: "2026-09-28", hours: 4 }),
      expect.objectContaining({ projectId: "p-1", workDate: "2026-09-29", hours: 2 }),
    ]);
  });
});
