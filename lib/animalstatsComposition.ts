import type { AnimalDataset, BoardCandidate } from "./animalstats";

// Editorial familiarity, not biological data. Exact species names stay on screen.
// A recognizable animal type counts even when the source uses a specific species.
const COMMON_TYPES = new Set([
  "ursus_americanus", "ceratotherium_simum", "capra_hircus", "sus_scrofa",
  "procyon_lotor", "meles_meles", "panthera_onca", "puma_concolor",
  "phoca_vitulina", "zalophus_californianus", "vombatus_ursinus",
  "rangifer_tarandus", "cervus_elaphus", "suricata_suricatta",
  "rattus_norvegicus", "mesocricetus_auratus", "myotis_lucifugus",
  "pteropus_vampyrus", "myrmecophaga_tridactyla", "dasypus_novemcinctus",
  "ornithorhynchus_anatinus", "erinaceus_europaeus", "cavia_porcellus",
  "aquila_chrysaetos", "cygnus_olor", "pavo_cristatus", "phoenicopterus_roseus",
  "ramphastos_toco", "cacatua_galerita", "ara_macao", "bubo_virginianus",
  "aptenodytes_patagonicus", "pygoscelis_papua", "spheniscus_demersus",
  "anser_anser", "corvus_corone", "larus_argentatus", "pelecanus_occidentalis",
  "alligator_mississippiensis", "crocodylus_niloticus", "crocodylus_acutus",
  "boa_constrictor", "eunectes_murinus", "python_regius", "python_molurus",
  "crotalus_atrox", "chelonia_mydas", "caretta_caretta", "dermochelys_coriacea",
  "trachemys_scripta", "gopherus_agassizii", "chelonoidis_nigra",
  "anaxyrus_americanus", "rhinella_marina", "lithobates_catesbeianus",
  "hyla_versicolor", "litoria_caerulea", "dendrobates_auratus", "ambystoma_mexicanum",
  "carcharodon_carcharias", "rhincodon_typus", "galeocerdo_cuvier",
  "sphyrna_lewini", "cetorhinus_maximus", "manta_birostris",
  "cyprinus_carpio", "carassius_auratus", "salmo_salar", "gadus_morhua",
  "thunnus_alalunga", "homarus_americanus", "apis_mellifera", "drosophila_melanogaster",
]);
const commonCache = new WeakMap<AnimalDataset, Set<string>>();
const traitKindsCache = new WeakMap<AnimalDataset, Map<string, string | undefined>>();
export function commonAnimalIds(data: AnimalDataset) {
  const existing = commonCache.get(data); if (existing) return existing;
  const common = new Set(data.animals.filter(a => a.familiarityTier === "core" || COMMON_TYPES.has(a.id)).map(a => a.id));
  commonCache.set(data, common); return common;
}
export function animalBoardComposition(data: AnimalDataset, board: BoardCandidate) {
  const common = commonAnimalIds(data);
  let traits = traitKindsCache.get(data);
  if (!traits) { traits = new Map(data.traits.map(t => [t.id, t.categoryKind])); traitKindsCache.set(data, traits); }
  const intuitive = board.traitIds.filter(id => traits.get(id) === "intuitive").length;
  const familiar = board.animalIds.filter(id => common.has(id)).length;
  const minimumIntuitive = Math.ceil(board.traitIds.length / 2);
  const minimumFamiliar = board.animalIds.length >= 6 ? 2 : 1;
  return { intuitive, familiar, minimumIntuitive, minimumFamiliar,
    eligible: intuitive >= minimumIntuitive && familiar >= minimumFamiliar };
}
