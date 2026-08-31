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
    ? { countryCount: 4, categoryCount: 4 }
    : difficulty === "normal"
      ? { countryCount: 6, categoryCount: 4 }
      : { countryCount: 8, categoryCount: 6 };
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

function legacyBoardSnapshot(difficulty: Difficulty) {
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
        countryId: country.id, countryName: country.name,
        value: countryIndex === categoryIndex ? 10_000 + categoryIndex : 5_000 - countryIndex * 100 - categoryIndex,
        year, globalRank: countryIndex === categoryIndex ? 1 : countryIndex + 2,
      })).sort((left, right) => right.value - left.value)
        .map((row, rankIndex) => ({ ...row, globalRank: rankIndex + 1 }));
      return { category: definition, year, ranked: observations, sourceUrl: definition.sourceUrl, sourcePageUrl: definition.sourcePageUrl, playerSourceUrl: definition.playerSourceUrl, playerSourceStatus: definition.playerSourceStatus };
    }),
  };
}

const legacyPayload = {
  easy: { seed: "DAILY-EASY-LEGACY", board_payload: legacyBoardSnapshot("easy") },
  normal: { seed: "DAILY-NORMAL-LEGACY", board_payload: legacyBoardSnapshot("normal") },
  expert: { seed: "DAILY-EXPERT-LEGACY", board_payload: legacyBoardSnapshot("expert") },
};

async function installLegacyDailyRoutes(page: Page) {
  await page.route("**/api/daily-trio/**", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(legacyPayload) });
  });
  await page.route("**/api/scores?**", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedIn: false, completed: false, result: null }) });
  });
}

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
  { width: 375, height: 667, orientation: "portrait" as const },
  { width: 390, height: 844, orientation: "portrait" as const },
  { width: 393, height: 852, orientation: "portrait" as const },
  { width: 414, height: 896, orientation: "portrait" as const },
  { width: 667, height: 375, orientation: "landscape" as const },
  { width: 844, height: 390, orientation: "landscape" as const },
];
const modes = [
  { difficulty: "easy" as const, path: "/daily", countries: 4, categories: 4, minBankHeight: 72, minCountryCardHeight: 66 },
  { difficulty: "normal" as const, path: "/daily/adventurer", countries: 6, categories: 4, minBankHeight: 90, minCountryCardHeight: 40 },
  { difficulty: "expert" as const, path: "/daily/expert", countries: 8, categories: 6, minBankHeight: 98, minCountryCardHeight: 44 },
];

