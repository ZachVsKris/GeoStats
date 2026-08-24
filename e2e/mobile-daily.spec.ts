import { expect, test, type Page, type Route } from "@playwright/test";

type Difficulty = "easy" | "normal" | "expert";

const countries = [
  { id: "USA", name: "United States", region: "North America", continent: "North America", flag: "🇺🇸" },
  { id: "BRA", name: "Brazil", region: "Latin America & Caribbean", continent: "South America", flag: "🇧🇷" },
  { id: "FRA", name: "France", region: "Europe", continent: "Europe", flag: "🇫🇷" },
  { id: "NGA", name: "Nigeria", region: "Sub-Saharan Africa", continent: "Africa", flag: "🇳🇬" },
  { id: "CHN", name: "China", region: "East Asia & Pacific", continent: "Asia", flag: "🇨🇳" },
  { id: "AUS", name: "Australia", region: "East Asia & Pacific", continent: "Oceania", flag: "🇦🇺" },
  { id: "CAN", name: "Canada", region: "North America", continent: "North America", flag: "🇨🇦" },
  { id: "ARG", name: "Argentina", region: "Latin America & Caribbean", continent: "South America", flag: "🇦🇷" },
  { id: "DEU", name: "Germany", region: "Europe", continent: "Europe", flag: "🇩🇪" },
  { id: "IND", name: "India", region: "South Asia", continent: "Asia", flag: "🇮🇳" },
];

const categoryTemplates = [
  ["population", "Largest population", "Population", "worldbank", "demographics", "population-count", "👥"],
  ["coastline", "Longest coastline", "Geography", "naturalearth", "physical-geography", "coastline", "🌊"],
  ["health", "Highest vaccination rate", "Health", "who", "health", "vaccination", "💉"],
  ["exports", "Most vehicle exports", "Trade", "comtrade", "trade", "vehicle-trade", "🚗"],
  ["wheat", "Most wheat produced", "Crops", "faostat", "agriculture", "crop-production", "🌾"],
  ["energy", "Most solar electricity", "Energy", "eia", "energy", "renewable-electricity", "☀️"],
  ["refugees", "Most refugees hosted", "Displacement", "unhcr", "demographics", "forced-displacement", "🧳"],
  ["religion", "Highest Christian share", "Religion", "pewreligion", "culture", "religious-composition", "⛪"],
] as const;

function category(index: number) {
  const [id, name, family, source, broadDomain, knowledgeCluster, icon] = categoryTemplates[index];
  const isStatic = source === "naturalearth";
  return {
    id: `fixture-${id}`,
    source,
    dataset: "GeoStats responsive fixture",
    name,
    shortName: name,
    indicator: `FIXTURE.${index + 1}`,
    icon,
    unit: index % 2 ? "percent" : "people",
    family,
    direction: "high",
    description: `Complete official-style description for ${name.toLowerCase()}.`,
    boardDescription: `Clear mobile description for ${name.toLowerCase()}.`,
    decimals: 0,
    minimumYear: 2020,
    requireCommonYear: true,
    certified: true,
    certificationGrade: "A",
    coverageFloor: 100,
    globalCoverage: 193,
    commonYear: isStatic ? 2022 : 2024,
    enabled: true,
    roundType: family,
    similarityGroup: `fixture-${id}`,
    semanticFamily: `fixture-family-${id}`,
    semanticTopic: `fixture-topic-${id}`,
    strategyFamily: `fixture-strategy-${id}`,
    measureType: index % 2 ? "share" : "total",
    normalizationType: index % 2 ? "percentage" : "absolute",
    broadDomain,
    knowledgeCluster,
    catalogTier: "daily",
    warehouseBacked: true,
    warehouseSourceIndicatorCode: `FIXTURE:${index + 1}`,
    sourceUrl: "https://example.org/data",
    sourcePageUrl: "https://example.org/data",
    playerSourceUrl: "https://example.org/data",
    playerSourceStatus: "general",
    contentReviewStatus: "approved",
    objectiveStatus: "objective",
    playerQualityStatus: "approved",
    referenceLabel: isStatic ? "Natural Earth countries v5.1.1" : undefined,
    datasetRelease: isStatic ? "Natural Earth countries v5.1.1" : "2024 fixture",
    showObservationYear: !isStatic,
  };
}

