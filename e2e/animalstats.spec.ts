import { expect, test } from "@playwright/test";

test.skip(process.env.ANIMALSTATS_PREVIEW_ENABLED !== "true", "Private pilot is disabled without its preview flag");

test("available pilot boards render and can be completed", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/animals");
  await expect(page.getByRole("heading", { name: "AnimalStats" })).toBeVisible();
  for (const [label, animals, traits] of [["Scout", 4, 4], ["Adventurer", 6, 4], ["Expert", 8, 6]] as const) {
    await page.getByRole("button", { name: new RegExp(`^${label}\\b`) }).click();
    await expect(page.locator(".challengeIdentity")).toContainText(label);
    await expect(page.locator(".animalCard")).toHaveCount(animals);
    await expect(page.locator(".animalTrait")).toHaveCount(traits);
    for (let index = 0; index < traits; index++) {
      await page.locator(".animalTrait").nth(index).click();
      await page.locator(".animalCard").nth(index).click();
    }
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.locator(".resultWrap")).toHaveCount(traits);
    await expect(page.getByText("Optimal Choices:")).toBeVisible();
  }
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
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText("Optimal score: 400")).toBeVisible();
  await page.getByRole("button", { name: "View rankings" }).first().click();
  await page.getByRole("button", { name: "Data & Source" }).first().click();
  await expect(page.getByRole("heading", { name: "Full catalog rankings" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("either-order placement, swapping, dragging and animated illustrations", async ({ page }) => {
  await page.goto("/animals");
  const cards = page.locator(".animalCard");
  const traits = page.locator(".animalTrait");
  await expect(cards.locator(".animalSprite")).toHaveCount(4);
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
  await expect(cards.locator(".animalSprite")).toHaveCount(4);
  await page.getByRole("button", { name: "Reset choices" }).click();
  await expect(page.locator(".animalProgress")).toHaveText("0 / 4 placed");
});


test("daily review gate, persistent personal history and CAT navigation", async ({ page }) => {
  await page.goto("/animals");
  await page.getByRole("button", { name: "Daily", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Daily boards are awaiting review" })).toBeVisible();
  await page.getByRole("button", { name: "Play a random candidate" }).click();
  for (let i = 0; i < 4; i++) { await page.locator(".animalCard").nth(i).click(); await page.locator(".animalTrait").nth(i).click(); }
  await page.getByRole("button", { name: "Submit answers" }).click();
  await page.getByRole("button", { name: "My Stats", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Game history" })).toBeVisible();
  await expect(page.locator(".animalHistory tbody tr")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "My Stats", exact: true }).click();
  await expect(page.locator(".animalHistory tbody tr")).toHaveCount(1);
  await page.locator(".animalGeoMenu summary").click();
  await page.getByRole("button", { name: "Full data", exact: true }).click();
  await page.getByLabel("Find an animal").fill("Axolotl");
  await expect(page.locator(".animalDataTable tbody tr").filter({ hasText: "Axolotl" })).toBeVisible();
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

 test("Expert is playable and cartoon motion is optional", async ({ page }) => {
 await page.goto("/animals");
 await page.locator(".animalGeoMenu summary").click();
 await page.getByRole("button", { name: "Pause animation", exact:true }).click();
 await page.locator(".animalGeoMenu summary").click();
 await expect(page.locator(".cartoonHead").first()).toHaveCSS("animation-play-state","paused");
 await page.getByRole("button", { name: /^Expert\b/ }).click();
 await expect(page.locator(".animalCard")).toHaveCount(8);
 await expect(page.locator(".animalTrait")).toHaveCount(6);
 await page.emulateMedia({ reducedMotion: "reduce" });
 expect(await page.locator(".cartoonBlink").first().evaluate(el => getComputedStyle(el).animationName)).toBe("none");
 });


import { ROUND_CONFIGS } from "../lib/gameRules";
import { animalBoardGroup, randomAnimalBoardIndex } from "../lib/animalstatsVariety";
import { orderAnimalPilotBoards } from "../lib/animalstatsDaily";
const retainedLiveBoards = JSON.parse(readFileSync(new URL("../data/animalstats/retained-live-boards.json", import.meta.url), "utf8"));

test('previously shared boards preserve their IDs, animal order and prize order',()=>{
 const current=new Map((candidateData.boards as BoardCandidate[]).map(b=>[b.id,b]));
 for(const board of retainedLiveBoards.boards){
  const retained=current.get(board.id);
  expect(retained,board.id).toBeDefined();
  expect(retained!.animalIds).toEqual(board.animalIds);
  expect(retained!.traitIds).toEqual(board.traitIds);
 }
});

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
 for (const trait of data.traits.filter(t => t.prototypeCategory && !t.oneSided)) {
  const counter = traits.get(trait.counterTraitId!);
  expect(counter?.counterTraitId).toBe(trait.id);
  expect(counter?.direction).not.toBe(trait.direction);
  expect(counter?.measurementBasis).toBe(trait.measurementBasis);
  const original = data.values.filter(v => v.traitId === trait.id).map(({ traitId, ...v }) => v);
  const mirrored = data.values.filter(v => v.traitId === counter!.id).map(({ traitId, ...v }) => v);
  expect(mirrored).toEqual(original);
 }
 const used = new Set((candidateData.boards as BoardCandidate[]).flatMap(board => board.traitIds));
 for (const id of used) { const trait = traits.get(id)!; if (!trait.oneSided) expect(used.has(trait.counterTraitId!)).toBe(true); else expect(trait.counterTraitId).toBeUndefined(); }
 for (const board of candidateData.boards as BoardCandidate[]) {
  const categories = board.traitIds.map(id => traits.get(id)!);
  expect(categories.filter(t => t.categoryKind === "intuitive").length).toBeGreaterThanOrEqual(Math.ceil(categories.length / 2));
  expect(categories.some(t => /^(bird_beak_width|bird_beak_depth|bird_tarsus_length|bird_hand_wing_index)(?:__low)?$/.test(t.id))).toBe(false);
  expect(new Set(categories.map(t => t.metricKey)).size).toBe(categories.length);
  expect(categories.filter(t => t.metricKey === "reproduction").length).toBeLessThanOrEqual(1);
  expect(validateAnimalBoard(data, board).valid).toBe(true);
 }
});


test("new mammal comparisons preserve measured facts and stay separate", () => {
 const data=animalDataset as AnimalDataset;
 const breathing=data.values.filter(v=>v.traitId==="resting_breathing_frequency");
 expect(Object.fromEntries(breathing.map(v=>[v.animalId,v.valueNumeric]))).toEqual({
  ceratotherium_simum:11,hippopotamus_amphibius:6,giraffa_camelopardalis:7,ursus_maritimus:13,castor_canadensis:33,
 });
 expect(breathing.some(v=>v.animalId==="canis_lupus")).toBe(false);
 const milk=data.values.filter(v=>v.traitId.startsWith("milk_")&&!v.traitId.endsWith("__low"));
 expect(milk).toHaveLength(34);
 expect(milk.some(v=>["macropus_rufus","phascolarctos_cinereus","ornithorhynchus_anatinus"].includes(v.animalId))).toBe(false);
 expect(milk.some(v=>v.animalId==="giraffa_camelopardalis"&&v.traitId==="milk_sugar_concentration")).toBe(false);
 for(const v of [...breathing,...milk]) {
  expect(v.observationType).toBe("compiled");
  expect(v.uncertaintyStatus).toBe("not-reported");
  expect(v.valueMin).toBeUndefined();
  expect(v.valueMax).toBeUndefined();
 }
 const boards=candidateData.boards as BoardCandidate[];
 for(const id of ["resting_breathing_frequency","milk_fat_concentration","milk_sugar_concentration","milk_protein_concentration"])
  expect(boards.some(b=>b.traitIds.includes(id))).toBe(true);
 for(const board of boards)expect(board.traitIds.filter(id=>id.startsWith("milk_")).length).toBeLessThanOrEqual(1);
 const board={...boards.find(b=>b.mode==="easy")!,traitIds:["milk_fat_concentration","milk_sugar_concentration","adult_body_mass","gestation"]};
 expect(validateAnimalBoard(data,board).rejectionReasons).toContain("only one milk-composition prize per board");
});

test("diet and range geography use exact evidence and keep related prizes apart",()=>{
 const data=animalDataset as AnimalDataset;
 const foods=data.values.filter(v=>v.traitId==='diet_food_group_count');
 expect(foods).toHaveLength(29);
 expect(Object.fromEntries(foods.filter(v=>['giraffa_camelopardalis','gorilla_gorilla','macaca_mulatta','pan_troglodytes'].includes(v.animalId)).map(v=>[v.animalId,v.valueNumeric]))).toEqual({giraffa_camelopardalis:1,gorilla_gorilla:2,macaca_mulatta:3,pan_troglodytes:4});
 expect(foods.some(v=>v.animalId==='enhydra_lutris')).toBe(false);
 const value=(animalId:string,traitId:string)=>data.values.find(v=>v.animalId===animalId&&v.traitId===traitId)?.valueNumeric;
 expect(value('canis_lupus','mapped_north_pole_distance')).toBe(6.73);
 expect(value('canis_lupus','mapped_south_pole_distance')).toBe(101.48);
 expect(value('canis_lupus','mapped_latitude_span')).toBe(71.79);
 expect(value('macropus_rufus','mapped_north_pole_distance')).toBe(106.89);
 expect(value('macropus_rufus','mapped_south_pole_distance')).toBe(53.73);
 expect(value('macropus_rufus','mapped_latitude_span')).toBe(19.38);
 expect(value('ursus_maritimus','mapped_north_pole_distance')).toBeUndefined();
 expect(data.traits.find(t=>t.id==='mapped_north_pole_distance__low')?.displayName).toBe('Closest to North Pole');
 expect(data.traits.find(t=>t.id==='mapped_north_pole_distance__low')?.direction).toBe('lower_wins');
 const traits=new Map(data.traits.map(t=>[t.id,t]));
 for(const board of candidateData.boards as BoardCandidate[])expect(board.traitIds.filter(t=>['range','range-geography'].includes(traits.get(t)!.gameplayFamily??'')).length).toBeLessThanOrEqual(1);
 const board={...(candidateData.boards as BoardCandidate[]).find(b=>b.mode==='easy')!,traitIds:['mapped_north_pole_distance','mapped_south_pole_distance','adult_body_mass','gestation']};
 expect(validateAnimalBoard(data,board).rejectionReasons).toContain('only one mapped-range prize per board');
});

test("new category data endpoint returns the complete approved release values",async({request})=>{
 const data=animalDataset as AnimalDataset;
 for(const traitId of ["resting_breathing_frequency","resting_breathing_frequency__low","milk_fat_concentration","milk_fat_concentration__low","milk_sugar_concentration","milk_sugar_concentration__low","milk_protein_concentration","milk_protein_concentration__low",'diet_food_group_count','diet_food_group_count__low','mapped_north_pole_distance','mapped_north_pole_distance__low','mapped_south_pole_distance','mapped_south_pole_distance__low','mapped_latitude_span','mapped_latitude_span__low']) {
  const response=await request.get(`/api/animals/data?trait=${traitId}`);
  expect(response.status()).toBe(200);
  const result=await response.json();
  const expected=data.values.filter(v=>v.traitId===traitId);
  expect(result.coverage).toBe(expected.length);
  expect(result.values.map((v:{animalId:string,valueNumeric:number})=>[v.animalId,v.valueNumeric]).sort()).toEqual(expected.map(v=>[v.animalId,v.valueNumeric]).sort());
  expect(["warehouse","release-snapshot"]).toContain(result.origin);
 }
 expect((await request.get('/api/animals/data?trait=not_a_category')).status()).toBe(404);
});

for(const prefix of ["resting_breathing_frequency","milk_fat_concentration",'diet_food_group_count','mapped_north_pole_distance__low']) {
 test(`new ${prefix} board plays through to sourced rankings`,async({page})=>{
  const board=(candidateData.boards as BoardCandidate[]).find(b=>b.mode==="easy"&&b.traitIds.includes(prefix))!;
  await page.goto(`/animals?board=${board.id}`);
  for(let i=0;i<4;i++){await page.locator('.penAnimal').nth(i).click();await page.locator('.traitPodium').nth(i).click();}
  await page.getByRole('button',{name:'Submit answers'}).click();
  await expect(page.locator('.resultWrap')).toHaveCount(4);
  const trait=(animalDataset as AnimalDataset).traits.find(t=>t.id===prefix)!;
  const result=page.locator('.resultWrap').filter({hasText:trait.displayName});
  await result.getByRole('button',{name:'View rankings'}).click();
  await expect(result.locator('.boardRank')).toHaveCount(4);
  await expect(result).toContainText(trait.unit);
 });
}

test("GeoStats result layout replaces the separate award ceremony", async ({page}) => {
 await page.goto('/animals');
 for(let i=0;i<4;i++){await page.locator('.penAnimal').nth(i).click();await page.locator('.traitPodium').nth(i).click();}
 await page.getByRole('button',{name:'Submit answers'}).click();
 await expect(page.locator('.resultWrap')).toHaveCount(4);
 await expect(page.locator('.hybridNursery,.hybridBaby,.pairingCanvas,.fairAwards')).toHaveCount(0);
 await expect(page.getByText('Optimal Choice',{exact:true})).toHaveCount(4);
 await expect(page.getByRole('button',{name:'View rankings'})).toHaveCount(4);
});

test("phone pen supports touch drag and reduced-motion results", async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto("/animals");
 const cards = page.locator(".penAnimal");
 const podiums = page.locator(".traitPodium");
 await podiums.first().scrollIntoViewIfNeeded();
 await cards.first().scrollIntoViewIfNeeded();
 const start = (await cards.first().boundingBox())!;
 const end = (await podiums.first().boundingBox())!;
 const cdp = await page.context().newCDPSession(page);
 const x = start.x + start.width / 2, y = start.y + start.height / 2;
 await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
 await expect(cards.first()).toHaveAttribute("data-name-open", "true");
 for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (end.x + end.width / 2 - x) * step / 8, y: y + (end.y + end.height / 2 - y) * step / 8 }] });
 await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
 await expect(podiums.first()).toHaveClass(/occupied/);
 for (let i = 1; i < 4; i++) { await cards.nth(i).click(); await podiums.nth(i).click(); }
 await page.emulateMedia({ reducedMotion: "reduce" });
 await page.getByRole("button", { name: "Submit answers" }).click();
 await expect(page.locator(".resultWrap")).toHaveCount(4);
 expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
 await cdp.detach();
});

test("podium remove returns an animal to the pen and supports replacement", async ({ page }) => {
 await page.goto("/animals");
 const first = page.locator(".penAnimal").first();
 const podium = page.locator(".traitPodium").first();
 const animalId = await first.locator(".animalSprite").getAttribute("data-animal-id");
 await first.click(); await podium.click();
 await expect(first).toHaveAttribute("data-on-podium", "true");
 await podium.getByRole("button", { name: /^Remove / }).click();
 await expect(podium).not.toHaveClass(/occupied/);
 await expect(first).toHaveAttribute("data-on-podium", "false");
 await expect(page.locator(".animalProgress")).toHaveText("0 / 4 placed");
 await first.click(); await podium.click();
 await expect(podium.locator(".animalSprite")).toHaveAttribute("data-animal-id", animalId!);
 await podium.getByRole("button", { name: /^Remove / }).focus();
 await page.keyboard.press("Enter");
 await expect(podium).not.toHaveClass(/occupied/);
});

import {cartoonSpecies} from '../lib/animalstatsCartoons';
test('every playable species has an illustrated profile',()=>{
 expect(cartoonSpecies).toHaveLength(85);
 for(const board of candidateData.boards)for(const id of board.animalIds)expect(cartoonSpecies).toContain(id);
});
for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844},{width:375,height:667}]){
 test(`all contestants, prizes and submit fit without scrolling ${viewport.width}x${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);await page.goto('/animals');
 for(const mode of ['Scout','Adventurer','Expert']){
  await page.getByRole('button',{name:new RegExp(`^${mode}\\b`)}).click();
  const bounds=await page.locator('.penAnimal,.traitPodium,.animalSubmit>button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}}));
  expect(bounds.every(r=>r.top>=0&&r.bottom<=viewport.height&&r.left>=0&&r.right<=viewport.width&&r.width>20&&r.height>20)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  await expect(page.locator('.penAnimal>.animalSprite').first()).toHaveAttribute('data-art-version','fair-cartoon-v2');
  await expect(page.locator('.animalNameTag').first()).toHaveCSS('opacity','1');
 }
 await page.locator('.animalGeoMenu summary').click();
 await page.getByRole('button',{name:'Pause animation',exact:true}).click();
 await page.locator('.animalGeoMenu summary').click();
 await expect(page.locator('.penAnimal .cartoonHead').first()).toHaveCSS('animation-play-state','paused');
 });
}

test("expanded catalog has playable opposite teeth, swim, REM and metabolism prizes without lifecycle overload", () => {
 const data = animalDataset as AnimalDataset;
 const used = new Set((candidateData.boards as BoardCandidate[]).flatMap(b => b.traitIds));
 for (const id of ["adult_tooth_count", "field_swim_speed", "daily_rem_sleep", "basal_energy", "mass_specific_basal_energy"]) {
  expect(used.has(id)).toBe(true); expect(used.has(`${id}__low`)).toBe(true);
 }
 expect(used.size).toBeGreaterThanOrEqual(56);
 const lifecycle = new Set(["pregnancy", "offspring", "incubation", "weaning", "maturity", "reproduction", "breeding", "egg-size"]);
 for (const board of candidateData.boards as BoardCandidate[]) {
  expect(board.traitIds.filter(id => lifecycle.has(data.traits.find(t => t.id === id)!.metricKey!)).length).toBeLessThanOrEqual(board.mode === "expert" ? 3 : 1);
 }
 const fox = data.values.find(v => v.animalId === "vulpes_vulpes" && v.traitId === "adult_tooth_count")!;
 expect(fox.valueNumeric).toBe(42); expect(fox.notes).toContain("Vulpes_vulpes.php");
 const rates = data.values.filter(v => v.traitId === "mass_specific_basal_energy");
 expect(rates.every(v => v.notes.includes("Exact arithmetic ratio"))).toBe(true);
});

test("prize tent supports search, opposite trails, and same-board challenges", async ({page,context}) => {
 await context.grantPermissions(["clipboard-read", "clipboard-write"]);
 await page.goto("/animals");
 await page.locator(".animalGeoMenu summary").click();
 await page.getByRole("button", {name:"Categories", exact:true}).click();
 await page.locator(".animalGeoMenu summary").click();
 await page.getByLabel("Find a category",{exact:true}).fill("teeth");
 await expect(page.locator(".animalDataTable tbody tr")).toHaveCount(1);
 await page.getByRole("button", {name:"Play opposite",exact:true}).click();
 await expect(page.locator(".fairFocusNotice")).toContainText("Fewest adult teeth");
 await expect(page.locator(".traitPodium[data-trait-id=adult_tooth_count__low]")).toHaveCount(1);
 const animals = await page.locator(".penAnimal .animalSprite").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-animal-id")));
 const prizes = await page.locator(".traitPodium").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-trait-id")));
 await page.getByRole("button", {name:"Copy link",exact:true}).click();
 await expect(page.getByRole("button", {name:"Link copied ✓",exact:true})).toBeVisible();
 const url = await page.evaluate(() => navigator.clipboard.readText());
 expect(new URL(url).searchParams.get("board")).toBeTruthy();
 await page.goto(url);
 expect(await page.locator(".penAnimal .animalSprite").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-animal-id")))).toEqual(animals);
 expect(await page.locator(".traitPodium").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-trait-id")))).toEqual(prizes);
 await page.locator(".animalGeoMenu summary").click();
 await page.getByRole("button", {name:"How to play",exact:true}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("prize-to-animal dragging, pen returns and podium moves work in both directions", async ({page}) => {
 await page.goto('/animals');
 const cards=page.locator('.penAnimal'), podiums=page.locator('.traitPodium');
 const firstName=await cards.nth(0).locator('.animalNameTag').innerText();
 async function drag(from: import('@playwright/test').Locator,to: import('@playwright/test').Locator){
  const a=(await from.boundingBox())!, b=(await to.boundingBox())!;
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();
 }
 await drag(podiums.first(),cards.first());
 await expect(podiums.first().locator('.podiumNameTag')).toHaveText(firstName);
 await drag(podiums.first().locator('.podiumAnimal'),podiums.nth(1));
 await expect(podiums.nth(1).locator('.podiumNameTag')).toHaveText(firstName);
 await expect(podiums.first()).not.toHaveClass(/occupied/);
 await drag(podiums.nth(1).locator('.podiumAnimal'),page.locator('.animalPen'));
 await expect(page.locator('.animalProgress')).toHaveText('0 / 4 placed');
 await expect(cards.first()).toHaveAttribute('data-on-podium','false');
});

test("full catalog panel searches, exports exact observations and restores keyboard focus", async ({page}) => {
 await page.goto('/animals');
 await page.locator('.animalGeoMenu summary').click();
 await page.getByRole('button',{name:'Categories',exact:true}).click();
 await page.locator('.animalGeoMenu summary').click();
 await page.getByLabel('Find a category',{exact:true}).fill('mammal tail');
 await expect(page.locator('.animalDataTable tbody tr')).toHaveCount(1);
 const opener=page.getByRole('button',{name:'Data & Source',exact:true});
 await opener.click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Look up an animal').fill('Red fox');
 await expect(page.locator('.sourceDataRow')).toHaveCount(1);
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download full data (CSV)'}).click();
 expect((await download).suggestedFilename()).toContain('mammal_tail_length_upper');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(opener).toBeFocused();
});

test("short-height windows can scroll to submit and ribbons do not imply numbered prizes",async({page})=>{
 await page.setViewportSize({width:1366,height:500});await page.goto('/animals');
 await page.getByRole('button',{name:'Expert',exact:true}).click();
 await expect(page.locator('.podiumBadge')).toHaveText(['★','★','★','★','★','★']);
 await page.getByRole('button',{name:'Submit answers'}).scrollIntoViewIfNeeded();
 const box=(await page.getByRole('button',{name:'Submit answers'}).boundingBox())!;
 expect(box.y+box.height).toBeLessThanOrEqual(500);
});