for (const viewport of mobileCases) {
  for (const mode of modes) {
    test(`${mode.difficulty} Daily is usable at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
      const browserErrors: string[] = [];
      page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      await page.setViewportSize(viewport);
      await installRoutes(page);
      await page.goto(mode.path);
      await expect(page.locator(".countries .country")).toHaveCount(mode.countries);
      await expect(page.locator(".slots .slot")).toHaveCount(mode.categories);
      await expect(page.locator(".mobileModeTabs")).toBeVisible();
      await expect(page.locator(".slots .measurementBadge")).toHaveCount(mode.categories);

      const layout = await page.evaluate(() => {
        const countryBank = document.querySelector<HTMLElement>(".countries")!;
        const countryRects = [...document.querySelectorAll<HTMLElement>(".countries .country")].map((item) => item.getBoundingClientRect());
        const slots = [...document.querySelectorAll<HTMLElement>(".slots .slot")];
        const slotRects = slots.map((item) => item.getBoundingClientRect());
        const choiceRects = slots.map((item) => item.querySelector<HTMLElement>(".choice")!.getBoundingClientRect());
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
          slotEdgeColors: new Set(slots.map((item) => getComputedStyle(item).borderLeftColor)).size,
          lockPosition: getComputedStyle(lock).position,
          lockAfterCards: lockRect.top >= lastSlotRect.bottom - 2,
          lockVisible: lockRect.bottom <= window.innerHeight + 1,
          countryRows: new Set(countryRects.map((rect) => Math.round(rect.top))).size,
          countryBankHeight: bankRect.height,
          minCountryCardHeight: Math.min(...countryRects.map((rect) => rect.height)),
          choiceRowsAligned: [...new Set(slotRects.map((rect) => Math.round(rect.top)))].every((rowTop) => {
            const tops = choiceRects.filter((_, index) => Math.round(slotRects[index].top) === rowTop).map((rect) => rect.top);
            return tops.length < 2 || Math.max(...tops) - Math.min(...tops) <= 1;
          }),
          descriptionsUnclipped,
          shellHeight: document.querySelector<HTMLElement>(".shell.activePlay")!.getBoundingClientRect().height,
          visualViewportHeight: window.visualViewport?.height ?? window.innerHeight,
          frameworkOverlay: Boolean(document.querySelector("[data-nextjs-dialog], #webpack-dev-server-client-overlay")),
        };
      });
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
      expect(layout.countriesInsideBank).toBeTruthy();
      expect(layout.allSlotsVisible).toBeTruthy();
      expect(layout.slotColumns).toBe(2);
      expect(layout.slotEdgeColors).toBeGreaterThan(1);
      expect(layout.countryRows).toBeLessThanOrEqual(2);
      expect(layout.countryBankHeight).toBeGreaterThanOrEqual(viewport.orientation === "landscape" ? 50 : mode.minBankHeight);
      expect(layout.minCountryCardHeight).toBeGreaterThanOrEqual(viewport.orientation === "landscape" ? 24 : mode.minCountryCardHeight);
      expect(layout.choiceRowsAligned).toBeTruthy();
      expect(layout.descriptionsUnclipped).toBeTruthy();
      expect(Math.abs(layout.shellHeight - layout.visualViewportHeight)).toBeLessThanOrEqual(2);
      expect(layout.frameworkOverlay).toBeFalsy();
      expect(["static", "relative"]).toContain(layout.lockPosition);
      expect(layout.lockAfterCards).toBeTruthy();
      expect(layout.lockVisible).toBeTruthy();

      if (mode.difficulty === "expert") {
        await expect(page.locator(".expertAccessGate")).toBeVisible();
        await expect(page.getByRole("button", { name: /sign in to play expert/i })).toBeVisible();
        await expect(page.locator(".countries .country:disabled")).toHaveCount(mode.countries);
        await expect(page.locator(".slots .slot:disabled")).toHaveCount(mode.categories);
        await expect(page.getByRole("button", { name: /sign in above to play/i })).toBeDisabled();
      } else {
        for (let index = 0; index < mode.categories; index += 1) {
          await page.locator(".countries .country:not(:disabled)").first().click();
          await page.locator(".slots .slot").nth(index).click();
        }
        await expect(page.getByRole("button", { name: /lock in draft/i })).toBeEnabled();
      }
      expect(browserErrors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${mode.difficulty}-${viewport.width}x${viewport.height}.png`), fullPage: true });
    });
  }
}


test("same-day v16.2.3 Daily boards remain fully visible on phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLegacyDailyRoutes(page);
  for (const mode of [
    { path: "/daily", countries: 5, categories: 4 },
    { path: "/daily/adventurer", countries: 8, categories: 6 },
    { path: "/daily/expert", countries: 10, categories: 8 },
  ]) {
    await page.goto(mode.path);
    await expect(page.locator(".shell.activePlay.legacyRound")).toBeVisible();
    await expect(page.locator(".countries .country")).toHaveCount(mode.countries);
    await expect(page.locator(".slots .slot")).toHaveCount(mode.categories);
    const fit = await page.evaluate(() => {
      const items = [...document.querySelectorAll<HTMLElement>(".countries .country, .slots .slot, .boardPanel .lock")];
      return {
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        viewportHeight: window.innerHeight,
        allVisible: items.every((item) => { const rect = item.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= window.innerHeight + 1; }),
      };
    });
    expect(fit.documentHeight).toBeLessThanOrEqual(fit.viewportHeight + 2);
    expect(fit.allVisible).toBeTruthy();
  }
});

