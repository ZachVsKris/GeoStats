import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
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
    height: 0.46,
    leg: 0.48,
    snout: 0.57,
    ear: 0.2,
    tail: 1.65,
    feature: "opossum",
  },
  tupaia_glis: {
    color: "#946a44",
    belly: "#d1a074",
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
for (const p of Object.values(profiles))
  if (p.kind === "penguin") {
    p.leg = 0.2;
    p.height = 0.73;
  }
export const modelSpecies = Object.keys(profiles);
const sphere = new T.SphereGeometry(1, 20, 12);
const materials = new Map<string, T.MeshStandardMaterial>();
function mat(color: string) {
  let m = materials.get(color);
  if (!m) {
    m = new T.MeshStandardMaterial({ color, roughness: 0.72 });
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
  const m = new T.Mesh(new T.TubeGeometry(curve, 12, r, 6, false), mat(color));
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
  pupils: T.Group[];
  ears: T.Group[];
  legs: Joint[];
  tails: T.Object3D[];
  wings: T.Group[];
  trunk: T.Object3D[];
  body: T.Group;
  kind: Kind;
  phase: number;
  hover: boolean;
  owned: T.BufferGeometry[];
  ownedMaterials: T.Material[];
};
// Rounded leaf geometry gives ears, feathers and webbing authored silhouettes,
// rather than cones or identical disks on every species.
function leaf(
  parent: T.Object3D,
  color: string,
  width: number,
  height: number,
  depth = 0.045,
) {
  const shape = new T.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.bezierCurveTo(
    -width * 0.64,
    height * 0.36,
    -width * 0.2,
    height * 0.91,
    0,
    height,
  );
  shape.bezierCurveTo(
    width * 0.2,
    height * 0.91,
    width * 0.64,
    height * 0.36,
    width * 0.5,
    0,
  );
  shape.quadraticCurveTo(0, -height * 0.12, -width * 0.5, 0);
  const mesh = new T.Mesh(
    new T.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.022,
      curveSegments: 6,
    }),
    mat(color),
  );
  parent.add(mesh);
  return mesh;
}
function smile(head: T.Object3D, p: Profile, x: number, width = 0.18) {
  for (const side of [-1, 1])
    tube(
      head,
      "#4d3930",
      [
        [x, -0.14, side * 0.11],
        [x - 0.05, -0.19, side * 0.16],
        [x - width, -0.17, side * 0.19],
      ],
      0.012,
    );
}
// Selected body parents are represented as females in the breeding scene.
// Keep recognizable species marks while respecting obvious sexual dimorphism.
function sexProfile(p: Profile, female: boolean): Profile {
  if (!female) return p;
  if (["mallard", "eider", "rooster"].includes(p.feature || ""))
    return { ...p, color: "#9e7a50", belly: "#d4bea0" };
  if (p.feature === "cardinal")
    return { ...p, color: "#b19373", belly: "#d9c3a0" };
  return p;
}
function makeHead(p: Profile, juvenile = false, female = false) {
  const head = new T.Group(),
    eyes: T.Group[] = [],
    pupils: T.Group[] = [],
    ears: T.Group[] = [],
    trunk: T.Object3D[] = [];
  const f = p.feature || "",
    bird = ["bird", "penguin"].includes(p.kind),
    duck = ["mallard", "goose", "eider"].includes(f),
    cat = ["lion", "tiger", "leopard", "cheetah"].includes(f),
    bear = f.includes("bear") || f === "panda",
    canid = ["fox", "wolf"].includes(f),
    rodent = [
      "treeshrew",
      "beaver",
      "guineapig",
      "capybara",
      "opossum",
      "hedgehog",
    ].includes(f),
    reptile = ["reptile", "snake", "turtle"].includes(p.kind);
  const color =
    f === "baldeagle" || f === "opossum"
      ? "#fff4e1"
      : f === "mallard"
        ? female
          ? p.color
          : "#287d60"
        : f === "blackheadedgull"
          ? "#65503e"
          : p.color;
  const skull = ell(
    head,
    color,
    0,
    0,
    0,
    bear ? 0.5 : f === "hippo" ? 0.57 : 0.45,
    f === "platypus" ? 0.29 : reptile ? 0.26 : bird ? 0.4 : 0.4,
    f === "hippo" ? 0.42 : 0.36,
  );
  skull.name = "species-skull";
  if (p.pattern) pattern(head, p, 0.45, 0.4, 0.36);
  if (p.kind === "primate") {
    ell(head, p.belly, 0.3, -0.02, 0, 0.24, 0.29, 0.3);
    ell(head, p.belly, 0.43, -0.12, 0, 0.14, 0.11, 0.21);
    ell(head, "#493a32", 0.46, -0.05, 0, 0.035, 0.045, 0.08);
    smile(head, p, 0.47, 0.13);
    if (f === "gorilla") ell(head, p.color, 0.18, 0.24, 0, 0.28, 0.11, 0.34);
    if (f === "orangutan" && !juvenile && !female)
      for (const side of [-1, 1])
        ell(head, "#80563d", 0.12, -0.04, side * 0.28, 0.21, 0.31, 0.08);
  } else if (bird) {
    const billColor = [
      "oystercatcher",
      "tern",
      "gentoo",
      "kingpenguin",
      "cardinal",
    ].includes(f)
      ? "#ed973e"
      : ["crow", "rook", "swift", "swallow", "emu", "ostrich"].includes(f)
        ? "#47403b"
        : "#e8bb55";
    if (duck) {
      ell(head, billColor, 0.53, -0.09, 0, p.snout * 0.68, 0.085, 0.22);
      ell(head, "#775c32", 0.52, -0.13, 0, p.snout * 0.64, 0.025, 0.21);
      for (const side of [-1, 1])
        ell(head, "#795b35", 0.59, -0.024, side * 0.1, 0.025, 0.016, 0.02);
    } else if (["eagle", "baldeagle", "falcon", "macaw", "owl"].includes(f)) {
      tube(
        head,
        billColor,
        [
          [0.33, -0.015, 0],
          [0.52, -0.05, 0],
          [0.57, -0.16, 0],
        ],
        f === "macaw" ? 0.12 : 0.085,
      );
      ell(head, billColor, 0.44, -0.17, 0, 0.11, 0.065, 0.065);
    } else {
      const beak = cone(
        head,
        billColor,
        0.36 + p.snout * 0.4,
        -0.06,
        0,
        0.105,
        p.snout,
        -Math.PI / 2,
      );
      beak.scale.z = 0.75;
    }
    if (f === "pelican")
      ell(head, "#d7b470", 0.69, -0.18, 0, 0.48, 0.17, 0.115);
  } else if (p.kind === "marine") {
    ell(
      head,
      p.color,
      0.17,
      -0.025,
      0,
      f === "dolphin" ? 0.42 : 0.37,
      0.19,
      0.28,
    );
    if (f === "dolphin") ell(head, p.color, 0.5, -0.06, 0, 0.23, 0.095, 0.14);
    smile(head, p, f === "dolphin" ? 0.6 : 0.4, 0.15);
  } else if (f === "platypus") {
    const bill = ell(head, "#698b96", 0.47, -0.1, 0, 0.45, 0.085, 0.3);
    bill.name = "broad-flat-bill";
    ell(head, "#426a78", 0.47, -0.16, 0, 0.43, 0.025, 0.29);
    for (const side of [-1, 1])
      ell(head, "#344f59", 0.68, -0.03, side * 0.14, 0.024, 0.018, 0.019);
    tube(
      head,
      "#335d6b",
      [
        [0.69, -0.13, -0.22],
        [0.8, -0.12, 0],
        [0.69, -0.13, 0.22],
      ],
      0.012,
    );
  } else if (f === "elephant") {
    ell(head, p.color, 0.3, -0.06, 0, 0.24, 0.29, 0.27);
    for (const side of [-1, 1])
      tube(
        head,
        "#fff0cf",
        [
          [0.3, -0.22, side * 0.23],
          [0.47, -0.32, side * 0.28],
          [0.62, -0.19, side * 0.29],
        ],
        0.045,
      );
    // Short overlapping articulated sections keep the hanging trunk visible
    // at every head scale and preserve a smooth, tapered silhouette.
    let trunkParent: T.Object3D = head;
    for (let index = 0; index < 8; index++) {
      const joint = new T.Group();
      joint.position.set(index ? 0 : 0.4, index ? -0.12 : -0.13, 0);
      trunkParent.add(joint);
      const radius = 0.135 * (1 - index * 0.085);
      tube(joint, p.color, [[0, 0.025, 0], [0, -0.15, 0]], radius);
      ell(joint, p.color, 0, -0.12, 0, radius, radius, radius);
      trunk.push(joint);
      trunkParent = joint;
    }
  } else if (reptile) {
    const width =
      f === "alligator"
        ? 0.3
        : f === "crocodile"
          ? 0.19
          : f === "slider"
            ? 0.17
            : 0.22;
    ell(
      head,
      p.color,
      0.25 + p.snout * 0.28,
      -0.1,
      0,
      p.kind === "reptile" ? p.snout * 0.7 : 0.24,
      0.1,
      width,
    );
    ell(
      head,
      p.belly,
      0.35,
      -0.18,
      0,
      p.kind === "reptile" ? p.snout * 0.6 : 0.2,
      0.043,
      width * 0.9,
    );
    smile(head, p, p.kind === "reptile" ? p.snout * 0.75 : 0.42, 0.18);
    if (f === "slider")
      for (const side of [-1, 1])
        ell(head, "#d06543", -0.04, 0.02, side * 0.33, 0.1, 0.06, 0.02);
  } else {
    const pale =
      canid || cat || f === "panda"
        ? "#fff2d8"
        : f === "opossum"
          ? "#fff4e6"
          : bear
            ? new T.Color(p.color).lerp(new T.Color("#bf9670"), 0.35).getStyle()
            : p.color;
    if (cat || bear) {
      for (const side of [-1, 1])
        ell(head, pale, 0.39, -0.12, side * 0.1, 0.18, 0.15, 0.16);
    } else if (f === "hippo") {
      ell(head, p.color, 0.44, -0.09, 0, 0.42, 0.23, 0.38);
      for (const side of [-1, 1])
        ell(head, "#625c61", 0.67, 0.05, side * 0.21, 0.045, 0.028, 0.03);
    } else {
      ell(
        head,
        pale,
        0.29 + p.snout * 0.19,
        -0.1,
        0,
        p.snout * 0.65,
        0.145,
        rodent ? 0.15 : 0.19,
      );
      ell(
        head,
        pale,
        0.37 + p.snout * 0.47,
        -0.11,
        0,
        p.snout * 0.32,
        0.095,
        0.09,
      );
    }
    const noseX =
      cat || bear ? 0.56 : f === "hippo" ? 0.76 : 0.39 + p.snout * 0.68;
    if (f !== "hippo")
      ell(
        head,
        f === "opossum" ? "#f0a5a7" : cat ? "#b37b6b" : "#34383a",
        noseX,
        -0.075,
        0,
        0.072,
        0.052,
        0.083,
      );
    smile(head, p, noseX - 0.015, cat || bear ? 0.18 : 0.22);
    if (canid)
      for (const side of [-1, 1]) {
        ell(head, "#fff2da", 0.13, -0.15, side * 0.28, 0.26, 0.17, 0.09);
        for (let i = 0; i < 3; i++) {
          const tuft = leaf(head, "#fff2da", 0.09, 0.19, 0.025);
          tuft.position.set(-0.04 - i * 0.055, -0.12 - i * 0.032, side * 0.28);
          tuft.rotation.z = 0.7;
        }
      }
    if (cat || (rodent && f !== "treeshrew") || canid)
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++)
          tube(
            head,
            "#66564b",
            [
              [0.38, -0.12 - i * 0.03, side * 0.17],
              [0.34 - i * 0.045, -0.1 - i * 0.065, side * 0.29],
              [0.25 - i * 0.065, -0.065 - i * 0.08, side * 0.42],
            ],
            0.006,
          );
    if (f === "beaver") {
      for (const side of [-1, 1])
        ell(head, "#fff1c9", 0.56, -0.21, side * 0.04, 0.04, 0.08, 0.045);
    }
    if (f === "koala") ell(head, "#293d44", 0.37, -0.06, 0, 0.15, 0.22, 0.17);
  }
  // Eyes are embedded in the face, with a large colored iris and soft eyelids.
  for (const side of [-1, 1]) {
    const eye = new T.Group();
    eye.name = `eye-${side}`;
    eye.position.set(
      p.kind === "primate" || f === "owl" ? 0.37 : reptile ? 0.29 : 0.25,
      reptile ? 0.105 : 0.105,
      side *
        (f === "panda"
          ? 0.355
          : p.kind === "primate" || f === "owl"
            ? 0.22
            : 0.29),
    );
    eye.rotation.y = side * 0.35;
    head.add(eye);
    ell(eye, color, 0, 0, -side * 0.025, 0.154, 0.166, 0.055);
    ell(eye, "#fff9e9", 0, 0, 0, 0.125, 0.136, 0.047);
    const pupil = new T.Group();
    pupil.position.set(0.025, -0.004, side * 0.037);
    eye.add(pupil);
    ell(
      pupil,
      cat ? "#91a557" : bird ? "#856332" : "#694a2f",
      0,
      0,
      0,
      0.096,
      0.11,
      0.031,
    );
    ell(pupil, "#202e32", 0.007, 0, side * 0.022, 0.064, 0.083, 0.017);
    ell(pupil, "#fffdf1", 0.026, 0.046, side * 0.036, 0.028, 0.033, 0.012);
    ell(pupil, "#fffdf1", -0.035, -0.04, side * 0.036, 0.012, 0.016, 0.009);
    eyes.push(eye);
    pupils.push(pupil);
    tube(
      head,
      bear ? "#514239" : color,
      [
        [0.12, 0.27, side * 0.29],
        [0.26, 0.3, side * 0.28],
        [0.36, 0.255, side * 0.24],
      ],
      0.027,
    );
    if (p.ear && f !== "elephant" && p.kind !== "marine") {
      const ear = new T.Group();
      ear.name = `ear-${side}`;
      ear.position.set(-0.13, 0.29, side * 0.24);
      head.add(ear);
      ears.push(ear);
      if (
        ["fox", "wolf", "donkey", "zebra", "kangaroo", "giraffe"].includes(f)
      ) {
        const shape = leaf(
          ear,
          f === "fox" ? "#a64725" : p.color,
          p.ear * 0.72,
          p.ear * 1.45,
          0.06,
        );
        shape.rotation.z = f === "donkey" ? -0.12 : side * 0.15;
        const inner = leaf(ear, "#dfa697", p.ear * 0.4, p.ear * 1.01, 0.025);
        inner.position.set(0.005, 0.055, side * 0.065);
        inner.rotation.z = shape.rotation.z;
      } else {
        const fuzzy = f === "koala";
        ell(
          ear,
          f === "panda" || f === "opossum" ? "#343a39" : p.color,
          0,
          p.ear * 0.27,
          0,
          p.ear * 0.75,
          p.ear * 0.85,
          p.ear * 0.4,
        );
        ell(
          ear,
          fuzzy
            ? "#d9ded2"
            : f === "opossum"
              ? "#bba3a2"
              : bear
                ? "#826e5b"
                : "#d4ac93",
          0.015,
          p.ear * 0.28,
          side * p.ear * 0.24,
          p.ear * 0.45,
          p.ear * 0.54,
          p.ear * 0.19,
        );
        if (fuzzy)
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI;
            ell(
              ear,
              "#c9d2c8",
              Math.cos(a) * p.ear * 0.59,
              Math.sin(a) * p.ear * 0.64,
              0,
              0.075,
              0.085,
              0.065,
            );
          }
      }
    }
    if (f === "elephant") {
      const ear = new T.Group();
      ear.position.set(-0.23, 0.1, side * 0.29);
      ear.rotation.y = side * 0.35;
      head.add(ear);
      const outer = leaf(ear, p.color, 0.78, 1.1, 0.075);
      outer.position.set(0, -0.64, 0);
      outer.rotation.z = -0.25;
      const inner = leaf(ear, "#b6aaa0", 0.54, 0.77, 0.028);
      inner.position.set(0.02, -0.48, side * 0.06);
      inner.rotation.z = -0.25;
      ears.push(ear);
    }
    if (f === "panda")
      ell(head, "#343c3c", 0.17, 0.04, side * 0.32, 0.23, 0.26, 0.048);
    if (f === "spectacledbear")
      tube(
        head,
        "#e3d6b3",
        [
          [0.33, 0.24, side * 0.28],
          [0.12, 0.28, side * 0.32],
          [0.04, 0.04, side * 0.35],
          [0.21, -0.12, side * 0.29],
        ],
        0.032,
      );
    if (f === "cheetah")
      tube(
        head,
        "#43382e",
        [
          [0.32, 0.035, side * 0.28],
          [0.38, -0.14, side * 0.23],
        ],
        0.022,
      );
    if (f === "falcon")
      ell(head, "#344447", 0.19, -0.1, side * 0.32, 0.09, 0.19, 0.023);
    if (f === "owl") {
      ell(head, "#dbca9f", 0.17, 0.01, side * 0.24, 0.24, 0.29, 0.07);
      const tuft = leaf(head, p.color, 0.15, 0.32, 0.06);
      tuft.position.set(-0.13, 0.28, side * 0.26);
      tuft.rotation.z = side * 0.3;
    }
    if (f === "kingpenguin")
      ell(head, "#f0b745", -0.07, -0.15, side * 0.31, 0.15, 0.17, 0.025);
    if (f === "africanpenguin")
      tube(
        head,
        "#fff4e2",
        [
          [0.25, 0.24, side * 0.27],
          [-0.15, 0.26, side * 0.31],
          [-0.22, -0.03, side * 0.31],
          [0.15, -0.26, side * 0.26],
        ],
        0.036,
      );
  }
  if (f === "lion" && !juvenile && !female) {
    ell(head, "#9a592c", -0.18, -0.01, 0, 0.42, 0.58, 0.53);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2,
        tuft = leaf(head, i % 2 ? "#a66533" : "#8e4d29", 0.22, 0.33, 0.07);
      tuft.position.set(-0.2, Math.cos(a) * 0.36, Math.sin(a) * 0.41);
      tuft.rotation.x = a;
      tuft.rotation.z = -0.4;
    }
  }
  if (f === "giraffe")
    for (const side of [-1, 1]) {
      segment(
        head,
        "#c6a361",
        new T.Vector3(-0.13, 0.3, side * 0.14),
        new T.Vector3(-0.16, 0.6, side * 0.15),
        0.045,
      );
      ell(head, "#77563a", -0.16, 0.61, side * 0.15, 0.066, 0.075, 0.065);
    }
  if (f === "rhino") {
    cone(head, "#e3d8b9", 0.5, 0.2, 0, 0.115, 0.44, -0.35);
    cone(head, "#c8b99a", 0.16, 0.3, 0, 0.075, 0.23, -0.23);
  }
  if (f === "bison")
    for (const side of [-1, 1])
      tube(
        head,
        "#e8dabc",
        [
          [0, 0.11, side * 0.28],
          [-0.1, 0.28, side * 0.47],
          [0.02, 0.42, side * 0.49],
        ],
        0.055,
      );
  if (["rooster", "cardinal", "lapwing"].includes(f)) {
    const crest = leaf(
      head,
      f === "rooster" ? "#dd5146" : p.color,
      0.23,
      f === "lapwing" ? 0.42 : 0.28,
      0.05,
    );
    crest.position.set(-0.09, 0.28, 0);
    crest.rotation.z = -0.45;
  }
  if (f === "gentoo")
    tube(
      head,
      "#fff5e3",
      [
        [-0.06, 0.26, -0.29],
        [-0.17, 0.37, 0],
        [-0.06, 0.26, 0.29],
      ],
      0.055,
    );
  if (f === "mallard")
    tube(
      head,
      "#f3f0da",
      [
        [-0.16, -0.27, -0.24],
        [0, -0.35, 0],
        [-0.16, -0.27, 0.24],
      ],
      0.037,
    );
  if (f === "orca")
    for (const side of [-1, 1])
      ell(head, "#fff6e8", -0.06, 0.15, side * 0.33, 0.19, 0.11, 0.024);
  return { head, eyes, pupils, ears, trunk };
}

