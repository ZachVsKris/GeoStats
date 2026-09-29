import { expect, test } from "@playwright/test";

test.skip(process.env.ANIMALSTATS_PREVIEW_ENABLED !== "true", "Private pilot is disabled without its preview flag");

test("pilot boards render and can be completed in all modes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/animals");
  await expect(page.getByRole("heading", { name: "AnimalStats" })).toBeVisible();
  const dailyTypes: string[] = [];
  for (const [label, animals, traits] of [["Scout", 4, 4], ["Adventurer", 6, 4], ["Expert", 8, 6]] as const) {
    await page.getByRole("button", { name: new RegExp(`^${label}\\b`) }).click();
    await expect(page.locator(".animalBoardTop .animalEyebrow")).toContainText("OF 10");
    dailyTypes.push((await page.locator(".animalBoardTop .animalEyebrow").innerText()).split(" · ").pop()!);
    await expect(page.locator(".animalCard")).toHaveCount(animals);
    await expect(page.locator(".animalTrait")).toHaveCount(traits);
    for (let index = 0; index < traits; index++) {
      await page.locator(".animalTrait").nth(index).click();
      await page.locator(".animalCard").nth(index).click();
    }
    await page.getByRole("button", { name: "Reveal results" }).click();
    await expect(page.locator(".animalResult")).toHaveCount(traits);
    await expect(page.getByText("OPTIMAL CHOICES")).toBeVisible();
  }
  expect(new Set(dailyTypes).size).toBeGreaterThanOrEqual(2);
  await page.getByLabel("Review label").selectOption("PASS");
  await page.getByLabel("What worked or felt wrong?").fill("The allocation choices were interesting.");
  await page.getByRole("button", { name: "Save playtest note" }).click();
  await expect(page.getByText("Saved on this browser")).toBeVisible();
  const reviews = await page.evaluate(() => localStorage.getItem("animalstats:pilot-reviews"));
  expect(reviews).toContain("The allocation choices were interesting.");
  expect(errors).toEqual([]);
});

test("phone layout fits and exposes sources after scoring", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/animals");
  await expect(page.locator(".animalCard")).toHaveCount(4);
  for (let index = 0; index < 4; index++) {
    await page.locator(".animalTrait").nth(index).click();
    await page.locator(".animalCard").nth(index).click();
  }
  await page.getByRole("button", { name: "Reveal results" }).click();
  await expect(page.getByText("OPTIMAL SCORE")).toBeVisible();
  await page.getByText("Definition and source").first().click();
  await expect(page.getByRole("link", { name: "View dataset" }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("either-order placement, swapping, dragging and photo reveal", async ({ page }) => {
  await page.goto("/animals");
  const cards = page.locator(".animalCard");
  const traits = page.locator(".animalTrait");
  await expect(cards.locator("img")).toHaveCount(0);
  const first = await cards.nth(0).locator("span").innerText();
  const second = await cards.nth(1).locator("span").innerText();
  await cards.nth(0).click(); await traits.nth(0).click();
  await traits.nth(1).click(); await cards.nth(1).click();
  await cards.nth(0).click(); await traits.nth(1).click();
  await expect(traits.nth(0).locator(".animalTraitChoice")).toHaveText(second);
  await expect(traits.nth(1).locator(".animalTraitChoice")).toHaveText(first);
  const from = (await cards.nth(2).boundingBox())!;
  const to = (await traits.nth(2).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(traits.nth(2).locator(".animalTraitChoice")).toHaveText(await cards.nth(2).locator("span").innerText());
  await page.getByLabel("Show photos during play").check();
  await expect(cards.locator("img")).toHaveCount(4);
  await page.getByRole("button", { name: "Reset choices" }).click();
  await expect(page.locator(".animalProgress")).toHaveText("0 / 4 placed");
});
