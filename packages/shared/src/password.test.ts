import { describe, expect, it } from "vitest";
import { loginSchema, passwordSchema } from "./index";

describe("passwordSchema", () => {
  it("accepts a long password with letters and numbers", () => {
    expect(passwordSchema.safeParse("Fieldwork2026").success).toBe(true);
  });

  it.each([
    ["too short", "abc12345"],
    ["no number", "abcdefghijkl"],
    ["no letter", "12345678901"],
    ["common", "Password123"],
    ["too long", `a1${"x".repeat(71)}`],
  ])("rejects %s passwords", (_label, value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });

  it("does not apply the policy at login, so older passwords keep working", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "abc123" }).success).toBe(true);
  });
});