// A skinned tapered surface keeps tails and trunks continuous during motion.
function flexibleTail(
  parent: T.Object3D,
  color: string,
  length: number,
  count: number,
  shape: (u: number) => { y: number; z: number; ry: number; rz: number },
  whiteTip = false,
  vertical = false,
) {
  const bones: T.Bone[] = [],
    positions: number[] = [],
    indices: number[] = [],
    skinIndices: number[] = [],
    skinWeights: number[] = [],
    colors: number[] = [];
  const rings = 28,
    sides = 10;
  let previous: T.Bone | undefined;
  for (let i = 0; i <= count; i++) {
    const bone = new T.Bone(),
      u = i / count,
      point = shape(u),
      last = shape(Math.max(0, u - 1 / count));
    bone.position.set(
      i ? -length / count : 0,
      i ? point.y - last.y : point.y,
      i ? point.z - last.z : point.z,
    );
    if (previous) previous.add(bone);
    bones.push(bone);
    previous = bone;
  }
  for (let ring = 0; ring <= rings; ring++) {
    const u = ring / rings,
      point = shape(u);
    for (let side = 0; side <= sides; side++) {
      const a = (side / sides) * Math.PI * 2;
      positions.push(
        -u * length,
        point.y + Math.cos(a) * point.ry,
        point.z + Math.sin(a) * point.rz,
      );
      const joint = u * count,
        index = Math.min(count - 1, Math.floor(joint)),
        weight = joint - index;
      skinIndices.push(index, index + 1, 0, 0);
      skinWeights.push(1 - weight, weight, 0, 0);
      const c = new T.Color(whiteTip && u > 0.68 ? "#fff4dc" : color);
      colors.push(c.r, c.g, c.b);
      if (ring < rings && side < sides) {
        const current = ring * (sides + 1) + side;
        indices.push(
          current,
          current + sides + 1,
          current + 1,
          current + 1,
          current + sides + 1,
          current + sides + 2,
        );
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute(
    "skinIndex",
    new T.Uint16BufferAttribute(skinIndices, 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new T.Float32BufferAttribute(skinWeights, 4),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.SkinnedMesh(
    geometry,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.76 }),
  );
  mesh.frustumCulled = false;
  mesh.add(bones[0]);
  mesh.bind(new T.Skeleton(bones));
  if (vertical) mesh.rotation.z = Math.PI / 2;
  parent.add(mesh);
  return { mesh, bones };
}

// Merge static surfaces per material while retaining every articulated joint.
// This avoids hundreds of draw calls for fur markings and facial details.
function mergeStaticParts(parent: T.Object3D) {
  for (const child of [...parent.children])
    if (!(child instanceof T.Mesh)) mergeStaticParts(child);
  const buckets = new Map<T.Material, T.Mesh[]>();
  for (const child of parent.children)
    if (
      child instanceof T.Mesh &&
      !(child instanceof T.SkinnedMesh) &&
      !Array.isArray(child.material)
    ) {
      const list = buckets.get(child.material) || [];
      list.push(child);
      buckets.set(child.material, list);
    }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const copies = meshes.map((mesh) => {
      mesh.updateMatrix();
      return (
        mesh.geometry.index
          ? mesh.geometry.toNonIndexed()
          : mesh.geometry.clone()
      ).applyMatrix4(mesh.matrix);
    });
    const combined = mergeGeometries(copies, false);
    const geometry = combined ? mergeVertices(combined) : null;
    combined?.dispose();
    copies.forEach((g) => g.dispose());
    if (!geometry) continue;
    for (const mesh of meshes) {
      parent.remove(mesh);
      if (mesh.geometry !== sphere) mesh.geometry.dispose();
    }
    parent.add(new T.Mesh(geometry, material));
  }
}
export function createAnimalRig(
  id: string,
  headId = id,
  baby = false,
  female = false,
): Rig {
  const p = sexProfile(profile(id), female),
    hp = sexProfile(profile(headId), female),
    root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const legs: Joint[] = [],
    tails: T.Object3D[] = [],
    wings: T.Group[] = [];
  let headPosition = new T.Vector3(
    p.length * 0.47,
    p.leg + p.height * 1.13 + p.neck,
    0,
  );
  const torso = new T.Group();
  torso.position.y = p.leg + p.height;
  body.add(torso);
  if (p.kind === "marine") {
    torso.position.y = 0.8;
    ell(torso, p.color, 0, 0, 0, p.length * 0.55, 0.48, 0.43);
    ell(
      torso,
      p.belly,
      0.1,
      -0.22,
      p.feature === "orca" ? 0.13 : 0.04,
      p.length * 0.43,
      0.28,
      0.39,
    );
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
      p.feature === "orca" ? 0.7 : p.feature === "bluewhale" ? 0.18 : 0.35,
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
      if (p.kind === "penguin") {
        const flipper = ell(
          g,
          p.color,
          -0.04,
          -0.33,
          s * 0.1,
          0.13,
          0.48,
          0.065,
        );
        flipper.rotation.z = -0.22;
        flipper.name = "penguin-flipper";
      } else {
        const wing = ell(
          g,
          p.feature === "macaw" ? "#267fba" : p.color,
          -0.18,
          -0.1,
          s * 0.08,
          0.42,
          0.23,
          0.082,
        );
        wing.rotation.z = -0.2;
        for (let i = 0; i < 6; i++) {
          const feather = ell(
            g,
            p.feature === "macaw"
              ? i < 2
                ? "#e8b548"
                : "#2e76b5"
              : p.feature === "albatross"
                ? "#535d62"
                : p.color,
            -0.39 - i * 0.037,
            -0.16 - i * 0.031,
            s * 0.09,
            0.29,
            0.065,
            0.03,
          );
          feather.rotation.z = -0.3 + i * 0.04;
        }
      }
      wings.push(g);
    }
  } else if (p.kind === "primate") {
    ell(torso, p.color, 0, 0.2, 0, 0.52, 0.8, 0.42);
    ell(torso, p.belly, 0.27, 0.14, 0, 0.27, 0.51, 0.35);
    headPosition.set(0.1, p.leg + p.height + 1, 0);
  } else {
    const torsoMesh = ell(
      torso,
      p.color,
      0,
      0,
      0,
      p.length * 0.53,
      p.height * 0.91,
      0.43,
    );
    torsoMesh.name = "anatomical-torso";
    if (
      p.kind === "quadruped" &&
      !["platypus", "guineapig", "hedgehog", "koala"].includes(p.feature || "")
    )
      ell(
        torso,
        p.color,
        p.length * 0.33,
        -0.03,
        0,
        0.35,
        p.height * 0.84,
        0.38,
      );
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
    if (p.feature === "treeshrew")
      for (const side of [-1, 1])
        tube(
          torso,
          "#ead4af",
          [
            [0.47, 0.22, side * 0.33],
            [0.43, 0.03, side * 0.42],
            [0.4, -0.16, side * 0.37],
          ],
          0.033,
        );
    if (p.feature === "fox") {
      ell(torso, "#fff1d4", p.length * 0.39, -0.02, 0, 0.13, 0.32, 0.3);
      for (const side of [-1, 1]) {
        const tuft = leaf(torso, "#fff1d4", 0.16, 0.3, 0.04);
        tuft.position.set(p.length * 0.39, -0.3, side * 0.18);
        tuft.rotation.z = 2.55;
      }
    }
    if (["opossum", "koala", "kangaroo"].includes(p.feature || "")) {
      const pouch = ell(
        torso,
        "#b6a389",
        0.2,
        -p.height * 0.54,
        0.26,
        0.23,
        0.13,
        0.055,
      );
      pouch.name = "pouch";
      tube(
        torso,
        "#72644f",
        [
          [0.02, -p.height * 0.47, 0.27],
          [0.2, -p.height * 0.36, 0.31],
          [0.37, -p.height * 0.47, 0.27],
        ],
        0.02,
      );
    }
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
    const bird = p.kind === "bird" || p.kind === "penguin",
      count = bird ? 2 : 4,
      waterbird =
        [
          "mallard",
          "goose",
          "eider",
          "pelican",
          "cormorant",
          "gull",
          "blackheadedgull",
          "albatross",
        ].includes(p.feature || "") || p.kind === "penguin",
      hoof = ["zebra", "donkey", "giraffe", "bison"].includes(p.feature || "");
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1,
        front = i < 2,
        g = new T.Group();
      g.name = `limb-${i}`;
      g.position.set(
        p.kind === "primate"
          ? front
            ? 0.18
            : -0.05
          : bird
            ? 0
            : front
              ? p.length * 0.34
              : -p.length * 0.34,
        p.kind === "primate" && front
          ? p.leg + p.height + 0.58
          : p.leg + p.height * 0.2,
        side * (p.kind === "primate" ? 0.41 : bird ? 0.19 : 0.31),
      );
      if (p.kind === "reptile" || p.kind === "turtle") {
        g.rotation.x = side * 0.52;
        g.rotation.z = front ? -0.28 : 0.28;
      }
      body.add(g);
      const length =
          p.feature === "kangaroo" && front
            ? 0.43
            : p.kind === "primate" && front
              ? p.leg + p.height + 0.43
              : p.leg,
        upper = length * 0.52;
      const upperColor =
          p.feature === "panda" ? "#343a39" : bird ? p.color : p.color,
        lowerColor =
          p.feature === "fox"
            ? "#343635"
            : p.feature === "opossum"
              ? "#d9a09d"
              : p.feature === "panda"
                ? "#343a39"
                : bird
                  ? p.kind === "penguin"
                    ? "#e4a149"
                    : "#b99461"
                  : p.color;
      const radius = bird
        ? 0.068
        : hoof
          ? 0.1
          : p.feature === "kangaroo" && !front
            ? 0.23
            : p.kind === "primate"
              ? 0.15
              : 0.17;
      ell(
        g,
        upperColor,
        0,
        -upper * 0.44,
        0,
        radius,
        upper * 0.63,
        radius * 0.95,
      );
      if (p.feature === "zebra") pattern(g, p, radius, upper * 0.63, radius);
      const knee = new T.Group();
      knee.position.y = -upper;
      g.add(knee);
      ell(
        knee,
        lowerColor,
        0.015,
        -(length - upper) * 0.45,
        0,
        bird ? 0.042 : hoof ? 0.065 : radius * 0.66,
        (length - upper) * 0.6,
        bird ? 0.04 : hoof ? 0.07 : radius * 0.65,
      );
      const footY = -(length - upper),
        foot = new T.Group();
      foot.position.set(0.065, footY, 0);
      knee.add(foot);
      if (p.feature === "platypus" || waterbird) {
        const color =
          p.feature === "platypus"
            ? "#686153"
            : p.kind === "penguin"
              ? "#df9a40"
              : "#dcab53";
        const web = leaf(
          foot,
          color,
          bird ? 0.29 : 0.32,
          bird ? 0.26 : 0.29,
          0.025,
        );
        web.name = "webbed-foot";
        web.rotation.x = -Math.PI / 2;
        web.rotation.z = -Math.PI / 2;
        web.position.set(-0.045, 0.018, 0.035);
        for (let toe = -1; toe <= 1; toe++)
          tube(
            foot,
            color,
            [
              [0, 0.025, 0],
              [0.23, 0.02, toe * 0.11],
            ],
            0.018,
          );
      } else if (bird) {
        for (let toe = -1; toe <= 1; toe++) {
          tube(
            foot,
            "#bd965c",
            [
              [0, 0.025, 0],
              [0.13, 0.01, toe * 0.07],
              [0.23, 0.005, toe * 0.1],
            ],
            0.02,
          );
          tube(
            foot,
            "#514b40",
            [
              [0.2, 0.012, toe * 0.09],
              [0.245, 0.025, toe * 0.1],
              [0.26, -0.01, toe * 0.11],
            ],
            0.012,
          );
        }
      } else if (hoof) {
        ell(foot, "#414640", 0.015, -0.012, 0, 0.12, 0.075, 0.12);
        tube(
          foot,
          "#26312b",
          [
            [0.1, 0.025, -0.07],
            [0.12, -0.02, 0],
            [0.1, 0.025, 0.07],
          ],
          0.009,
        );
      } else {
        const digits = p.kind === "primate" ? 4 : 3,
          footColor = lowerColor;
        ell(
          foot,
          footColor,
          0.04,
          0,
          0,
          p.feature === "kangaroo" && !front ? 0.32 : 0.16,
          0.075,
          0.14,
        );
        for (let toe = 0; toe < digits; toe++) {
          const z = (toe - (digits - 1) / 2) * 0.062;
          ell(
            foot,
            footColor,
            p.feature === "kangaroo" && !front ? 0.25 : 0.14,
            0.003,
            z,
            0.069,
            0.052,
            0.039,
          );
          if (p.kind === "primate")
            ell(foot, footColor, 0.16, 0.0, z, 0.1, 0.036, 0.031);
          else if (p.feature !== "guineapig")
            ell(foot, "#d3c5a5", 0.2, 0.012, z, 0.032, 0.018, 0.018);
        }
      }
      legs.push({
        group: g,
        rest: g.rotation.z,
        phase: front ? (side === 1 ? 0 : Math.PI) : side === 1 ? Math.PI : 0,
        knee,
      });
    }
  }
  if (p.tail && !["snake", "turtle"].includes(p.kind)) {
    if (p.kind === "bird" || p.kind === "penguin") {
      const tail = new T.Group();
      tail.position.set(-0.33, p.leg + p.height - 0.08, 0);
      body.add(tail);
      for (let i = -2; i <= 2; i++) {
        const feather = ell(
          tail,
          p.color,
          -p.tail * 0.38,
          -0.03,
          i * 0.05,
          p.tail * 0.48,
          0.055,
          0.08,
        );
        feather.rotation.y = i * 0.1;
        feather.rotation.z = -0.12;
      }
      tails.push(tail);
    } else {
      const paddle = ["platypus", "beaver"].includes(p.feature || "");
      const fluffy = p.feature === "fox" || p.feature === "treeshrew";
      const radius = fluffy
        ? p.feature === "fox"
          ? 0.28
          : 0.18
        : p.kind === "marine"
          ? 0.18
          : p.feature === "kangaroo"
            ? 0.18
            : 0.07;
      const skin = flexibleTail(
        body,
        p.feature === "opossum"
          ? "#e3a4a0"
          : p.feature === "beaver"
            ? "#70513a"
            : p.color,
        p.tail,
        6,
        (u) => ({
          y:
            p.kind === "marine"
              ? 0
              : paddle
                ? -0.03
                : fluffy
                  ? 0.4 * Math.sin(u * Math.PI * 0.85)
                  : 0.2 * u * u,
          z: p.feature === "opossum" ? 0.18 * Math.sin(u * Math.PI) : 0,
          ry: paddle
            ? 0.045
            : Math.max(
                0.012,
                radius * Math.sin(Math.PI * (u * 0.86 + 0.08)) * (1 - u * 0.35),
              ),
          rz: paddle
            ? 0.3 * Math.sin(Math.PI * (u * 0.85 + 0.1))
            : Math.max(
                0.012,
                radius * Math.sin(Math.PI * (u * 0.86 + 0.08)) * (1 - u * 0.35),
              ),
        }),
        p.feature === "fox",
      );
      skin.mesh.position.set(
        -p.length * 0.46,
        p.kind === "marine" ? 0.8 : p.leg + p.height * 0.8,
        0,
      );
      skin.mesh.name = paddle
        ? "paddle-tail"
        : p.feature === "opossum"
          ? "hairless-tail"
          : "flexible-tail";
      tails.push(...skin.bones);
      if (p.kind === "marine")
        for (const side of [-1, 1]) {
          const fluke = ell(
            skin.bones.at(-1)!,
            p.color,
            -0.06,
            0,
            side * 0.25,
            0.29,
            0.065,
            0.33,
          );
          fluke.rotation.y = side * 0.4;
        }
    }
  }
  const face = makeHead(hp, baby, female);
  face.head.position.copy(headPosition);
  const hybrid = headId !== id;
  face.head.scale.setScalar(hybrid ? 1.04 : 1.16);
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
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object instanceof T.SkinnedMesh) {
      object.skeleton.calculateInverses();
      object.bind(object.skeleton, object.matrixWorld);
    }
  });
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
    pupils: face.pupils,
    ears: face.ears,
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
  for (const pupil of rig.pupils)
    pupil.position.x = 0.025 + (paused ? 0 : Math.sin(t * 0.73) * 0.018);
  rig.ears.forEach((ear, index) => {
    ear.rotation.z =
      (paused ? 0 : Math.sin(t * 1.7 + index) * 0.045) +
      (rig.hover ? (index ? -0.1 : 0.1) : 0);
  });
  for (const leg of rig.legs) {
    leg.group.rotation.z = leg.rest + gait * Math.sin(t * 4 + leg.phase) * 0.24;
    leg.knee!.rotation.z =
      gait * Math.max(0, Math.cos(t * 4 + leg.phase)) * 0.4;
  }
  rig.tails.forEach((tail, i) => {
    tail.rotation.y = Math.sin(t * 2 - i * 0.5) * (rig.hover ? 0.12 : 0.045);
    tail.rotation.z =
      rig.kind === "marine"
        ? Math.sin(t * 2 - i * 0.4) * 0.18
        : Math.sin(t * 1.3 - i * 0.4) * 0.025;
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
  pairing?: Pairing;
};
const entries = new Set<Entry>();
let renderer: T.WebGLRenderer | undefined,
  frame = 0,
  lastFrame = 0,
  renderCursor = 0;
function tick(now: number) {
  frame = requestAnimationFrame(tick);
  if (now - lastFrame < 50) return;
  lastFrame = now;
  if (!renderer) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const active = [...entries], frameStart = performance.now();
  for (let index = 0; index < active.length; index++) {
    renderCursor %= active.length;
    const entry = active[renderCursor++];
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
    if (paused && entry.canvas.dataset.renderReady === "true") {
      // Freeze the current pose immediately instead of queueing a later reset.
      entry.last = frozen;
      continue;
    }
    if (
      entry.canvas.dataset.renderReady === "true" &&
      getComputedStyle(entry.canvas).opacity === "0"
    )
      continue;
    entry.last = frozen;
    if (entry.pairing) {
      const clock = pairingClock(entry.canvas);
      animatePairing(entry.pairing, clock);
      entry.canvas.dataset.babyVisible = String(
        entry.pairing.baby.root.visible,
      );
      entry.canvas.dataset.stage =
        clock < 1.45
          ? "approach"
          : clock < 2.25
            ? "courtship"
            : clock < 4.2
              ? "mating"
              : clock < 5.4
                ? "later"
                : clock < 7.1
                  ? "birth"
                  : "family";
    } else animateRig(entry.rig, paused ? 0 : now / 1000, paused);
    const width = entry.canvas.width,
      height = entry.canvas.height;
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.render(entry.scene, entry.camera);
    const ctx = entry.canvas.getContext("2d");
    ctx?.clearRect(0, 0, width, height);
    ctx?.drawImage(
      renderer.domElement,
      0,
      400 - height,
      width,
      height,
      0,
      0,
      width,
      height,
    );
    entry.canvas.dataset.renderReady = "true";
    // Fairly rotate canvases and yield on slower software/mobile renderers.
    // Fast GPUs still update all visible animals in the same animation frame.
    if (performance.now() - frameStart > 14) break;
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
  ensureRenderer();
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
    disposeRig(rig);
    (shadow.material as T.Material).dispose();
    if (!entries.size) {
      cancelAnimationFrame(frame);
      frame = 0;
      renderer?.dispose();
      renderer = undefined;
    }
  };
}

type Pairing = {
  mother: Rig;
  father: Rig;
  baby: Rig;
  behavior: "mount" | "water" | "coil";
  birth: "live" | "egg" | "pouch";
  scales: number[];
};
const ease = (a: number, b: number, t: number) =>
  a + (b - a) * T.MathUtils.smoothstep(t, 0, 1);
function animatePairing(pair: Pairing, time: number) {
  const { mother, father, baby, behavior, birth } = pair;
  const contact = T.MathUtils.smoothstep(time, 0, 1.45),
    mating = time >= 2.25 && time < 4.2,
    later = T.MathUtils.smoothstep(time, 4.2, 5.15),
    born = T.MathUtils.smoothstep(time, birth === "egg" ? 6.25 : 5.45, 6.9),
    finish = T.MathUtils.smoothstep(time, 7.1, 8.65);
  [mother, father, baby].forEach((rig, i) =>
    rig.root.scale.setScalar(pair.scales[i]),
  );
  for (const rig of [mother, father, baby]) animateRig(rig, time * 0.75, false);
  mother.root.position.set(ease(-1.7, -0.68, contact), -1.4, 0);
  father.root.position.set(ease(1.7, 0.68, contact), -1.4, 0);
  father.root.rotation.y = Math.PI;
  mother.root.rotation.y = 0;
  mother.head.rotation.z =
    time > 1.45 && time < 2.25 ? -0.08 * Math.sin(time * 6) : 0.015;
  mother.root.rotation.z = 0;
  father.root.rotation.z = 0;
  if (mating) {
    const settle = T.MathUtils.smoothstep(time, 2.25, 2.85);
    mother.root.position.x = ease(-0.68, 0.25, settle);
    if (behavior === "mount") {
      father.root.position.x =
        ease(0.68, -0.7, settle) + Math.sin(time * 7) * 0.018;
      father.root.position.z = -0.1;
      father.root.position.y = -1.4 + settle * 0.16;
      father.root.rotation.y = ease(Math.PI, 0, settle);
      father.root.rotation.z = settle * 0.28;
      mother.root.position.y -= settle * 0.06;
      father.legs.forEach((joint, i) => {
        joint.group.rotation.z = joint.rest + (i < 2 ? 0.65 : -0.28) * settle;
        joint.knee!.rotation.z = i < 2 ? 0.35 : 0.04;
      });
      mother.legs.forEach((joint) => {
        joint.group.rotation.z = joint.rest + 0.1;
        joint.knee!.rotation.z = 0.18;
      });
      father.wings.forEach((wing, i) => (wing.rotation.x = (i ? -1 : 1) * 0.5));
      mother.head.rotation.z = -0.08;
      father.head.rotation.z = 0.09;
    } else if (behavior === "water") {
      father.root.position.set(ease(0.68, -0.65, settle), -1.35, -0.24);
      father.root.rotation.y = ease(Math.PI, 0.25, settle);
      mother.root.rotation.y = -0.15;
      father.root.rotation.z = 0.08;
      mother.root.position.y += Math.sin(time * 3) * 0.025;
    } else {
      father.root.position.set(ease(0.68, 0.1, settle), -1.37, -0.17);
      father.root.rotation.y = ease(Math.PI, 0.5, settle);
      mother.root.rotation.y = -0.3;
      father.head.rotation.y = -0.3;
    }
  }
  if (time >= 4.2) {
    mother.root.position.x = ease(0.25, birth === "egg" ? 0.7 : 0.65, later);
    father.root.position.set(ease(-0.7, 2.1, later), -1.4, -0.2);
    father.root.rotation.y = 0;
    father.root.rotation.z = 0;
    father.root.scale.setScalar(pair.scales[1] * ease(1, 0.55, later));
    mother.root.rotation.y =
      birth === "egg"
        ? 0
        : ease(0, Math.PI, T.MathUtils.smoothstep(time, 5.1, 6.0));
    mother.head.rotation.z = -0.1;
    mother.legs.forEach((joint) => {
      joint.group.rotation.z = joint.rest + (1 - finish) * 0.09;
      joint.knee!.rotation.z = (1 - finish) * 0.17;
    });
  }
  if (time >= 5.4) {
    baby.root.visible = born > 0.001;
    const size =
      birth === "pouch" ? ease(0.045, 0.13, born) : ease(0.1, 0.35, born);
    baby.root.scale.setScalar(pair.scales[2] * ease(size, 0.72, finish));
    baby.root.position.set(
      birth === "egg" ? 0 : ease(-0.1, -0.72, born),
      -1.4,
      birth === "pouch" ? -0.02 : 0.1,
    );
    baby.root.rotation.y = 0;
    baby.head.rotation.z = 0.08;
    if (time < 7.1) for (const eye of baby.eyes) eye.scale.y = 0.14;
    if (birth === "pouch" && time < 7.1) {
      baby.root.position.x = ease(-0.1, 0.43, born);
      baby.root.position.y = ease(-1.35, -0.55, born);
    }
    mother.root.position.x = ease(0.65, -1.8, finish);
    mother.root.scale.setScalar(pair.scales[0] * ease(1, 0.55, finish));
    mother.root.rotation.y = ease(birth === "egg" ? 0 : Math.PI, 0, finish);
    baby.root.position.x = ease(baby.root.position.x, 0, finish);
  } else baby.root.visible = false;
}
function pairingClock(canvas: HTMLCanvasElement) {
  const animation = canvas
    .getAnimations()
    .find(
      (animation) =>
        (animation as CSSAnimation).animationName === "breedingTimeline",
    );
  if (!animation) return 0;
  const time =
    Number(animation.currentTime || 0) -
    Number(animation.effect?.getTiming().delay || 0);
  return Math.max(0, time / 1000);
}
function ensureRenderer() {
  if (renderer) return;
  renderer = new T.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(640, 400, false);
  renderer.setClearColor(0x000000, 0);
  renderer.setScissorTest(true);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}
function disposeRig(rig: Rig) {
  rig.owned.forEach((geometry) => geometry.dispose());
  rig.ownedMaterials.forEach((material) => material.dispose());
  rig.root.traverse((object) => {
    if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
  });
}
export function mountAnimalPairing(
  canvas: HTMLCanvasElement,
  chosenId: string,
  correctId: string,
  behavior: Pairing["behavior"],
  birth: Pairing["birth"],
) {
  ensureRenderer();
  canvas.dataset.renderReady = "false";
  const mother = createAnimalRig(chosenId, chosenId, false, true),
    father = createAnimalRig(correctId),
    baby = createAnimalRig(chosenId, correctId, true),
    scene = new T.Scene();
  scene.add(mother.root, father.root, baby.root);
  scene.add(new T.HemisphereLight("#fff7e9", "#7c9688", 1.9));
  const light = new T.DirectionalLight("#fff9ed", 2.1);
  light.position.set(3, 5, 7);
  scene.add(light);
  for (const x of [-0.7, 0.7]) {
    const shadow = ell(scene, "#687c56", x, -1.42, 0, 0.78, 0.008, 0.32);
    shadow.material = new T.MeshStandardMaterial({
      color: "#687c56",
      transparent: true,
      opacity: 0.12,
    });
  }
  const camera = new T.OrthographicCamera(-3.9, 3.9, 2.19, -2.19, 0.1, 50);
  camera.position.set(2.8, 2.5, 8);
  camera.lookAt(0, -0.08, 0);
  const pairing = {
    mother,
    father,
    baby,
    behavior,
    birth,
    scales: [mother.root.scale.x, father.root.scale.x, baby.root.scale.x],
  };
  const entry: Entry = { canvas, rig: mother, scene, camera, last: 0, pairing };
  entries.add(entry);
  if (!frame) frame = requestAnimationFrame(tick);
  return () => {
    entries.delete(entry);
    [mother, father, baby].forEach(disposeRig);
    scene.traverse((object) => {
      if (
        object instanceof T.Mesh &&
        object.geometry === sphere &&
        (object.material as T.MeshStandardMaterial).transparent
      )
        (object.material as T.Material).dispose();
    });
    if (!entries.size) {
      cancelAnimationFrame(frame);
      frame = 0;
      renderer?.dispose();
      renderer = undefined;
    }
  };
}
