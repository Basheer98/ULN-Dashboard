import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("admin can sign in and reach dashboard", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Urbanlink Networks" })).toBeVisible();

    await page.locator("#email").fill("admin@urbanlinknetworks.com");
    await page.locator("#password").fill("Admin@123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("admin@urbanlinknetworks.com");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator(".text-danger")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
