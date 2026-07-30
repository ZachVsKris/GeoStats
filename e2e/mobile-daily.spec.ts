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
        const lock = document.querySelector<HTMLElement>(".boardPanel .lock")!;
        const lockRect = lock.getBoundingClientRect();
        const lastSlotRect = slotRects.at(-1)!;
        const bankRect = countryBank.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          countriesInsideBank: countryRects.every((rect) => rect.left >= bankRect.left - 1 && rect.right <= bankRect.right + 1 && rect.width >= 36),
          slotLeftSpread: Math.max(...slotRects.map((rect) => rect.left)) - Math.min(...slotRects.map((rect) => rect.left)),
          lockPosition: getComputedStyle(lock).position,
          lockAfterCards: lockRect.top >= lastSlotRect.bottom - 2,
          countryRows: new Set(countryRects.map((rect) => Math.round(rect.top))).size,
        };
      });
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.countriesInsideBank).toBeTruthy();
      expect(layout.slotLeftSpread).toBeLessThanOrEqual(2);
      expect(["static", "relative"]).toContain(layout.lockPosition);
      expect(layout.lockAfterCards).toBeTruthy();
      if (mode.countries > 6) expect(layout.countryRows).toBeGreaterThan(1);

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
  const layout = await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>("main.board")!.getBoundingClientRect();
    return {
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      boardBottom: board.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(layout.boardBottom).toBeLessThanOrEqual(layout.viewportHeight + 2);
  await page.screenshot({ path: testInfo.outputPath("expert-1440x900.png"), fullPage: true });
});

test("legacy Seeded links redirect to Random and preserve the seed", async ({ page }) => {
  await page.goto("/seeded/expert?seed=OLD-SEED-42");
  await expect(page).toHaveURL(/\/random\/expert\?seed=OLD-SEED-42$/);
});
