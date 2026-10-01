import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
// Anatomical proportions are visual character design, never game statistics.
type Kind =
  | "quadruped"
  | "bird"
  | "penguin"
  | "primate"
  | "marine"
  | "reptile"
  | "snake"
  | "turtle";
type Profile = {
  kind: Kind;
  color: string;
  belly: string;
  length: number;
  height: number;
  leg: number;
  neck: number;
  snout: number;
  ear: number;
  tail: number;
  pattern?: "spots" | "rosettes" | "stripes" | "patches";
  feature?: string;
};
const base: Profile = {
  kind: "quadruped",
  color: "#ad784a",
  belly: "#e8d7b4",
  length: 1.7,
  height: 0.62,
  leg: 0.65,
  neck: 0,
  snout: 0.4,
  ear: 0.24,
  tail: 1,
};
const profiles: Record<string, Partial<Profile>> = {
  didelphis_marsupialis: {
    color: "#888a89",
    belly: "#ededdf",
    snout: 0.57,
    ear: 0.25,
    tail: 1.65,
    feature: "opossum",
  },
  tupaia_glis: {
    color: "#946a44",
    length: 1.75,
    height: 0.37,
    leg: 0.36,
    snout: 0.48,
    ear: 0.13,
    tail: 1.55,
    feature: "treeshrew",
  },
  ornithorhynchus_anatinus: {
    color: "#76543b",
    height: 0.35,
    leg: 0.24,
    snout: 0.55,
    ear: 0,
    tail: 0.95,
    feature: "platypus",
  },
  vulpes_vulpes: {
    color: "#cf642a",
    belly: "#fff4db",
    height: 0.53,
    leg: 0.8,
    snout: 0.52,
    ear: 0.42,
    tail: 1.45,
    feature: "fox",
  },
  acinonyx_jubatus: {
    color: "#d3aa5e",
    height: 0.51,
    leg: 1,
    snout: 0.25,
    ear: 0.19,
    pattern: "spots",
    feature: "cheetah",
  },
  melursus_ursinus: {
    color: "#242625",
    length: 2.1,
    height: 0.72,
    leg: 0.65,
    ear: 0.28,
    snout: 0.49,
    tail: 0.12,
    feature: "slothbear",
  },
  pan_troglodytes: {
    kind: "primate",
    color: "#34332d",
    belly: "#9c8170",
    tail: 0,
    feature: "chimp",
  },
  ailuropoda_melanoleuca: {
    color: "#f3eedc",
    belly: "#f3eedc",
    length: 1.85,
    height: 0.7,
    leg: 0.55,
    ear: 0.27,
    tail: 0.12,
    snout: 0.26,
    feature: "panda",
  },
  gorilla_gorilla: {
    kind: "primate",
    color: "#3f4543",
    belly: "#737977",
    height: 1.1,
    tail: 0,
    feature: "gorilla",
  },
  giraffa_camelopardalis: {
    color: "#d8b576",
    length: 1.55,
    height: 0.59,
    leg: 1.5,
    neck: 1.6,
    snout: 0.48,
    ear: 0.25,
    tail: 0.9,
    pattern: "patches",
    feature: "giraffe",
  },
  ceratotherium_simum: {
    color: "#92958d",
    height: 0.9,
    leg: 0.6,
    snout: 0.6,
    ear: 0.22,
    tail: 0.55,
    feature: "rhino",
  },
  phascolarctos_cinereus: {
    color: "#969f9d",
    length: 1.25,
    height: 0.64,
    leg: 0.4,
    snout: 0.12,
    ear: 0.4,
    tail: 0,
    feature: "koala",
  },
  panthera_leo: {
    color: "#c79b50",
    height: 0.64,
    leg: 0.8,
    snout: 0.31,
    ear: 0.2,
    tail: 1.5,
    feature: "lion",
  },
  panthera_tigris: {
    color: "#dc8d36",
    height: 0.69,
    leg: 0.75,
    snout: 0.3,
    ear: 0.21,
    tail: 1.35,
    pattern: "stripes",
    feature: "tiger",
  },
  loxodonta_africana: {
    color: "#8c9691",
    height: 1,
    leg: 0.95,
    snout: 0.24,
    ear: 0.9,
    tail: 0.7,
    feature: "elephant",
  },
  equus_quagga: {
    color: "#f1ead8",
    height: 0.7,
    leg: 1.15,
    snout: 0.6,
    ear: 0.3,
    tail: 0.85,
    pattern: "stripes",
    feature: "zebra",
  },
  helarctos_malayanus: { color: "#302c24", feature: "sunbear" },
  tremarctos_ornatus: { color: "#34322d", feature: "spectacledbear" },
  ursus_americanus: { color: "#282b28", feature: "blackbear" },
  ursus_arctos: { color: "#785334", feature: "brownbear" },
  ursus_maritimus: { color: "#f4f1dd", belly: "#e9e5d6", feature: "polarbear" },
  ursus_thibetanus: { color: "#292d2c", feature: "moonbear" },
  canis_lupus: {
    color: "#888b82",
    belly: "#d5d4c7",
    snout: 0.53,
    ear: 0.32,
    tail: 1.15,
    feature: "wolf",
  },
  panthera_pardus: {
    color: "#d6ac62",
    pattern: "rosettes",
    feature: "leopard",
  },
  alligator_mississippiensis: {
    kind: "reptile",
    color: "#57614b",
    length: 2.3,
    height: 0.28,
    leg: 0.25,
    snout: 0.85,
    ear: 0,
    tail: 1.65,
    feature: "alligator",
  },
  crocodylus_acutus: {
    kind: "reptile",
    color: "#8b8f64",
    length: 2.3,
    height: 0.28,
    leg: 0.25,
    snout: 1.05,
    ear: 0,
    tail: 1.65,
    feature: "crocodile",
  },
  erinaceus_europaeus: {
    color: "#987951",
    height: 0.45,
    leg: 0.22,
    snout: 0.37,
    ear: 0.13,
    tail: 0.1,
    feature: "hedgehog",
  },
  bison_bison: {
    color: "#735039",
    height: 1,
    leg: 0.65,
    ear: 0.18,
    tail: 0.65,
    feature: "bison",
  },
  equus_asinus: {
    color: "#98958b",
    height: 0.63,
    leg: 1,
    snout: 0.58,
    ear: 0.65,
    tail: 0.8,
    feature: "donkey",
  },
  hippopotamus_amphibius: {
    color: "#9a9095",
    height: 0.8,
    leg: 0.37,
    snout: 0.72,
    ear: 0.13,
    tail: 0.25,
    feature: "hippo",
  },
  balaenoptera_musculus: {
    kind: "marine",
    color: "#779ca8",
    belly: "#b8d5d7",
    length: 2.7,
    feature: "bluewhale",
  },
  megaptera_novaeangliae: {
    kind: "marine",
    color: "#4b6572",
    belly: "#dde6dd",
    length: 2.5,
    feature: "humpback",
  },
  orcinus_orca: {
    kind: "marine",
    color: "#253337",
    belly: "#f4f4e9",
    length: 2.2,
    feature: "orca",
  },
  tursiops_truncatus: {
    kind: "marine",
    color: "#799da7",
    belly: "#c6dddc",
    length: 2.2,
    snout: 0.55,
    feature: "dolphin",
  },
  macropus_rufus: {
    color: "#bc8859",
    height: 0.65,
    leg: 1.1,
    length: 1.3,
    neck: 0.55,
    ear: 0.5,
    tail: 1.8,
    feature: "kangaroo",
  },
  macaca_mulatta: {
    kind: "primate",
    color: "#a99272",
    belly: "#d6b3a4",
    tail: 1.4,
    feature: "macaque",
  },
  pongo_pygmaeus: {
    kind: "primate",
    color: "#bb682d",
    belly: "#6b5044",
    tail: 0,
    feature: "orangutan",
  },
  castor_canadensis: {
    color: "#8f613e",
    height: 0.59,
    leg: 0.32,
    snout: 0.25,
    ear: 0.14,
    tail: 1.05,
    feature: "beaver",
  },
  cavia_porcellus: {
    color: "#b48b61",
    height: 0.5,
    leg: 0.19,
    snout: 0.2,
    ear: 0.18,
    tail: 0,
    feature: "guineapig",
  },
  hydrochoerus_hydrochaeris: {
    color: "#a78b62",
    height: 0.62,
    leg: 0.43,
    snout: 0.48,
    ear: 0.17,
    tail: 0,
    feature: "capybara",
  },
  boa_constrictor: {
    kind: "snake",
    ear: 0,
    color: "#a6906a",
    pattern: "patches",
    feature: "boa",
  },
  python_molurus: {
    kind: "snake",
    ear: 0,
    color: "#b5a080",
    pattern: "patches",
    feature: "python",
  },
  trachemys_scripta: {
    kind: "turtle",
    ear: 0,
    leg: 0.22,
    height: 0.32,
    color: "#527856",
    feature: "slider",
  },
};
const birds: Record<string, [string, string, string, number, number?]> = {
  alauda_arvensis: ["#a58b65", "#e2ceb0", "lark", 0.25],
  anas_platyrhynchos: ["#837364", "#e2dfcb", "mallard", 0.45],
  anser_anser: ["#aaa79a", "#e8e7da", "goose", 0.48, 0.55],
  aptenodytes_patagonicus: ["#344653", "#f7f2d9", "kingpenguin", 0.4],
  apus_apus: ["#514f46", "#777267", "swift", 0.15],
  aquila_chrysaetos: ["#6a4e32", "#b69a64", "eagle", 0.34],
  ara_macao: ["#d73c30", "#ed6241", "macaw", 0.42],
  ardea_cinerea: ["#a9b9bb", "#e9ece1", "heron", 0.85, 1.05],
  bubo_virginianus: ["#9a8058", "#d8c9a0", "owl", 0.2],
  cardinalis_cardinalis: ["#d44239", "#e26052", "cardinal", 0.24],
  columba_palumbus: ["#9da9b5", "#bdb1b1", "pigeon", 0.25],
  corvus_corone: ["#303b40", "#465053", "crow", 0.4],
  corvus_frugilegus: ["#303943", "#4b5157", "rook", 0.44],
  diomedea_exulans: ["#ecebdf", "#f9f7e9", "albatross", 0.56],
  dromaius_novaehollandiae: ["#786b56", "#9c9179", "emu", 0.37, 1.2],
  falco_peregrinus: ["#718b99", "#e5dfc9", "falcon", 0.25],
  gallus_gallus: ["#9b522e", "#806243", "rooster", 0.26],
  haematopus_ostralegus: ["#293b3f", "#f4f0df", "oystercatcher", 0.65],
  haliaeetus_leucocephalus: ["#564b35", "#958669", "baldeagle", 0.36],
  hirundo_rustica: ["#324c65", "#e2c8a5", "swallow", 0.17],
  larus_argentatus: ["#a5b7be", "#f5f3e8", "gull", 0.42],
  larus_ridibundus: ["#b4c1c5", "#f4f0e5", "blackheadedgull", 0.35],
  pelecanus_occidentalis: ["#9a9a88", "#e1d9bf", "pelican", 1],
  phalacrocorax_carbo: ["#354647", "#60746b", "cormorant", 0.5, 0.48],
  pygoscelis_papua: ["#2d4149", "#f3f1df", "gentoo", 0.33],
  somateria_mollissima: ["#333d3f", "#f0edde", "eider", 0.38],
  spheniscus_demersus: ["#34454a", "#f5f2df", "africanpenguin", 0.32],
  sterna_hirundo: ["#bac9d0", "#f6f4e7", "tern", 0.4],
  struthio_camelus: ["#3b3c37", "#ebe7d7", "ostrich", 0.4, 1.3],
  sturnus_vulgaris: ["#374b4a", "#657273", "starling", 0.3],
  vanellus_vanellus: ["#3a6262", "#efede2", "lapwing", 0.24],
};
for (const [id, [color, belly, feature, snout, neck = 0]] of Object.entries(
  birds,
))
  profiles[id] = {
    kind:
      feature.includes("penguin") || ["gentoo"].includes(feature)
        ? "penguin"
        : "bird",
    color,
    belly,
    feature,
    snout,
    neck,
    length: 1.1,
    height: 0.7,
    leg: ["heron", "emu", "ostrich"].includes(feature) ? 1.2 : 0.42,
    ear: 0,
    tail: 0.5,
  };