function boardSnapshot(difficulty: Difficulty) {
  const dimensions = difficulty === "easy"
    ? { countryCount: 5, categoryCount: 4 }
    : difficulty === "normal"
      ? { countryCount: 8, categoryCount: 6 }
      : { countryCount: 10, categoryCount: 8 };
  const bank = countries.slice(0, dimensions.countryCount);
  return {
    version: 1,
    bank,
    categories: Array.from({ length: dimensions.categoryCount }, (_, categoryIndex) => {
      const definition = category(categoryIndex);
      const year = definition.showObservationYear === false ? "2022" : "2024";
      const observations = bank.map((country, countryIndex) => ({
        countryId: country.id,
        countryName: country.name,
        value: countryIndex === categoryIndex ? 10_000 + categoryIndex : 5_000 - countryIndex * 100 - categoryIndex,
        year,
        globalRank: countryIndex === categoryIndex ? 1 : countryIndex + 2,
      })).sort((left, right) => right.value - left.value)
        .map((row, rankIndex) => ({ ...row, globalRank: rankIndex + 1 }));
      return {
        category: definition,
        year,
        ranked: observations,
        sourceUrl: definition.sourceUrl,
        sourcePageUrl: definition.sourcePageUrl,
        playerSourceUrl: definition.playerSourceUrl,
        playerSourceStatus: definition.playerSourceStatus,
      };
    }),
  };
}

const payload = {
  easy: { seed: "DAILY-EASY-FIXTURE", board_payload: boardSnapshot("easy") },
  normal: { seed: "DAILY-NORMAL-FIXTURE", board_payload: boardSnapshot("normal") },
  expert: { seed: "DAILY-EXPERT-FIXTURE", board_payload: boardSnapshot("expert") },
};

async function installRoutes(page: Page) {
  await page.route("**/api/daily-trio/**", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await page.route("**/api/seeded/**", async (route: Route) => {
    const requestUrl = new URL(route.request().url());
    const difficulty = requestUrl.pathname.includes("/expert")
      ? "expert"
      : requestUrl.pathname.includes("/normal")
        ? "normal"
        : "easy";
    const seed = requestUrl.searchParams.get("seed") ?? "RANDOM-FIXTURE";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ seed, board_payload: boardSnapshot(difficulty) }),
    });
  });
  await page.route("**/api/scores?**", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedIn: false, completed: false, result: null }) });
  });
}

const mobileCases = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 414, height: 896 },
];
const modes = [
  { difficulty: "easy" as const, path: "/daily", countries: 5, categories: 4 },
  { difficulty: "normal" as const, path: "/daily/adventurer", countries: 8, categories: 6 },
  { difficulty: "expert" as const, path: "/daily/expert", countries: 10, categories: 8 },
];