test("13-inch Adventurer and Expert boards use tall two-column country banks", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installRoutes(page);

  for (const mode of [
    { name: "adventurer", path: "/daily/adventurer", countries: 6, countryRows: 3 },
    { name: "expert", path: "/daily/expert", countries: 8, countryRows: 4 },
  ]) {
    await page.goto(mode.path);
    await expect(page.locator(".countries .country")).toHaveCount(mode.countries);
    await expect(page.locator("main.grid.playGrid")).toBeVisible();
    const layout = await page.evaluate(() => {
      const board = document.querySelector<HTMLElement>("main.grid.playGrid");
      const bank = document.querySelector<HTMLElement>(".bankPanel");
      const atlas = document.querySelector<HTMLElement>(".boardPanel");
      const countryCards = Array.from(document.querySelectorAll<HTMLElement>(".bankPanel .country"));
      if (!board || !bank || !atlas) throw new Error("Gameplay board was not rendered.");
      const boardRect = board.getBoundingClientRect();
      const bankRect = bank.getBoundingClientRect();
      const atlasRect = atlas.getBoundingClientRect();
      const countryRects = countryCards.map((card) => card.getBoundingClientRect());
      const slots = Array.from(document.querySelectorAll<HTMLElement>(".boardPanel .slot"));
      const slotRects = slots.map((slot) => slot.getBoundingClientRect());
      const choiceRects = slots.map((slot) => slot.querySelector<HTMLElement>(".choice")!.getBoundingClientRect());
      return {
        horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
        boardBottom: boardRect.bottom,
        boardHeight: boardRect.height,
        bankBottom: bankRect.bottom,
        atlasBottom: atlasRect.bottom,
        bankHeight: bankRect.height,
        atlasHeight: atlasRect.height,
        bankWidth: bankRect.width,
        atlasWidth: atlasRect.width,
        viewportHeight: window.innerHeight,
        countryColumns: new Set(countryRects.map((rect) => Math.round(rect.left))).size,
        countryRows: new Set(countryRects.map((rect) => Math.round(rect.top))).size,
        choiceRowsAligned: [...new Set(slotRects.map((rect) => Math.round(rect.top)))].every((rowTop) => {
          const tops = choiceRects.filter((_, index) => Math.round(slotRects[index].top) === rowTop).map((rect) => rect.top);
          return tops.length < 2 || Math.max(...tops) - Math.min(...tops) <= 1;
        }),
        countryLabelsContained: Array.from(document.querySelectorAll<HTMLElement>(".bankPanel .country strong")).every((label) => {
          const labelRect = label.getBoundingClientRect();
          const cardRect = label.closest<HTMLElement>(".country")?.getBoundingClientRect();
          return Boolean(cardRect) && labelRect.left >= cardRect!.left - 1 && labelRect.right <= cardRect!.right + 1 && labelRect.top >= cardRect!.top - 1 && labelRect.bottom <= cardRect!.bottom + 1;
        }),
      };
    });
    expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(layout.boardBottom).toBeLessThanOrEqual(layout.viewportHeight + 2);
    expect(layout.viewportHeight - layout.boardBottom).toBeLessThanOrEqual(24);
    expect(layout.boardHeight).toBeGreaterThan(layout.viewportHeight * 0.65);
    expect(Math.abs(layout.bankBottom - layout.atlasBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.bankHeight - layout.atlasHeight)).toBeLessThanOrEqual(1);
    expect(layout.bankWidth / (layout.bankWidth + layout.atlasWidth)).toBeLessThan(0.45);
    expect(layout.atlasWidth).toBeGreaterThan(layout.bankWidth);
    expect(layout.countryColumns).toBe(2);
    expect(layout.countryRows).toBe(mode.countryRows);
    expect(layout.choiceRowsAligned).toBeTruthy();
    expect(layout.countryLabelsContained).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`${mode.name}-1440x900.png`), fullPage: true });
  }
});

test("legacy Seeded links preserve the seed before private Random gates public users", async ({ page }) => {
  const response = await page.request.get("/seeded/expert?seed=OLD-SEED-42", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  const location = response.headers()["location"];
  expect(location).toBeTruthy();
  const redirectedUrl = new URL(location!, "http://127.0.0.1:3000");
  expect(redirectedUrl.pathname).toBe("/random/expert");
  expect(redirectedUrl.searchParams.get("seed")).toBe("OLD-SEED-42");

  await page.goto("/seeded/expert?seed=OLD-SEED-42");
  await expect(page).toHaveURL(/\/daily$/);
});

test("leaderboard is public and invites guests to join the all-time standings", async ({ page }) => {
  await page.route("**/api/leaderboard?difficulty=easy", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ signedIn: false, difficulty: "easy", maxScore: 400, leaders: [
      { rank: 1, username: "AtlasAce", averageScore: 327.4, rating: 62.1, completedGames: 12, isCurrentPlayer: false },
    ] }),
  }));
  await page.goto("/leaderboard");
  await expect(page.getByText("All-time standings")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Average score" })).toBeVisible();
  await expect(page.getByText("327.4 / 400")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in to join leaderboard/i })).toBeVisible();
  await expect(page.getByText("Scout and Adventurer remain playable without an account.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Scout" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Adventurer" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Expert" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Today" })).toHaveCount(0);

  const apiResponse = await page.request.get("/api/leaderboard?difficulty=easy");
  expect(apiResponse.status()).not.toBe(401);
  expect(apiResponse.headers()["cache-control"]).toContain("no-store");
});