for (const id of Object.keys(profiles))
  if (
    id.startsWith("ursus_") ||
    ["helarctos_malayanus", "tremarctos_ornatus"].includes(id)
  )
    profiles[id] = {
      length: 2.05,
      height: 0.73,
      leg: 0.65,
      snout: 0.43,
      ear: 0.24,
      tail: 0.12,
      ...profiles[id],
    };
for (const p of Object.values(profiles))
  if (p.feature?.includes("bear") && !["polarbear"].includes(p.feature))
    p.belly = p.color;
export const modelSpecies = Object.keys(profiles);
const sphere = new T.SphereGeometry(1, 16, 10);
const materials = new Map<string, T.MeshStandardMaterial>();
function mat(color: string) {
  let m = materials.get(color);
  if (!m) {
    m = new T.MeshStandardMaterial({ color, roughness: 0.83 });
    materials.set(color, m);
  }
  return m;
}
function ell(
  parent: T.Object3D,
  color: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const m = new T.Mesh(sphere, mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
function cone(
  parent: T.Object3D,
  color: string,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  rotation = 0,
) {
  const m = new T.Mesh(new T.ConeGeometry(r, h, 12), mat(color));
  m.position.set(x, y, z);
  m.rotation.z = rotation;
  parent.add(m);
  return m;
}
function segment(
  parent: T.Object3D,
  color: string,
  a: T.Vector3,
  b: T.Vector3,
  r: number,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(r * 0.82, r, a.distanceTo(b), 12),
    mat(color),
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  parent.add(mesh);
  return mesh;
}
function tube(
  parent: T.Object3D,
  color: string,
  points: number[][],
  r: number,
) {
  const curve = new T.CatmullRomCurve3(
    points.map((p) => new T.Vector3(...(p as [number, number, number]))),
  );
  const m = new T.Mesh(new T.TubeGeometry(curve, 28, r, 10, false), mat(color));
  parent.add(m);
  return m;
}
function profile(id: string): Profile {
  return { ...base, ...profiles[id] };
}
function pattern(
  parent: T.Object3D,
  p: Profile,
  rx: number,
  ry: number,
  rz: number,
) {
  if (!p.pattern) return;
  const surface = parent.children.find(
    (child) => child instanceof T.Mesh && child.geometry === sphere,
  ) as T.Mesh | undefined;
  if (
    surface &&
    (p.pattern === "stripes" ||
      p.pattern === "spots" ||
      p.pattern === "patches")
  ) {
    const key = `coat:${p.feature}:${p.color}`;
    let material = materials.get(key);
    if (!material) {
      const width = 512,
        height = 256,
        pixels = new Uint8Array(width * height * 4);
      const light = new T.Color(p.color).getHex(),
        dark = new T.Color(
          p.feature === "zebra" ? "#293235" : "#4b3b29",
        ).getHex();
      for (let row = 0; row < height; row++)
        for (let col = 0; col < width; col++) {
          const phi = (col / width) * Math.PI * 2,
            theta = (1 - row / height) * Math.PI;
          const x = -Math.cos(phi) * Math.sin(theta),
            y = Math.cos(theta),
            z = Math.sin(phi) * Math.sin(theta);
          let marked = false;
          if (p.pattern === "stripes")
            marked = Math.sin(x * 29 + Math.sin(y * 9 + z * 5) * 1.4) > 0.48;
          else if (p.pattern === "spots")
            marked =
              Math.sin(x * 35 + y * 13) * Math.sin(z * 30 - y * 21) > 0.57;
          else {
            const u = (col / width) * 10 + Math.sin((row / height) * 21) * 0.15;
            const v = (row / height) * 6 + Math.sin((col / width) * 34) * 0.12;
            const dx = u - Math.floor(u),
              dy = v - Math.floor(v);
            marked = Math.min(dx, 1 - dx, dy, 1 - dy) > 0.065;
          }
          const color = marked ? dark : light,
            index = (row * width + col) * 4;
          pixels[index] = color >> 16;
          pixels[index + 1] = (color >> 8) & 255;
          pixels[index + 2] = color & 255;
          pixels[index + 3] = 255;
        }
      const texture = new T.DataTexture(pixels, width, height);
      texture.colorSpace = T.SRGBColorSpace;
      texture.magFilter = T.LinearFilter;
      texture.minFilter = T.LinearFilter;
      texture.needsUpdate = true;
      material = new T.MeshStandardMaterial({ map: texture, roughness: 0.84 });
      materials.set(key, material);
    }
    surface.material = material;
    return;
  }
  for (let i = 0; i < 36; i++) {
    const a = i * 2.39996,
      y = (i / 35) * 1.7 - 0.85,
      ring = Math.sqrt(1 - y * y),
      x = Math.cos(a) * ring,
      z = Math.sin(a) * ring;
    const patch = new T.Mesh(
      new T.TorusGeometry(0.075, 0.014, 5, 12),
      mat("#493c2b"),
    );
    patch.position.set(x * rx, y * ry, z * rz);
    patch.quaternion.setFromUnitVectors(
      new T.Vector3(0, 0, 1),
      new T.Vector3(x, y, z).normalize(),
    );
    parent.add(patch);
  }
}
type Joint = {
  group: T.Group;
  rest: number;
  phase: number;
  knee?: T.Group;
};
export type Rig = {
  root: T.Group;
  head: T.Group;
  eyes: T.Group[];
  legs: Joint[];
  tails: T.Group[];
  wings: T.Group[];
  trunk: T.Group[];
  body: T.Group;
  kind: Kind;
  phase: number;
  hover: boolean;
  owned: T.BufferGeometry[];
  ownedMaterials: T.Material[];
};
function makeHead(p: Profile) {
  const head = new T.Group(),
    eyes: T.Group[] = [],
    trunk: T.Group[] = [];
  const bird = p.kind === "bird" || p.kind === "penguin",
    marine = p.kind === "marine",
    reptile = p.kind === "reptile" || p.kind === "snake";
  const f = p.feature;
  const color =
    f === "baldeagle" || f === "opossum"
      ? "#f2efdf"
      : f === "mallard"
        ? "#2b785a"
        : f === "blackheadedgull"
          ? "#574c3d"
          : p.color;
  ell(head, color, 0, 0, 0, 0.43, bird ? 0.4 : 0.36, 0.32);
  if (p.kind === "primate") {
    ell(head, p.belly, 0.25, -0.02, 0.02, 0.29, 0.3, 0.3);
    ell(head, p.belly, 0.39, -0.16, 0, 0.2, 0.14, 0.24);
  } else if (bird) {
    const billColor = [
      "oystercatcher",
      "tern",
      "gentoo",
      "kingpenguin",
      "cardinal",
    ].includes(f || "")
      ? "#e38039"
      : ["crow", "rook", "swift", "swallow", "emu", "ostrich"].includes(f || "")
        ? "#44403a"
        : "#dcb25b";
    const beak = cone(
      head,
      billColor,
      0.35 + p.snout * 0.4,
      -0.05,
      0,
      0.13,
      p.snout,
      -Math.PI / 2,
    );
    beak.scale.z = 0.72;
    if (["eagle", "baldeagle", "falcon", "macaw", "owl"].includes(f || "")) {
      ell(head, billColor, 0.59, -0.13, 0, 0.09, 0.16, 0.09);
    }
    if (f === "pelican") ell(head, "#c7aa6f", 0.62, -0.19, 0, 0.45, 0.18, 0.12);
  } else if (marine) {
    ell(head, p.color, 0.22, -0.04, 0, p.snout, 0.2, 0.27);
  } else {
    const bill = f === "platypus",
      wide = f === "hippo" || f === "rhino";
    const muzzle = [
      "fox",
      "wolf",
      "lion",
      "tiger",
      "leopard",
      "cheetah",
    ].includes(f || "")
      ? p.belly
      : f === "opossum"
        ? "#f1edde"
        : p.color;
    ell(
      head,
      bill ? "#687a7e" : muzzle,
      0.25 + p.snout * 0.32,
      -0.11,
      0,
      p.snout * 0.72,
      bill ? 0.085 : wide ? 0.24 : 0.14,
      bill ? 0.34 : wide ? 0.36 : 0.19,
    );
    ell(
      head,
      bill ? "#637578" : muzzle,
      0.35 + p.snout * 0.59,
      -0.12,
      0,
      p.snout * 0.3,
      bill ? 0.075 : wide ? 0.2 : 0.1,
      bill ? 0.29 : wide ? 0.3 : 0.115,
    );
    ell(
      head,
      f === "opossum" ? "#d9a29f" : bill ? "#637578" : "#343b37",
      0.4 + p.snout * 0.72,
      -0.09,
      0,
      bill ? 0.12 : 0.065,
      0.047,
      bill ? 0.25 : wide ? 0.12 : 0.067,
    );
  }
  for (const side of [-1, 1]) {
    const eye = new T.Group();
    eye.position.set(0.22, 0.1, side * 0.315);
    head.add(eye);
    ell(eye, "#f7f6e9", 0, 0, 0, 0.102, 0.109, 0.06);
    ell(eye, "#4b3424", 0.035, 0, side * 0.065, 0.063, 0.075, 0.028);
    ell(eye, "#1d282a", 0.044, 0, side * 0.084, 0.038, 0.053, 0.017);
    ell(eye, "#ffffff", 0.057, 0.039, side * 0.099, 0.019, 0.026, 0.012);
    eyes.push(eye);
    if (p.ear) {
      if (["fox", "wolf", "donkey", "zebra", "kangaroo"].includes(f || "")) {
        cone(
          head,
          p.color,
          -0.13,
          0.47,
          side * 0.25,
          p.ear * 0.43,
          p.ear * 1.7,
          side * 0.1,
        );
        cone(
          head,
          "#d7ad9c",
          -0.08,
          0.48,
          side * 0.26,
          p.ear * 0.25,
          p.ear * 1.25,
          side * 0.1,
        );
      } else {
        ell(
          head,
          ["panda", "opossum"].includes(f || "") ? "#303536" : p.color,
          -0.1,
          0.35,
          side * 0.35,
          p.ear,
          p.ear,
          p.ear * 0.44,
        );
        ell(
          head,
          "#b89886",
          -0.08,
          0.36,
          side * (0.35 + p.ear * 0.28),
          p.ear * 0.6,
          p.ear * 0.64,
          p.ear * 0.17,
        );
      }
    }
    if (f === "elephant") {
      ell(head, p.color, -0.15, -0.02, side * 0.54, 0.25, 0.63, 0.12);
      tube(
        head,
        "#f1e4c6",
        [
          [0.25, -0.23, side * 0.25],
          [0.5, -0.4, side * 0.27],
          [0.75, -0.25, side * 0.28],
        ],
        0.055,
      );
    }
    if (f === "panda")
      ell(head, "#303536", 0.16, 0.04, side * 0.34, 0.18, 0.22, 0.025);
    if (f === "spectacledbear")
      tube(
        head,
        "#d8c8a3",
        [
          [0.3, 0.25, side * 0.32],
          [0.12, 0.3, side * 0.34],
          [0.02, 0.1, side * 0.37],
          [0.2, -0.1, side * 0.35],
        ],
        0.045,
      );
    if (f === "cheetah")
      tube(
        head,
        "#423c31",
        [
          [0.29, 0.02, side * 0.31],
          [0.32, -0.13, side * 0.28],
        ],
        0.018,
      );
    if (f === "owl") {
      ell(head, "#d6c29a", 0.15, 0.02, side * 0.2, 0.19, 0.28, 0.11);
      cone(head, p.color, -0.1, 0.47, side * 0.28, 0.1, 0.35, side * 0.3);
    }
  }
  // Place eye patches beneath the eyes rather than covering their expression.
  for (const eye of eyes) {
    head.remove(eye);
    head.add(eye);
  }
  if (f === "lion") {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      ell(
        head,
        "#86542c",
        -0.23,
        Math.cos(a) * 0.36,
        Math.sin(a) * 0.4,
        0.27,
        0.22,
        0.21,
      );
    }
  }
  if (f === "giraffe") {
    for (const side of [-1, 1]) {
      segment(
        head,
        "#b59860",
        new T.Vector3(-0.13, 0.3, side * 0.16),
        new T.Vector3(-0.17, 0.68, side * 0.17),
        0.06,
      );
      ell(head, "#69513a", -0.17, 0.69, side * 0.17, 0.085, 0.08, 0.08);
    }
  }
  if (f === "rhino") {
    cone(head, "#d9d2b7", 0.58, 0.27, 0, 0.13, 0.55, -0.25);
    cone(head, "#c4bba1", 0.2, 0.34, 0, 0.085, 0.26, -0.18);
  }
  if (f === "bison") {
    for (const side of [-1, 1])
      tube(
        head,
        "#ddd2b1",
        [
          [0, 0.16, side * 0.31],
          [-0.1, 0.33, side * 0.55],
          [0, 0.52, side * 0.58],
        ],
        0.065,
      );
  }
  if (f === "elephant") {
    let parent = head;
    for (let i = 0; i < 7; i++) {
      const g = new T.Group();
      g.position.set(i ? 0 : 0.38, i ? -0.15 : -0.17, 0);
      parent.add(g);
      ell(g, p.color, 0, -0.07, 0, 0.13 - i * 0.009, 0.13, 0.13 - i * 0.009);
      trunk.push(g);
      parent = g;
    }
  }
  if (["rooster", "cardinal", "lapwing"].includes(f || "")) {
    for (let i = 0; i < 4; i++)
      cone(
        head,
        f === "rooster" ? "#d54439" : p.color,
        -0.18 + i * 0.09,
        0.45 + i * 0.025,
        0,
        0.065,
        0.23,
        -0.3,
      );
  }
  if (p.pattern) pattern(head, p, 0.43, 0.4, 0.36);
  if (f === "orca") {
    for (const side of [-1, 1])
      ell(head, "#f4f4e9", -0.02, 0.14, side * 0.34, 0.21, 0.12, 0.028);
  }
  if (f === "mallard")
    tube(
      head,
      "#f2edde",
      [
        [-0.2, -0.26, -0.25],
        [0, -0.34, 0],
        [-0.2, -0.26, 0.25],
      ],
      0.055,
    );
  if (f === "kingpenguin") {
    for (const side of [-1, 1])
      ell(head, "#efb143", -0.05, -0.18, side * 0.32, 0.17, 0.16, 0.03);
  }
  if (f === "gentoo")
    tube(
      head,
      "#f7f1df",
      [
        [-0.08, 0.26, -0.28],
        [-0.17, 0.36, 0],
        [-0.08, 0.26, 0.28],
      ],
      0.085,
    );
  if (f === "africanpenguin") {
    for (const side of [-1, 1])
      tube(
        head,
        "#f5efdf",
        [
          [0.21, 0.22, side * 0.27],
          [-0.13, 0.23, side * 0.33],
          [-0.18, -0.1, side * 0.31],
          [0.13, -0.25, side * 0.27],
        ],
        0.045,
      );
  }
  if (f === "koala") ell(head, "#29363b", 0.35, -0.04, 0, 0.16, 0.24, 0.17);
  return { head, eyes, trunk };
}
// Merge static surfaces per material while retaining every articulated joint.
// This avoids hundreds of draw calls for fur markings and facial details.
function mergeStaticParts(parent: T.Object3D) {
  for (const child of [...parent.children])
    if (!(child instanceof T.Mesh)) mergeStaticParts(child);
  const buckets = new Map<T.Material, T.Mesh[]>();
  for (const child of parent.children)
    if (child instanceof T.Mesh && !Array.isArray(child.material)) {
      const list = buckets.get(child.material) || [];
      list.push(child);
      buckets.set(child.material, list);
    }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const copies = meshes.map((mesh) => {
      mesh.updateMatrix();
      return mesh.geometry.clone().applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(copies, false);
    copies.forEach((g) => g.dispose());
    if (!geometry) continue;
    for (const mesh of meshes) {
      parent.remove(mesh);
      if (mesh.geometry !== sphere) mesh.geometry.dispose();
    }
    parent.add(new T.Mesh(geometry, material));
  }
}
export function createAnimalRig(id: string, headId = id, baby = false): Rig {
  const p = profile(id),
    hp = profile(headId),
    root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const legs: Joint[] = [],
    tails: T.Group[] = [],
    wings: T.Group[] = [];
  let headPosition = new T.Vector3(
    p.length * 0.47,
    p.leg + p.height * 0.75 + p.neck,
    0,
  );
  const torso = new T.Group();
  torso.position.y = p.leg + p.height;
  body.add(torso);
  if (p.kind === "marine") {
    torso.position.y = 0.8;
    ell(torso, p.color, 0, 0, 0, p.length * 0.55, 0.48, 0.43);
    ell(torso, p.belly, 0.1, -0.22, 0.04, p.length * 0.43, 0.28, 0.39);
    headPosition.set(p.length * 0.43, 0.8, 0);
    for (const s of [-1, 1]) {
      const g = new T.Group();
      g.position.set(0.3, 0.55, s * 0.27);
      body.add(g);
      const fin = ell(
        g,
        p.color,
        -0.16,
        -0.15,
        s * 0.26,
        0.24,
        0.09,
        p.feature === "humpback" ? 0.65 : 0.42,
      );
      fin.rotation.x = s * 0.3;
      wings.push(g);
    }
    cone(
      torso,
      p.color,
      -0.1,
      0.48,
      0,
      0.24,
      p.feature === "orca" ? 0.7 : 0.4,
      0.35,
    );
  } else if (p.kind === "snake") {
    torso.position.y = 0.25;
    tube(
      torso,
      p.color,
      [
        [-1, 0, -0.3],
        [-0.6, 0, 0.65],
        [0.4, 0, 0.65],
        [0.75, 0, -0.3],
        [-0.2, 0, -0.55],
        [-0.6, 0.15, 0],
        [0.45, 0.3, 0.1],
      ],
      0.18,
    );
    headPosition.set(0.7, 0.6, 0.1);
  } else if (p.kind === "bird" || p.kind === "penguin") {
    ell(torso, p.color, 0, 0, 0, 0.5, p.kind === "penguin" ? 0.76 : 0.57, 0.36);
    ell(
      torso,
      p.belly,
      0.25,
      -0.06,
      0.06,
      0.34,
      p.kind === "penguin" ? 0.62 : 0.43,
      0.3,
    );
    headPosition.set(0.22, p.leg + p.height + 0.6 + p.neck, 0);
    if (p.neck)
      tube(
        body,
        p.color,
        [
          [0, p.leg + p.height, 0],
          [0.05, p.leg + p.height + 0.5, 0],
          [0.22, headPosition.y, 0],
        ],
        0.13,
      );
    for (const s of [-1, 1]) {
      const g = new T.Group();
      g.position.set(0, p.leg + p.height + 0.2, s * 0.3);
      body.add(g);
      ell(
        g,
        p.feature === "macaw" ? "#2b89b3" : p.color,
        -0.14,
        -0.15,
        s * 0.1,
        0.46,
        0.36,
        0.085,
      );
      for (let i = 0; i < 5; i++) {
        const feather = ell(
          g,
          p.feature === "macaw" ? (i < 2 ? "#e3b840" : "#337bb3") : p.color,
          -0.33 - i * 0.045,
          -0.3 - i * 0.06,
          s * 0.11,
          0.25,
          0.22,
          0.025,
        );
        feather.rotation.z = -0.45;
      }
      wings.push(g);
    }
  } else if (p.kind === "primate") {
    ell(torso, p.color, 0, 0.2, 0, 0.52, 0.8, 0.42);
    ell(torso, p.belly, 0.27, 0.14, 0, 0.27, 0.51, 0.35);
    headPosition.set(0.1, p.leg + p.height + 1, 0);
  } else {
    ell(torso, p.color, 0, 0, 0, p.length * 0.55, p.height, 0.42);
    ell(
      torso,
      p.belly,
      0.05,
      -p.height * 0.62,
      0,
      p.length * 0.39,
      p.height * 0.28,
      0.33,
    );
    if (p.feature === "sunbear")
      ell(torso, "#d8ac63", p.length * 0.43, 0.0, 0.1, 0.055, 0.25, 0.28);
    if (["moonbear", "slothbear"].includes(p.feature || ""))
      tube(
        torso,
        "#dfd2b0",
        [
          [p.length * 0.4, 0.25, -0.28],
          [p.length * 0.48, -0.05, 0],
          [p.length * 0.4, 0.25, 0.28],
        ],
        0.055,
      );
    if (p.feature === "panda")
      ell(torso, "#303536", 0.48, 0, 0, 0.36, p.height * 0.95, 0.435);
    pattern(torso, p, p.length * 0.55, p.height, 0.43);
    if (p.neck)
      tube(
        body,
        p.color,
        [
          [p.length * 0.28, p.leg + p.height, 0],
          [p.length * 0.42, p.leg + p.height + p.neck * 0.6, 0],
          headPosition.toArray(),
        ],
        0.21,
      );
    if (p.kind === "turtle") {
      ell(torso, "#385c40", 0, 0.16, 0, 0.94, 0.61, 0.65);
      for (let i = 0; i < 9; i++)
        ell(
          torso,
          "#779354",
          Math.cos(i) * 0.6,
          0.6,
          Math.sin(i) * 0.4,
          0.19,
          0.05,
          0.19,
        );
    }
    if (p.feature === "bison")
      ell(torso, "#4d3c2a", 0.35, 0.37, 0, 0.63, 0.7, 0.46);
    if (p.feature === "hedgehog") {
      for (let i = 0; i < 85; i++) {
        const a = i * 2.399;
        const x = Math.cos(a) * 0.83,
          z = Math.sin(a) * 0.4;
        const y =
          Math.sqrt(Math.max(0, 1 - (x * x) / 0.8 - (z * z) / 0.2)) * 0.4;
        cone(
          torso,
          i % 2 ? "#6b5138" : "#d2c39c",
          x,
          y + 0.2,
          z,
          0.045,
          0.28,
          -x * 0.5,
        );
      }
    }
  }
  if (!["marine", "snake"].includes(p.kind)) {
    const count = p.kind === "bird" || p.kind === "penguin" ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const s = i % 2 ? 1 : -1,
        front = i < 2;
      const g = new T.Group();
      g.position.set(
        p.kind === "primate"
          ? front
            ? 0.18
            : -0.05
          : count === 2
            ? 0
            : front
              ? p.length * 0.32
              : -p.length * 0.32,
        p.kind === "primate" && front
          ? p.leg + p.height + 0.58
          : p.leg + p.height * 0.35,
        s * (p.kind === "primate" ? 0.42 : count === 2 ? 0.2 : 0.29),
      );
      body.add(g);
      const legLength =
        p.feature === "kangaroo" && front
          ? 0.48
          : p.kind === "primate" && front
            ? p.leg + p.height + 0.43
            : p.leg;
      const color =
        p.feature === "panda" || p.feature === "fox"
          ? "#343731"
          : p.kind === "bird"
            ? "#be9a64"
            : p.color;
      const upper = legLength * 0.5;
      ell(
        g,
        color,
        0,
        -upper * 0.5,
        0,
        p.kind === "primate" ? 0.15 : 0.16,
        upper * 0.62,
        0.16,
      );
      const knee = new T.Group();
      knee.position.y = -upper;
      g.add(knee);
      ell(knee, color, 0, -legLength * 0.25, 0, 0.12, legLength * 0.32, 0.12);
      ell(
        knee,
        p.feature === "zebra" || p.feature === "donkey" ? "#4d4841" : color,
        0.09,
        -legLength * 0.5,
        0,
        p.feature === "kangaroo" && !front ? 0.36 : 0.2,
        0.085,
        0.15,
      );
      if (count === 2) {
        for (let j = -1; j <= 1; j++)
          tube(
            knee,
            "#b99a66",
            [
              [0.05, -legLength * 0.5, 0],
              [0.26, -legLength * 0.5, j * 0.11],
            ],
            0.025,
          );
      }
      legs.push({
        group: g,
        rest: 0,
        phase: front ? (s === 1 ? 0 : Math.PI) : s === 1 ? Math.PI : 0,
        knee,
      });
    }
  }
  if (p.tail && !["snake", "turtle"].includes(p.kind)) {
    let parent: T.Object3D = body;
    for (let i = 0; i < 5; i++) {
      const g = new T.Group();
      g.position.set(
        i ? -p.tail / 5 : -p.length * 0.48,
        i ? 0 : p.kind === "marine" ? 0.8 : p.leg + p.height * 0.8,
        0,
      );
      parent.add(g);
      if (p.kind === "marine" && i === 4) {
        for (const s of [-1, 1]) {
          const fluke = ell(g, p.color, -0.1, 0, s * 0.3, 0.32, 0.08, 0.4);
          fluke.rotation.y = s * 0.35;
        }
      } else if (["platypus", "beaver"].includes(p.feature || ""))
        ell(
          g,
          p.feature === "beaver" ? "#655344" : p.color,
          -p.tail / 10,
          0,
          0,
          p.tail / 6,
          0.055,
          0.22,
        );
      else {
        const color =
          p.feature === "opossum"
            ? "#cfa2a2"
            : p.feature === "fox" && i === 4
              ? "#f3eed8"
              : p.color;
        const radius =
          (p.feature === "fox"
            ? 0.18
            : p.feature === "treeshrew"
              ? 0.105
              : 0.075) *
          (1 - i * 0.14);
        segment(
          g,
          color,
          new T.Vector3(0, 0, 0),
          new T.Vector3(-p.tail / 5, 0, 0),
          radius,
        );
        ell(g, color, -p.tail / 5, 0, 0, radius, radius, radius);
      }
      tails.push(g);
      parent = g;
    }
  }
  const face = makeHead(hp);
  face.head.position.copy(headPosition);
  const hybrid = headId !== id;
  face.head.scale.setScalar(hybrid ? 0.85 : 1);
  if (baby) face.head.scale.multiplyScalar(1.15);
  body.add(face.head);
  const box = new T.Box3().setFromObject(root),
    size = box.getSize(new T.Vector3()),
    center = box.getCenter(new T.Vector3());
  const scale = 2.85 / Math.max(size.x, size.y, size.z);
  root.scale.setScalar(scale);
  body.position.sub(center);
  body.position.y += size.y / 2;
  root.position.y = -1.4;
  mergeStaticParts(root);
  const owned: T.BufferGeometry[] = [];
  root.traverse((o) => {
    if (o instanceof T.Mesh && o.geometry !== sphere) owned.push(o.geometry);
  });
  const shared = new Set(materials.values()),
    ownedMaterials: T.Material[] = [];
  root.traverse((object) => {
    if (
      object instanceof T.Mesh &&
      !Array.isArray(object.material) &&
      !shared.has(object.material as T.MeshStandardMaterial)
    )
      ownedMaterials.push(object.material);
  });
  return {
    root,
    head: face.head,
    eyes: face.eyes,
    legs,
    tails,
    wings,
    trunk: face.trunk,
    body,
    kind: p.kind,
    phase: ((id.length * 19 + id.charCodeAt(2)) * 0.61) % (Math.PI * 2),
    hover: false,
    owned,
    ownedMaterials,
  };
}
export function animateRig(rig: Rig, time: number, paused: boolean) {
  const t = paused ? 0 : time + rig.phase;
  const gait = paused ? 0 : Math.sin(t * 0.65) > 0.35 ? 1 : 0;
  rig.root.rotation.y = Math.sin(t * 0.38) * 0.1;
  rig.head.rotation.y = rig.hover ? -0.38 : Math.sin(t * 0.8) * 0.2;
  rig.head.rotation.z = rig.hover ? 0.09 : Math.sin(t * 0.7) * 0.045;
  const blink = paused ? 1 : t % 4.7 < 0.13 ? 0.09 : 1;
  for (const eye of rig.eyes) eye.scale.y = blink;
  for (const leg of rig.legs) {
    leg.group.rotation.z = gait * Math.sin(t * 4 + leg.phase) * 0.29;
    leg.knee!.rotation.z =
      gait * Math.max(0, Math.cos(t * 4 + leg.phase)) * 0.4;
  }
  rig.tails.forEach((tail, i) => {
    tail.rotation.y = Math.sin(t * 2 - i * 0.5) * 0.17;
    tail.rotation.z =
      rig.kind === "marine"
        ? Math.sin(t * 2 - i * 0.4) * 0.18
        : Math.sin(t * 1.3 - i * 0.4) * 0.055;
  });
  rig.wings.forEach((wing, i) => {
    wing.rotation.x =
      Math.sin(t * 1.6 + i * Math.PI) * (rig.kind === "marine" ? 0.1 : 0.18);
  });
  rig.trunk.forEach((joint, i) => {
    joint.rotation.z = Math.sin(t * 1.1 - i * 0.3) * 0.09;
  });
}
type Entry = {
  canvas: HTMLCanvasElement;
  rig: Rig;
  scene: T.Scene;
  camera: T.OrthographicCamera;
  last: number;
};
const entries = new Set<Entry>();
let renderer: T.WebGLRenderer | undefined,
  frame = 0,
  lastFrame = 0;
function tick(now: number) {
  frame = requestAnimationFrame(tick);
  if (now - lastFrame < 50) return;
  lastFrame = now;
  if (!renderer) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const entry of entries) {
    const rect = entry.canvas.getBoundingClientRect();
    if (!rect.width) continue;
    if (
      entry.canvas.dataset.renderReady === "true" &&
      (rect.bottom < 0 ||
        rect.top > innerHeight ||
        getComputedStyle(entry.canvas).visibility === "hidden")
    )
      continue;
    const paused = reduced || !!entry.canvas.closest('[data-motion="paused"]');
    rigHover(entry);
    const frozen = paused ? (entry.rig.hover ? 2 : 1) : 0;
    if (frozen && entry.last === frozen) continue;
    entry.last = frozen;
    animateRig(entry.rig, paused ? 0 : now / 1000, paused);
    renderer.render(entry.scene, entry.camera);
    const ctx = entry.canvas.getContext("2d");
    ctx?.clearRect(0, 0, 360, 320);
    ctx?.drawImage(renderer.domElement, 0, 0, 360, 320);
    entry.canvas.dataset.renderReady = "true";
  }
}
function rigHover(entry: Entry) {
  entry.rig.hover = !!entry.canvas.closest("button")?.matches(":hover");
}
export function mountAnimal(
  canvas: HTMLCanvasElement,
  id: string,
  headId: string,
  baby: boolean,
) {
  canvas.dataset.renderReady = "false";
  if (!renderer) {
    renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(360, 320, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
  }
  const rig = createAnimalRig(id, headId, baby),
    scene = new T.Scene();
  scene.add(rig.root);
  scene.add(new T.HemisphereLight("#fff7e9", "#7c9688", 1.9));
  const key = new T.DirectionalLight("#ffffff", 2);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new T.DirectionalLight("#ffe6b9", 0.8);
  rim.position.set(-3, 3, -3);
  scene.add(rim);
  const shadow = ell(scene, "#748b74", 0, -1.4, 0, 0.96, 0.008, 0.36);
  (shadow.material as T.MeshStandardMaterial) = new T.MeshStandardMaterial({
    color: "#627460",
    transparent: true,
    opacity: 0.16,
  });
  const camera = new T.OrthographicCamera(-1.9, 1.9, 1.7, -1.7, 0.1, 50);
  camera.position.set(4, 2.7, 7);
  const bounds = new T.Box3().setFromObject(rig.root),
    center = bounds.getCenter(new T.Vector3());
  camera.position.copy(center).add(new T.Vector3(4, 2.7, 7));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const projected: T.Vector3[] = [];
  rig.root.updateMatrixWorld(true);
  rig.root.traverse((object) => {
    if (object instanceof T.Mesh) {
      const positions = object.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++)
        projected.push(
          new T.Vector3()
            .fromBufferAttribute(positions, i)
            .applyMatrix4(object.matrixWorld)
            .project(camera),
        );
    }
  });
  const minX = projected.reduce((min, v) => Math.min(min, v.x), Infinity),
    maxX = projected.reduce((max, v) => Math.max(max, v.x), -Infinity),
    minY = projected.reduce((min, v) => Math.min(min, v.y), Infinity),
    maxY = projected.reduce((max, v) => Math.max(max, v.y), -Infinity);
  camera.zoom = Math.min(1.58 / (maxX - minX), 1.775 / (maxY - minY));
  camera.updateProjectionMatrix();
  // Set the camera plane so feet sit on one common ground line, with identical
  // maximum visual size independent of real-world animal measurements.
  const right = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
    up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const offset = right
    .multiplyScalar((minX + maxX) * 0.5 * 1.9)
    .add(up.multiplyScalar(((minY * camera.zoom + 0.81) * 1.7) / camera.zoom));
  camera.position.add(offset);
  camera.updateMatrixWorld();
  const entry = { canvas, rig, scene, camera, last: 0 };
  entries.add(entry);
  if (!frame) frame = requestAnimationFrame(tick);
  return () => {
    entries.delete(entry);
    rig.owned.forEach((g) => g.dispose());
    rig.ownedMaterials.forEach((m) => m.dispose());
    (shadow.material as T.Material).dispose();
    if (!entries.size) {
      cancelAnimationFrame(frame);
      frame = 0;
      renderer?.dispose();
      renderer = undefined;
    }
  };
}
