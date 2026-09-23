import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthContextProvider } from "@/features/auth/AuthContext";
import type { MeResponse } from "@/features/auth/authApi";
import { PermissionGuard } from "./PermissionGuard";

const viewer: MeResponse = {
  userId: "1",
  organizationId: "org",
  email: "viewer@example.com",
  displayName: "Viewer",
  dataScope: "ORGANIZATION",
  regionIds: [],
  departmentId: null,
  teamId: null,
  resourceId: null,
  permissions: ["LEAD_VIEW"],
};

describe("PermissionGuard", () => {
  it("hides children without the required permission", () => {
    render(
      <AuthContextProvider user={viewer}>
        <PermissionGuard permission="USER_VIEW">
          <button type="button">Users</button>
        </PermissionGuard>
      </AuthContextProvider>,
    );
    expect(screen.queryByRole("button", { name: "Users" })).not.toBeInTheDocument();
  });

  it("shows children when any listed permission matches", () => {
    render(
      <AuthContextProvider user={viewer}>
        <PermissionGuard anyOf={["USER_VIEW", "LEAD_VIEW"]}>
          <button type="button">Leads</button>
        </PermissionGuard>
      </AuthContextProvider>,
    );
    expect(screen.getByRole("button", { name: "Leads" })).toBeInTheDocument();
  });
});
