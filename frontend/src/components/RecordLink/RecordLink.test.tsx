import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContextProvider } from "@/features/auth/AuthContext";
import type { MeResponse } from "@/features/auth/authApi";
import { readRecordNavState, useUrlRecordId } from "@/hooks/useUrlRecord";
import { RecordLink } from "./RecordLink";
import { RecordLinkSource } from "./RecordLinkSource";
import { recordHref, recordModuleForEntityType } from "./recordRoutes";

const user: MeResponse = {
  userId: "1",
  organizationId: "org",
  email: "user@example.com",
  displayName: "User",
  dataScope: "ORGANIZATION",
  regionIds: [],
  departmentId: null,
  teamId: null,
  resourceId: null,
  permissions: ["DEAL_VIEW", "ACCOUNT_VIEW"],
};

function DealsPage() {
  const [id, setId] = useUrlRecordId();
  return (
    <div>
      <h1>Deals</h1>
      {id ? (
        <RecordLinkSource label="Big Deal">
          <p>Deal {id}</p>
          <RecordLink module="account" id="acc-1">
            Acme Corp
          </RecordLink>
        </RecordLinkSource>
      ) : (
        <button type="button" onClick={() => setId("deal-1")}>
          Open deal
        </button>
      )}
    </div>
  );
}

function AccountsPage() {
  const [id, setId] = useUrlRecordId();
  const from = readRecordNavState(useLocation().state)?.from;
  return (
    <div>
      <h1>Accounts</h1>
      <p>Account {id}</p>
      <button type="button" onClick={() => setId(null)}>
        Back to {from?.label}
      </button>
    </div>
  );
}

function renderApp(initialEntry = "/deals") {
  return render(
    <AuthContextProvider user={user}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContextProvider>,
  );
}

describe("recordRoutes", () => {
  it("maps backend entity types to modules", () => {
    expect(recordModuleForEntityType("PURCHASE_ORDER")).toBe("purchaseOrder");
    expect(recordModuleForEntityType("project_task")).toBe("task");
    expect(recordModuleForEntityType("UNKNOWN")).toBeNull();
    expect(recordModuleForEntityType(null)).toBeNull();
  });

  it("builds deep links with the record id", () => {
    expect(recordHref("deal", "a b")).toBe("/deals?id=a%20b");
  });
});

describe("RecordLink", () => {
  it("renders plain text when the user cannot view the target module", () => {
    render(
      <AuthContextProvider user={user}>
        <MemoryRouter>
          <RecordLink module="invoice" id="inv-1">
            INV-001
          </RecordLink>
        </MemoryRouter>
      </AuthContextProvider>,
    );
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the fallback when there is no id", () => {
    render(
      <AuthContextProvider user={user}>
        <MemoryRouter>
          <RecordLink module="account" id={null} />
        </MemoryRouter>
      </AuthContextProvider>,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("opens the linked record and returns to the source record", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Open deal" }));
    expect(screen.getByText("Deal deal-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Acme Corp" }));
    expect(screen.getByText("Account acc-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Big Deal" }));
    expect(screen.getByText("Deal deal-1")).toBeInTheDocument();
  });

  it("closes a deep-linked record without leaving the module", () => {
    renderApp("/accounts?id=acc-1");
    fireEvent.click(screen.getByRole("button", { name: /Back to/ }));
    expect(screen.getByRole("heading", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
});
