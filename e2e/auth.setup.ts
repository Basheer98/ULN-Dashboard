import { test as setup, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@urbanlinknetworks.com";
const ADMIN_PASSWORD = "Admin@123";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
