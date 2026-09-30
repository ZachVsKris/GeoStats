import { expect, test } from "@playwright/test";

test.skip(process.env.ANIMALSTATS_PREVIEW_ENABLED !== "true", "Private pilot is disabled without its preview flag");

test("available pilot boards render and can be completed", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/animals");
  await expect(page.getByRole("heading", { name: "AnimalStats" })).toBeVisible();
  for (const [label, animals, traits] of [["Scout", 4, 4], ["Adventurer", 6, 4], ["Expert", 8, 6]] as const) {
    await page.getByRole("button", { name: new RegExp(`^${label}\\b`) }).click();
    await expect(page.locator(".animalBoardTop .animalEyebrow")).toContainText("OF");
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
  await expect(cards.locator("img")).toHaveCount(4);
  const first = await cards.nth(0).locator("span").innerText();
  const second = await cards.nth(1).locator("span").innerText();
  await cards.nth(0).click(); await traits.nth(0).click();
  await traits.nth(1).click(); await cards.nth(1).click();
  await cards.nth(0).click(); await traits.nth(1).click();
  await expect(traits.nth(0).locator(".animalTraitChoice")).toHaveText(second);
  await expect(traits.nth(1).locator(".animalTraitChoice")).toHaveText(first);
  await cards.nth(2).scrollIntoViewIfNeeded();
  await traits.nth(2).scrollIntoViewIfNeeded();
  const from = (await cards.nth(2).boundingBox())!;
  const to = (await traits.nth(2).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(traits.nth(2).locator(".animalTraitChoice")).toHaveText(await cards.nth(2).locator("span").innerText());
  await expect(cards.locator("img")).toHaveCount(4);
  await page.getByRole("button", { name: "Reset choices" }).click();
  await expect(page.locator(".animalProgress")).toHaveText("0 / 4 placed");
});


test("daily review gate, persistent personal history and CAT navigation", async ({ page }) => {
  await page.goto("/animals");
  await page.getByRole("button", { name: "Daily", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Daily boards are awaiting review" })).toBeVisible();
  await page.getByRole("button", { name: "Play a random candidate" }).click();
  for (let i = 0; i < 4; i++) { await page.locator(".animalCard").nth(i).click(); await page.locator(".animalTrait").nth(i).click(); }
  await page.getByRole("button", { name: "Reveal results" }).click();
  await page.getByRole("button", { name: "My Stats", exact: true }).click();
  await expect(page.getByText("Player Rating begins after 5 completed games in this mode.")).toBeVisible();
  await expect(page.locator(".animalHistory tbody tr")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "My Stats", exact: true }).click();
  await expect(page.locator(".animalHistory tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Field Guide", exact: true }).click();
  await page.getByLabel("Find an animal").fill("Axolotl");
  await expect(page.getByRole("heading", { name: "Axolotl", exact: true })).toBeVisible();
  await page.goto("/cat");
  await expect(page.getByRole("heading", { name: "Countries, Animals & Things" })).toBeVisible();
  await expect(page.locator("#things")).toContainText("Still digging");
});

import { readFileSync } from "node:fs";
const animalDataset = JSON.parse(readFileSync(new URL("../data/animalstats/pilot.json", import.meta.url), "utf8"));
const candidateData = JSON.parse(readFileSync(new URL("../data/animalstats/candidates.json", import.meta.url), "utf8"));
import { validateAnimalBoard, type AnimalDataset, type BoardCandidate } from "../lib/animalstats";
import { approvedAnimalBoards, animalBoardFingerprint, animalBoardDataFingerprint, type AnimalBoardReview } from "../lib/animalstatsReview";

test("daily approvals bind to exact reviewed data and reject unknown uncertainty by default", () => {
 const data = animalDataset as AnimalDataset;
 const boards = candidateData.boards as BoardCandidate[];
 expect(boards.every((board) => validateAnimalBoard(data, board).valid)).toBe(true);
 expect(approvedAnimalBoards(data, boards, [])).toEqual([]);
 const board = boards[0];
 const review: AnimalBoardReview = { boardId: board.id!, status: "approved", reviewer: "test fixture", reviewedAt: "2026-09-29", sourceChecks: "fixture", uncertaintyChecks: "fixture", playabilityChecks: "fixture", fingerprint: animalBoardFingerprint(board), dataFingerprint: animalBoardDataFingerprint(data, board) };
 expect(approvedAnimalBoards(data, [board], [review])).toHaveLength(1);
 const changed = structuredClone(data);
 changed.values.find((value) => value.animalId === board.animalIds[0] && value.traitId === board.traitIds[0])!.valueNumeric *= 1.01;
 expect(approvedAnimalBoards(changed, [board], [review])).toEqual([]);
 expect(approvedAnimalBoards(data, [board], [{ ...review, uncertaintyChecks: "" }])).toEqual([]);
 const overlapping = structuredClone(data);
 for (const value of overlapping.values.filter((row) => board.animalIds.includes(row.animalId) && row.traitId === board.traitIds[0])) { value.valueMin = 0; value.valueMax = 1e12; }
 expect(validateAnimalBoard(overlapping, board).valid).toBe(false);
});

import { scoreAnimalAssignments } from "../lib/animalstatsScoring";
test("server scoring rejects repeated and foreign assignments", () => {
 const data = animalDataset as AnimalDataset;
 const board = candidateData.boards[0] as BoardCandidate;
 const assignments = Object.fromEntries(board.traitIds.map((id, index) => [id, board.animalIds[index]]));
 const result = scoreAnimalAssignments(data, board, assignments);
 expect(result).not.toBeNull();
 expect(result!.ranks).toHaveLength(board.traitIds.length);
 expect(scoreAnimalAssignments(data, board, { ...assignments, score: 600 })).toBeNull();
 expect(scoreAnimalAssignments(data, board, Object.fromEntries(board.traitIds.map((id) => [id, board.animalIds[0]])))).toBeNull();
 expect(scoreAnimalAssignments(data, board, { ...assignments, [board.traitIds[0]]: "invented-animal" })).toBeNull();
});

 test("Expert is playable and mascot motion is optional", async ({ page }) => {
 await page.goto("/animals");
 await page.getByRole("button", { name: "Pause cat mascot animation" }).click();
 await expect(page.locator(".catCurator")).toHaveClass(/paused/);
 await page.getByRole("button", { name: /^Expert\b/ }).click();
 await expect(page.locator(".animalCard")).toHaveCount(8);
 await expect(page.locator(".animalTrait")).toHaveCount(6);
 await page.emulateMedia({ reducedMotion: "reduce" });
 expect(await page.locator(".catEyes").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
 });


import { ROUND_CONFIGS } from "../lib/gameRules";
import { animalBoardGroup, randomAnimalBoardIndex } from "../lib/animalstatsVariety";
import { orderAnimalPilotBoards } from "../lib/animalstatsDaily";

test("all boards have different first-place animals and attain a perfect score", () => {
 const data = animalDataset as AnimalDataset;
 for (const board of candidateData.boards as BoardCandidate[]) {
  const validation = validateAnimalBoard(data, board);
  expect(validation.rejectionReasons, board.id).toEqual([]);
  expect(new Set(Object.values(validation.winners)).size).toBe(board.traitIds.length);
  const perfect = scoreAnimalAssignments(data, board, validation.winners)!;
  expect(perfect.score).toBe(ROUND_CONFIGS[board.mode].maxScore);
  expect(perfect.optimalChoices).toBe(board.traitIds.length);
 }
 const board = candidateData.boards[0] as BoardCandidate;
 const collision = structuredClone(data);
 const winner = board.animalIds[0];
 for (const traitId of board.traitIds) {
  const trait = collision.traits.find((row) => row.id === traitId)!;
  const row = collision.values.find((row) => row.animalId === winner && row.traitId === traitId)!;
  row.valueNumeric = trait.direction === "higher_wins" ? 1e15 : 1e-9;
  delete row.valueMin; delete row.valueMax;
 }
 expect(validateAnimalBoard(collision, board).rejectionReasons).toContain("category winners are not distinct; perfect score unattainable");
});

test("variety picker rotates groups and opening boards avoid paired bird themes", () => {
 const data = animalDataset as AnimalDataset;
 const boards = candidateData.boards as BoardCandidate[];
 expect(boards.filter((b) => animalBoardGroup(data,b) === "birds").length / boards.length).toBeLessThan(1/3);
 for (const mode of ["easy", "normal"] as const) {
  const pool = boards.filter((board) => board.mode === mode);
  for (let i=0;i<100;i++) {
   const current = pool[i % pool.length];
   const next = pool[randomAnimalBoardIndex(data,pool,current,()=>i/100)];
   expect(animalBoardGroup(data,next)).not.toBe(animalBoardGroup(data,current));
  }
 }
 for (let day=1;day<=30;day++) {
  const ordered = orderAnimalPilotBoards(boards,`2026-09-${String(day).padStart(2,"0")}`,data);
  const first = ["easy","normal"].map((mode)=>animalBoardGroup(data,ordered.find((board)=>board.mode===mode)!));
  expect(first.filter((group)=>group === "birds").length).toBeLessThanOrEqual(1);
 }
});

test("new prototype balances categories and mirrors measured values exactly", () => {
 const data = animalDataset as AnimalDataset;
 const traits = new Map(data.traits.map(t => [t.id, t]));
 for (const trait of data.traits.filter(t => t.prototypeCategory)) {
  const counter = traits.get(trait.counterTraitId!);
  expect(counter?.counterTraitId).toBe(trait.id);
  expect(counter?.direction).not.toBe(trait.direction);
  expect(counter?.measurementBasis).toBe(trait.measurementBasis);
  const original = data.values.filter(v => v.traitId === trait.id).map(({ traitId, ...v }) => v);
  const mirrored = data.values.filter(v => v.traitId === counter!.id).map(({ traitId, ...v }) => v);
  expect(mirrored).toEqual(original);
 }
 const used = new Set((candidateData.boards as BoardCandidate[]).flatMap(board => board.traitIds));
 for (const id of used) expect(used.has(traits.get(id)!.counterTraitId!)).toBe(true);
 for (const board of candidateData.boards as BoardCandidate[]) {
  const categories = board.traitIds.map(id => traits.get(id)!);
  expect(categories.filter(t => t.categoryKind === "intuitive")).toHaveLength(categories.length / 2);
  expect(categories.filter(t => t.categoryKind === "specialist")).toHaveLength(categories.length / 2);
  expect(new Set(categories.map(t => t.metricKey)).size).toBe(categories.length);
  expect(categories.filter(t => t.metricKey === "reproduction").length).toBeLessThanOrEqual(1);
  expect(validateAnimalBoard(data, board).valid).toBe(true);
 }
});
