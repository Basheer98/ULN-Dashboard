import { test, expect, type Page } from "@playwright/test";

function uniqueProjectNumber() {
  return `PRJ E2E-${Date.now()}`;
}

async function selectByLabel(page: Page, labelText: string, optionLabel: string) {
  const select = page.locator(`label:has-text("${labelText}")`).locator("..").locator("select");
  await expect(select.locator("option", { hasText: optionLabel })).toHaveCount(1, { timeout: 15_000 });
  await select.selectOption({ label: optionLabel });
}

async function fillCustomTitle(page: Page, title: string) {
  const select = page.locator('label:has-text("Project Title")').locator("..").locator("select");
  await select.selectOption({ value: "__custom__" });
  await page.locator('input[name="title"]').fill(title);
}

test.describe("Project create", () => {
  test.afterEach(async ({ page }) => {
    const id = new URL(page.url()).pathname.match(/^\/projects\/([a-z0-9-]+)$/i)?.[1];
    if (id && id !== "new") await page.request.delete(`/api/v1/projects/${id}`);
  });

  test("creates a project without fielder assignment", async ({ page }) => {
    const projectNumber = uniqueProjectNumber();
    const title = "E2E Test Project";

    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "New Project" })).toBeVisible();

    await page.locator('input[name="projectNumber"]').fill(projectNumber);
    await selectByLabel(page, "Client", "Amdocs");
    await fillCustomTitle(page, title);
    await page.locator('input[name="siteAddress"]').fill("123 Test St");
    await page.locator('input[name="city"]').fill("Denver");
    await selectByLabel(page, "State", "Colorado");
    await page.locator('input[name="sqft"]').fill("5000");

    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+$/i, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: projectNumber })).toBeVisible();
    await expect(page.getByText(title).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Amdocs").filter({ visible: true }).first()).toBeVisible();
  });

  test("creates a project and assigns a fielder", async ({ page }) => {
    const projectNumber = uniqueProjectNumber();
    const title = "E2E Assigned Project";

    await page.goto("/projects/new");

    await page.locator('input[name="projectNumber"]').fill(projectNumber);
    await selectByLabel(page, "Client", "Amdocs");
    await fillCustomTitle(page, title);
    await page.locator('input[name="siteAddress"]').fill("456 Assign Ave");
    await page.locator('input[name="city"]').fill("Denver");
    await selectByLabel(page, "State", "Colorado");
    await page.locator('input[name="sqft"]').fill("8000");

    await selectByLabel(page, "Fielder", "Mike Johnson");

    await expect(page.getByRole("button", { name: "Create & Assign Fielder" })).toBeEnabled();
    await page.getByRole("button", { name: "Create & Assign Fielder" }).click();

    await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+$/i, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: projectNumber })).toBeVisible();
    await expect(page.locator("p.font-medium", { hasText: "Mike Johnson" })).toBeVisible();
  });
});
