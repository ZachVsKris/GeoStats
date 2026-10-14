import fs from 'node:fs';

// This audit describes artwork risks, not biological eligibility. It never
// retires boards, changes values, or guesses unreviewed photo crops.
const parts = ['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds','extinct'].map(name => JSON.parse(fs.readFileSync(`data/animalstats/${name}.json`)));
const traits = parts.flatMap(part => part.traits);
const animals = new Map(parts.flatMap(part => part.animals).map(animal => [animal.id, animal]));
const boards = ['candidates','group-boards','group-boards-2','extinct'].flatMap(name => JSON.parse(fs.readFileSync(`data/animalstats/${name}.json`)).boards);
const photos = new Map(parts.flatMap(part => part.photos).filter(photo => photo.approved).map(photo => [photo.animalId, photo]));
const usedTraits = new Set(boards.flatMap(board => board.traitIds));
const counts = new Map();
for (const board of boards) for (const id of board.traitIds) counts.set(id, (counts.get(id) ?? 0) + 1);
const headMetrics = new Set(['beak-length','beak-width','beak-depth','ear-length']);
const bodyMetrics = new Set(['tail','wingspan','wing-shape','tarsus','height','length','body-length','shell-length','shell-width','insect-body-length','reptile-total-length']);
function risk(trait) {
  if (headMetrics.has(trait.metricKey)) return { level: 'direct-head-anatomy', treatment: 'Seek consistent front-facing identification portraits. A head crop alone does not conceal the measured feature; residual clues require playtesting.' };
  if (bodyMetrics.has(trait.metricKey) || ['bird_wing_length','bird_kipps_distance','bird_secondary_length'].includes(trait.id.replace(/__low$/, ''))) return { level: 'direct-body-anatomy', treatment: 'Reviewed face/head portrait during guessing; full specimen or body image after results. For shell-only or faceless animals, review an alternative identity view.' };
  return { level: 'identity-or-context', treatment: 'Keep recognizable animals in equal-size frames; remove people, rulers and other scale references from gameplay crops. Recognizing species size remains intended knowledge.' };
}
const categoryReview = [];
const reviewed = new Set();
const byTraitId = new Map(traits.map(trait => [trait.id, trait]));
for (const trait of traits) {
  if (!usedTraits.has(trait.id) || reviewed.has(trait.id)) continue;
  // Keep opposites together in the owner's review, without forcing them onto
  // the same gameplay board.
  const opposite = byTraitId.get(trait.counterTraitId);
  for (const entry of [trait, opposite].filter(Boolean)) {
    if (!usedTraits.has(entry.id) || reviewed.has(entry.id)) continue;
    reviewed.add(entry.id);
    categoryReview.push({ traitId: entry.id, label: entry.displayName, counterTraitId: entry.counterTraitId ?? null, boardOccurrences: counts.get(entry.id), ...risk(entry) });
  }
}
const directIds = new Set(categoryReview.filter(row => row.level.startsWith('direct-')).map(row => row.traitId));
const usedAnimals = new Set(boards.flatMap(board => board.animalIds));
const extinctAssets = [...usedAnimals].filter(id => animals.get(id)?.extinctionStatus === 'extinct').map(id => ({animalId:id, scientificName:animals.get(id).scientificName, staticAsset:photos.get(id)?.assetUrl ?? null, requiresStaticReplacement:!photos.get(id) || photos.get(id).assetUrl.endsWith('.svg')}));
const report = {
  generatedAt: new Date().toISOString().slice(0,10),
  policy: 'Keep images. Test reviewed identification portraits during play and full images in results. Do not distort anatomy, silently replace exact species, or remove boards merely because pictures need work.',
  totalBoards: boards.length,
  boardsRequiringVisualReview: boards.filter(board => board.traitIds.some(id => directIds.has(id))).length,
  directVisualTraitIds: directIds.size,
  categoryReview,
  extinctAssets,
  remainingWork: ['Manual crop review for every playable animal', 'Species-specific cartoon recognition audit', 'Front-facing bird and ear-comparison portraits', 'Faceless marine/invertebrate identity-image treatment', 'Ensure galleries, drag ghosts and assigned slots use the same safe gameplay view', 'Reveal full images and sources after submission', 'Phone/desktop no-scroll checks after any portrait changes'],
};
fs.writeFileSync('data/animalstats/research/visual-clue-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totalBoards:report.totalBoards,boardsRequiringVisualReview:report.boardsRequiringVisualReview,directVisualTraitIds:report.directVisualTraitIds,extinctStaticReplacementsRemaining:extinctAssets.filter(asset=>asset.requiresStaticReplacement).length}));
