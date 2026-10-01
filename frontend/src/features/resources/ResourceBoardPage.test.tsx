import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContextProvider } from "@/features/auth/AuthContext";
import type { MeResponse } from "@/features/auth/authApi";
import type { BoardResource, GroupMetrics, ResourceBoard } from "./resourceBoardApi";
import { ResourceBoardPage } from "./ResourceBoardPage";

const getResourceBoard = vi.fn();

vi.mock("./resourceBoardApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resourceBoardApi")>()),
  getResourceBoard: (...args: unknown[]) => getResourceBoard(...args),
  getResourceWorkload: vi.fn(),
  updateBoardSettings: vi.fn(),
}));

function me(permissions: string[]): MeResponse {
  return {
    userId: "1",
    organizationId: "org",
    email: "rm@example.com",
    displayName: "Resource Manager",
    dataScope: "ORGANIZATION",
    regionIds: [],
    departmentId: null,
    teamId: null,
    resourceId: null,
    permissions,
  };
}

const totals: GroupMetrics = {
  key: "ORGANIZATION",
  label: "Organization",
  resources: 2,
  capacityHours: 320,
  allocatedHours: 176,
  availableHours: 144,
  utilizationPct: 55,
  actualHours: 40,
  billableHours: 32,
  nonBillableHours: 8,
  billableUtilizationPct: 10,
};

function person(overrides: Partial<BoardResource>): BoardResource {
  return {
    id: "r1",
    name: "Aarav Mehta",
    code: "EMP-1001",
    resourceType: "EMPLOYEE",
    category: "INTERNAL",
    designation: "Developer",
    departmentId: null,
    departmentName: null,
    managerName: null,
    regionId: "pune",
    location: null,
    status: "BENCH",
    storedStatus: "AVAILABLE",
    band: "BENCH",
    currentAllocationPct: 0,
    futureAllocationPct: 0,
    available: true,
    availableFrom: "2026-09-30",
    availableCapacityPct: 100,
    endingSoon: false,
    currentAllocationEndsOn: null,
    nextAllocationStartsOn: null,
    engagementStartDate: null,
    engagementEndDate: null,
    engagementEndingSoon: false,
    onLeave: false,
    experienceYears: 4,
    billable: true,
    activeProjectCount: 0,
    capacityHours: 160,
    allocatedHours: 0,
    availableHours: 160,
    utilizationPct: 0,
    actualHours: 0,
    billableHours: 0,
    pendingHours: 0,
    skills: [],
    allocations: [],
    weeklyLoad: [0, 0],
    ...overrides,
  };
}

function board(overrides: Partial<ResourceBoard> = {}): ResourceBoard {
  return {
    asOf: "2026-09-30",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    financialsVisible: false,
    settings: { endingSoonDays: 14, benchMaxAllocationPct: 0, fullAllocationPct: 100, overallocationPct: 100, forecastWeeks: 2 },
    weeks: ["2026-09-28", "2026-10-05"],
    summary: {
      totalResources: 2,
      employees: 2,
      externals: 0,
      available: 1,
      bench: 1,
      partiallyAllocated: 0,
      fullyAllocated: 0,
      overallocated: 1,
      endingSoon: 0,
      onLeave: 0,
      inactive: 0,
      byType: { EMPLOYEE: 2 },
      byStatus: { BENCH: 1, OVERALLOCATED: 1 },
      totals,
    },
    resources: [
      person({}),
      person({ id: "r2", name: "Neha Kulkarni", code: "EMP-1002", status: "OVERALLOCATED", band: "OVERALLOCATED", currentAllocationPct: 120, available: false, weeklyLoad: [120, 60] }),
    ],
    projects: [],
    skills: [],
    byDepartment: [],
    byType: [],
    ...overrides,
  };
}

function renderPage(permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthContextProvider user={me(permissions)}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ResourceBoardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContextProvider>,
  );
}

describe("ResourceBoardPage", () => {
  beforeEach(() => getResourceBoard.mockReset());

  it("shows people with their derived status and hides money without rate access", async () => {
    getResourceBoard.mockResolvedValue(board());
    renderPage(["RESOURCE_BOARD_VIEW"]);

    expect(await screen.findByText("Aarav Mehta")).toBeInTheDocument();
    expect(screen.getByText("Neha Kulkarni")).toBeInTheDocument();
    expect(screen.getAllByText("Over-allocated").length).toBeGreaterThan(0);
    expect(screen.getByText("120%")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Cost" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("filters by status when a summary tile is clicked", async () => {
    getResourceBoard.mockResolvedValue(board());
    renderPage(["RESOURCE_BOARD_VIEW"]);
    await screen.findByText("Aarav Mehta");

    fireEvent.click(screen.getByRole("button", { name: /^Bench/ }));

    await vi.waitFor(() =>
      expect(getResourceBoard).toHaveBeenLastCalledWith(expect.objectContaining({ status: ["BENCH"] })),
    );
  });

  it("shows financial columns and settings for users who may see them", async () => {
    getResourceBoard.mockResolvedValue(board({ financialsVisible: true }));
    renderPage(["RESOURCE_BOARD_VIEW", "RESOURCE_BOARD_CONFIGURE"]);

    expect(await screen.findByRole("columnheader", { name: "Cost" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
  });
});