for (const viewport of mobileCases) {
  for (const mode of modes) {
    test(`${mode.difficulty} Daily is usable at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await installRoutes(page);
      await page.goto(mode.path);
      await expect(page.locator(".countries .country")).toHaveCount(mode.countries);
      await expect(page.locator(".slots .slot")).toHaveCount(mode.categories);
      await expect(page.locator(".mobileModeTabs")).toBeVisible();

      const layout = await page.evaluate(() => {
        const countryBank = document.querySelector<HTMLElement>(".countries")!;
        const countryRects = [...document.querySelectorAll<HTMLElement>(".countries .country")].map((item) => item.getBoundingClientRect());
        const slots = [...document.querySelectorAll<HTMLElement>(".slots .slot")];
        const slotRects = slots.map((item) => item.getBoundingClientRect());
        const descriptions = [...document.querySelectorAll<HTMLElement>(".slots .category small")];
        const descriptionsUnclipped = descriptions.every((item) => {
          const style = getComputedStyle(item);
          const clamp = style.getPropertyValue("-webkit-line-clamp");
          return (clamp === "none" || clamp === "" || clamp === "unset") && style.overflow !== "hidden";
        });
        const lock = document.querySelector<HTMLElement>(".boardPanel .lock")!;
        const lockRect = lock.getBoundingClientRect();
        const lastSlotRect = slotRects.at(-1)!;
        const bankRect = countryBank.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
          countriesInsideBank: countryRects.every((rect) => rect.left >= bankRect.left - 1 && rect.right <= bankRect.right + 1 && rect.top >= 0 && rect.bottom <= window.innerHeight + 1 && rect.width >= 36),
          allSlotsVisible: slotRects.every((rect) => rect.left >= 0 && rect.right <= window.innerWidth + 1 && rect.top >= 0 && rect.bottom <= window.innerHeight + 1),
          slotColumns: new Set(slotRects.map((rect) => Math.round(rect.left))).size,
          lockPosition: getComputedStyle(lock).position,
          lockAfterCards: lockRect.top >= lastSlotRect.bottom - 2,
          lockVisible: lockRect.bottom <= window.innerHeight + 1,
          countryRows: new Set(countryRects.map((rect) => Math.round(rect.top))).size,
          descriptionsUnclipped,
        };
      });
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
      expect(layout.countriesInsideBank).toBeTruthy();
      expect(layout.allSlotsVisible).toBeTruthy();
      expect(layout.slotColumns).toBe(2);
      expect(layout.countryRows).toBeLessThanOrEqual(2);
      expect(layout.descriptionsUnclipped).toBeTruthy();
      expect(["static", "relative"]).toContain(layout.lockPosition);
      expect(layout.lockAfterCards).toBeTruthy();
      expect(layout.lockVisible).toBeTruthy();

      for (let index = 0; index < mode.categories; index += 1) {
        await page.locator(".countries .country:not(:disabled)").first().click();
        await page.locator(".slots .slot").nth(index).click();
      }
      await expect(page.getByRole("button", { name: /lock in draft/i })).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath(`${mode.difficulty}-${viewport.width}x${viewport.height}.png`), fullPage: true });
    });
  }
}

test("13-inch desktop board remains inside the first viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installRoutes(page);
  await page.goto("/daily/expert");
  await expect(page.locator(".countries .country")).toHaveCount(10);
  await expect(page.locator("main.grid.playGrid")).toBeVisible();
  const layout = await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>("main.grid.playGrid");
    if (!board) throw new Error("Gameplay board was not rendered.");
    const boardRect = board.getBoundingClientRect();
    return {
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      boardBottom: boardRect.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(layout.boardBottom).toBeLessThanOrEqual(layout.viewportHeight + 2);
  await page.screenshot({ path: testInfo.outputPath("expert-1440x900.png"), fullPage: true });
});

test("legacy Seeded links redirect to Random and preserve the seed", async ({ page }) => {
  await page.goto("/seeded/expert?seed=OLD-SEED-42");
  await expect(page).toHaveURL(/\/random\/expert\?/);
  const redirectedUrl = new URL(page.url());
  expect(redirectedUrl.pathname).toBe("/random/expert");
  expect(redirectedUrl.searchParams.get("seed")).toBe("OLD-SEED-42");
});


test("unsigned Daily result persists after refresh on the same browser", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installRoutes(page);
  await page.goto("/daily");
  await expect(page.locator(".slots .slot")).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await page.locator(".countries .country:not(:disabled)").first().click();
    await page.locator(".slots .slot").nth(index).click();
  }
  await page.getByRole("button", { name: /lock in draft/i }).click();
  await expect(page.getByText("Saved on this browser. Sign in to add it to the leaderboard.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saved on this browser. Sign in to add it to the leaderboard.")).toBeVisible();
  await expect(page.getByText("Final score")).toBeVisible();
});


test("full Random seed and consistent info controls are visible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await installRoutes(page);
  const fullSeed = "FULL-SEED-123456789-ABCD";
  await page.goto(`/random/expert?seed=${fullSeed}`);
  const input = page.getByLabel("Random seed");
  await expect(input).toHaveValue(fullSeed);
  await expect(page.locator(".mobileCategoryInfo svg")).toHaveCount(8);
  const seedFit = await input.evaluate((element) => {
    const inputElement = element as HTMLInputElement;
    const style = getComputedStyle(inputElement);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    context.font = style.font;
    const textWidth = context.measureText(inputElement.value).width;
    const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    return {
      textWidth,
      availableWidth: inputElement.clientWidth - horizontalPadding,
      right: inputElement.getBoundingClientRect().right,
      viewportWidth: window.innerWidth,
    };
  });
  expect(seedFit.textWidth).toBeLessThanOrEqual(seedFit.availableWidth + 1);
  expect(seedFit.right).toBeLessThanOrEqual(seedFit.viewportWidth + 1);
});
