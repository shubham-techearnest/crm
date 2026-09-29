import { describe, expect, it } from "vitest";
import { newRequestId } from "./client";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newRequestId", () => {
  it("returns a v4 UUID", () => {
    expect(newRequestId()).toMatch(UUID_V4);
  });

  it("falls back when randomUUID is unavailable (insecure context)", () => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const id = newRequestId();
      expect(id).toMatch(UUID_V4);
      expect(newRequestId()).not.toBe(id);
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });
});
