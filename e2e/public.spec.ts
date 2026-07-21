import { expect, test } from "@playwright/test";

test("public reference shell is readable without a database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CASC" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toContainText("Browse");
  await expect(page.getByRole("search")).toBeVisible();
});

test("browse remains public and public submissions are unavailable", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
  await page.goto("/contribute");
  await expect(page.getByRole("heading", { name: "This record does not exist." })).toBeVisible();
});
