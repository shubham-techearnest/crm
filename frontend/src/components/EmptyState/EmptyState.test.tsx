import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No leads" description="Create a lead to get started." />);
    expect(screen.getByText("No leads")).toBeInTheDocument();
    expect(screen.getByText("Create a lead to get started.")).toBeInTheDocument();
  });
});