test("board card colors have a clear non-scoring key", async ({ page }) => {
  await installRoutes(page);
  await page.goto("/daily");
  const colorKey = page.locator(".categoryColorKey:visible").first();
  await colorKey.locator("summary").click();
  await expect(colorKey.getByText("Card-edge colors group subjects")).toBeVisible();
  await expect(colorKey.getByText("They are guides only and do not change scoring")).toBeVisible();
  await expect(colorKey.getByText("Geography & environment")).toBeVisible();
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
  await expect(page.locator(".resultsModeTabs")).toBeVisible();
  await expect(page.locator(".resultsModeTabs a.active")).toHaveText("Scout");
  await page.getByRole("button", { name: "View rankings" }).first().click();
  await expect(page.locator(".leaderboardColumns")).toBeVisible();
  await expect(page.locator(".leaderboardColumns b")).toHaveText(["Board", "Country", "World Rank", "Value", "Reference", "Points"]);
  await expect(page.locator(".leaderboard .worldRank")).toHaveCount(4);
  const rankingGrid = await page.evaluate(() => {
    const table = document.querySelector<HTMLElement>(".leaderboard")!;
    const header = document.querySelector<HTMLElement>(".leaderboardColumns")!;
    const row = document.querySelector<HTMLElement>(".leaderboard>div:not(.leaderboardHeader):not(.leaderboardColumns)")!;
    return {
      headerColumns: getComputedStyle(header).gridTemplateColumns,
      rowColumns: getComputedStyle(row).gridTemplateColumns,
      horizontallyScrollable: table.scrollWidth > table.clientWidth,
      worldRankVisible: Boolean(row.querySelector(".worldRank")),
    };
  });
  expect(rankingGrid.headerColumns).toBe(rankingGrid.rowColumns);
  expect(rankingGrid.horizontallyScrollable).toBeTruthy();
  expect(rankingGrid.worldRankVisible).toBeTruthy();
  await page.reload();
  await expect(page.getByText("Saved on this browser. Sign in to add it to the leaderboard.")).toBeVisible();
  await expect(page.getByText("Final score")).toBeVisible();
});


test("private Random routes redirect unauthenticated users to Daily", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/random/expert?seed=FULL-SEED-123456789-ABCD");
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByLabel("Random seed")).toHaveCount(0);
});


test.describe("phone touch interaction", () => {
  test.skip(({ isMobile }) => !isMobile, "Touch interaction is covered by the Android and iPhone browser profiles.");

  test("Lock in draft submits with one touch on phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installRoutes(page);
    await page.goto("/daily");
    await expect(page.locator(".slots .slot")).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      await page.locator(".countries .country:not(:disabled)").first().click();
      await page.locator(".slots .slot").nth(index).click();
    }
    const lock = page.getByRole("button", { name: /lock in draft/i });
    await expect(lock).toBeEnabled();
    await lock.tap();
    await expect(page.getByText("Final score")).toBeVisible();
  });
});

test("rules modal scrolls on phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await installRoutes(page);
  await page.goto("/daily");
  await page.getByLabel("Open game menu").click();
  const mobileMenu = page.locator(".mobileMenu");
  await expect(mobileMenu).toHaveAttribute("open", "");
  await mobileMenu.getByRole("button", { name: /how it works/i }).click();
  const card = page.locator(".rulesModalCard");
  await expect(card).toBeVisible();
  const before = await card.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(["auto", "scroll"]).toContain(before.overflowY);
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
  await card.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await card.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("private Random API rejects unauthenticated seeded requests", async ({ page }) => {
  const response = await page.request.get("/api/seeded/easy?seed=RESULT-SEED-KEEP-ME");
  // Verify runs without production Supabase secrets. In that environment the
  // authorization helper fails closed with 503 before it can resolve a user;
  // with Supabase configured, the same unauthenticated request returns 401.
  expect([401, 503]).toContain(response.status());
  const body = await response.json();
  const error = String(body.error ?? "");
  if (response.status() === 503) {
    expect(error).toMatch(/supabase is not configured|server admin key is not configured/i);
  } else {
    expect(error).toMatch(/sign in/i);
  }
});
