"use client";

import { memo, useId } from "react";
import type { Animal } from "../lib/animalstats";

type Shape = "quadruped" | "bird" | "primate" | "giraffe" | "elephant" | "kangaroo" | "whale" | "snake" | "turtle" | "crocodile";
type Detail = "plain" | "spots" | "stripes" | "panda" | "mane" | "horn" | "spines" | "bill" | "mask" | "crest" | "tusks" | "spectacles" | "long-nose" | "big-muzzle" | "horns";
type Profile = { shape: Shape; coat: string; light: string; accent: string; ears: "round" | "point" | "long"; detail: Detail; tail: "long" | "short" | "flat"; beak?: string };
const base: Profile = { shape: "quadruped", coat: "#bd9568", light: "#f8deb0", accent: "#684b34", ears: "round", detail: "plain", tail: "long" };
const profiles: Record<string, Partial<Profile>> = {
 panthera_leo: { coat: "#d6a050", light: "#ffe0a1", accent: "#a16a33", detail: "mane" },
 panthera_tigris: { coat: "#e99343", light: "#ffedce", accent: "#4e4036", detail: "stripes" },
 panthera_pardus: { coat: "#deb85a", detail: "spots", accent: "#59452d" },
 acinonyx_jubatus: { coat: "#eac678", detail: "spots", accent: "#594a38", ears: "point" },
 canis_lupus: { coat: "#8c9c9c", light: "#dce2d9", accent: "#53666d", ears: "point" },
 vulpes_vulpes: { coat: "#de874b", light: "#fff0d6", accent: "#75513e", ears: "point" },
 ursus_maritimus: { coat: "#f1eee0", light: "#fffdf3", accent: "#b9c5c0", tail: "short" },
 ursus_arctos: { coat: "#9d7858", light: "#cfaa78", accent: "#6b4d3e", tail: "short" },
 ursus_americanus: { coat: "#565e60", light: "#b29c80", accent: "#363e47", tail: "short" },
 ailuropoda_melanoleuca: { coat: "#f1eee3", light: "#fff9e6", accent: "#485259", detail: "panda", tail: "short" },
 loxodonta_africana: { shape: "elephant", coat: "#a5b4b1", light: "#d3dfd3", accent: "#748b8d", detail: "tusks", tail: "short" },
 giraffa_camelopardalis: { shape: "giraffe", coat: "#e6bd65", light: "#fff0b8", accent: "#b68145", detail: "spots" },
 hippopotamus_amphibius: { coat: "#b4a6b1", light: "#e2c7c4", accent: "#8a798c", detail: "big-muzzle", tail: "short" },
 ceratotherium_simum: { coat: "#b5b2a5", light: "#dfdbcc", accent: "#858a83", detail: "horn", tail: "short" },
 bison_bison: { coat: "#8c6c50", light: "#d3b18b", accent: "#5b493b", detail: "horns", tail: "short" },
 equus_quagga: { coat: "#f4ecd9", light: "#fff9e9", accent: "#47565a", ears: "long", detail: "stripes" },
 equus_asinus: { coat: "#a6a9a3", light: "#e8deca", accent: "#687978", ears: "long" },
 gorilla_gorilla: { shape: "primate", coat: "#586565", light: "#b1b8ac", accent: "#3b4c50", tail: "short" },
 pan_troglodytes: { shape: "primate", coat: "#6d6658", light: "#e6c3a2", accent: "#48544e", tail: "short" },
 pongo_pygmaeus: { shape: "primate", coat: "#bc774b", light: "#edb989", accent: "#88583c", tail: "short" },
 macaca_mulatta: { shape: "primate", coat: "#ba9b77", light: "#e6b6a6", accent: "#8b735f" },
 phascolarctos_cinereus: { coat: "#aab8b4", light: "#edf1df", accent: "#5a7277", tail: "short" },
 macropus_rufus: { shape: "kangaroo", coat: "#c99264", light: "#f4d3a2", accent: "#916e51", ears: "long" },
 hydrochoerus_hydrochaeris: { coat: "#b89569", light: "#e4c998", accent: "#8a714f", detail: "big-muzzle", tail: "short" },
 castor_canadensis: { coat: "#a17b57", light: "#e4c39c", accent: "#755944", tail: "flat" },
 tursiops_truncatus: { shape: "whale", coat: "#8bb5be", light: "#d3e6e3", accent: "#5d8fa4" },
 orcinus_orca: { shape: "whale", coat: "#465b68", light: "#f3f3df", accent: "#2d434e", detail: "panda" },
 balaenoptera_musculus: { shape: "whale", coat: "#83b8c4", light: "#cbe4e2", accent: "#528b9d" },
 megaptera_novaeangliae: { shape: "whale", coat: "#6f92ab", light: "#dae3df", accent: "#496e87" },
 alligator_mississippiensis: { shape: "crocodile", coat: "#7caa81", light: "#d6e1ad", accent: "#527a5e" },
 crocodylus_acutus: { shape: "crocodile", coat: "#b2b97c", light: "#e8e7b1", accent: "#788e62" },
 boa_constrictor: { shape: "snake", coat: "#aab17a", light: "#e6deb2", accent: "#73764c", detail: "spots" },
 python_molurus: { shape: "snake", coat: "#dec18d", light: "#f3e5b8", accent: "#a0885e", detail: "spots" },
 trachemys_scripta: { shape: "turtle", coat: "#83a887", light: "#e4db98", accent: "#496d58", detail: "mask" },
 helarctos_malayanus: { coat: "#655c51", light: "#efd88d", accent: "#453f37", detail: "mask", tail: "short" },
 melursus_ursinus: { coat: "#6e6259", light: "#d9c4a3", accent: "#49413e", detail: "mane", tail: "short" },
 tremarctos_ornatus: { coat: "#5f6458", light: "#ead6ae", accent: "#414b43", detail: "spectacles", tail: "short" },
 ursus_thibetanus: { coat: "#59615a", light: "#e9dcac", accent: "#3e4c48", detail: "mask", tail: "short" },
 ornithorhynchus_anatinus: { coat: "#947152", light: "#d8b582", accent: "#677d78", detail: "bill", tail: "flat" },
 erinaceus_europaeus: { coat: "#b19b73", light: "#f1dcb6", accent: "#75664f", detail: "spines", tail: "short" },
 didelphis_marsupialis: { coat: "#a9ada7", light: "#f0dfce", accent: "#c895a3", detail: "long-nose", ears: "round" },
 tupaia_glis: { coat: "#b78d5f", light: "#eacb97", accent: "#876c4d", detail: "long-nose", ears: "round" },
 cavia_porcellus: { coat: "#d3b286", light: "#fff0d6", accent: "#916e4f", detail: "spots", tail: "short" },
};
// Each bird has a distinct plumage palette and recognizable beak, crest or face marking.
const birds: Record<string, [string, string, string, Detail?]> = {
 aquila_chrysaetos: ["#a5875d", "#e0bc72", "#725740"], haliaeetus_leucocephalus: ["#806c57", "#fff6e5", "#ddae54", "mask"],
 anas_platyrhynchos: ["#adad8f", "#457b67", "#e7b454", "bill"], falco_peregrinus: ["#81949f", "#eae4ce", "#4e6573", "mask"],
 gallus_gallus: ["#c79551", "#e8bb65", "#c15b49", "crest"], cardinalis_cardinalis: ["#d37260", "#e79378", "#8b4d47", "crest"],
 hirundo_rustica: ["#688d9e", "#d88869", "#415e72"], pelecanus_occidentalis: ["#9fa99c", "#e8dfb4", "#d3ae68", "bill"],
 diomedea_exulans: ["#dddcca", "#fff7df", "#d5b583"], ara_macao: ["#d97960", "#f2bd62", "#648d9e"],
 aptenodytes_patagonicus: ["#617581", "#d4d9c9", "#e5b158", "mask"], pygoscelis_papua: ["#627d83", "#f6f1d9", "#db9570", "mask"],
 spheniscus_demersus: ["#677d7c", "#fff2d7", "#3f565a", "mask"], bubo_virginianus: ["#b29b75", "#e8d9ac", "#7e765d", "crest"],
 dromaius_novaehollandiae: ["#a18b72", "#738c87", "#625c50"], struthio_camelus: ["#7b8073", "#e8c7b0", "#4e605b"],
 apus_apus: ["#858270", "#c8bea0", "#5c685e"], anser_anser: ["#b5b6a4", "#dfdec7", "#dfaa65"],
 ardea_cinerea: ["#a8bfc2", "#f0eee0", "#819ba7"], phalacrocorax_carbo: ["#627773", "#a8b6a2", "#bfb56e"],
 larus_argentatus: ["#b7cbd0", "#fff6df", "#d9b25c"], corvus_corone: ["#60736d", "#7e9183", "#414f51"],
 sturnus_vulgaris: ["#829886", "#b6c8a2", "#a99769", "spots"], columba_palumbus: ["#9cacc3", "#d9d5df", "#b39c8e"],
 corvus_frugilegus: ["#6f807d", "#a7b6ae", "#5b6870"], alauda_arvensis: ["#c8b083", "#f0dec0", "#998062", "crest"],
 somateria_mollissima: ["#a3ada2", "#f0eada", "#73917b", "mask"], vanellus_vanellus: ["#759588", "#f0ebd5", "#486d66", "crest"],
 haematopus_ostralegus: ["#697d7e", "#fbf1d8", "#df9465", "mask"], sterna_hirundo: ["#bccdcf", "#faf4df", "#dd9971", "mask"],
 larus_ridibundus: ["#b9cbd0", "#826f60", "#d99d85", "mask"],
};
for (const [id, [coat, light, accent, detail]] of Object.entries(birds)) profiles[id] = { shape: "bird", coat, light, accent, detail: detail ?? "plain", beak: accent, tail: "short" };

export function animalSpriteProfile(animal: Animal): Profile {
 return { ...base, ...(animal.taxonomicGroup === "bird" ? { shape: "bird" as const } : {}), ...profiles[animal.id] };
}

function Markings({ p, clip }: { p: Profile; clip: string }) {
 return <g clipPath={`url(#${clip})`} fill={p.accent} stroke="none" opacity=".8">
  {p.detail === "stripes" && [45, 63, 81, 99, 117].map((x, i) => <path key={x} d={`M${x} 77l${i % 2 ? 9 : -9} 30 8-3-4-32Z`} />)}
  {p.detail === "spots" && [[46,99],[64,89],[80,110],[97,91],[116,112],[57,122],[104,130]].map(([x,y]) => <ellipse key={x} cx={x} cy={y} rx="5" ry="4" transform={`rotate(20 ${x} ${y})`} />)}
  {p.detail === "panda" && <path d="M81 76h29v70H81Z" />}
  {p.detail === "mask" && <path d="M90 82q-8 16 7 27 18-15 15-27Z" fill={p.light} />}
 </g>;
}

function Head({ p }: { p: Profile }) {
 const bird = p.shape === "bird";
 return <g className="spriteHead">
  {p.detail === "mane" && <path d="M-29-8-5-30l22 3 25 24-5 32-28 16-31-15Z" fill={p.accent} />}
  {!bird && !["whale","snake","crocodile","turtle"].includes(p.shape) && <g fill={p.detail === "panda" ? p.accent : p.coat}>
   {p.ears === "round" ? <><circle cx="-21" cy="-18" r={p.shape === "elephant" ? 24 : 10}/><circle cx="17" cy="-20" r={p.shape === "elephant" ? 22 : 10}/><circle cx="-21" cy="-18" r="5" fill={p.light}/><circle cx="17" cy="-20" r="5" fill={p.light}/></> : <><path d={p.ears === "long" ? "M-22-10q-13-44 0-42 12 7 13 40Z" : "M-26-8-23-34-8-18Z"}/><path d={p.ears === "long" ? "M11-12q-1-42 12-44 10 7-3 44Z" : "M7-19 21-36 25-6Z"}/></>}
  </g>}
  {p.shape === "giraffe" && <g fill={p.accent}><rect x="-13" y="-35" width="5" height="21" rx="2"/><rect x="8" y="-37" width="5" height="22" rx="2"/><circle cx="-10" cy="-35" r="5"/><circle cx="10" cy="-37" r="5"/></g>}
  {p.detail === "horns" && <g fill="#f1e4c7"><path d="M-20-17q-19-1-20-17-12 21 12 27Z"/><path d="M15-17q15-8 14-23 14 18-9 30Z"/></g>}
  {p.detail === "crest" && <path d="M-17-18-12-35-5-29 1-40 12-24 19-17Z" fill={p.accent}/>}
  <ellipse cy="1" rx={p.shape === "crocodile" ? 32 : 26} ry={p.shape === "snake" ? 19 : 27} fill={bird && p.detail === "mask" ? p.light : p.coat}/>
  {p.shape === "primate" && <path d="M-19-8q10-10 19 0 14-12 23 0l-4 26q-23 23-37-1Z" fill={p.light}/>}
  {p.detail === "panda" && <g fill={p.accent}><ellipse cx="-11" cy="1" rx="10" ry="12" transform="rotate(20 -11 1)"/><ellipse cx="12" cy="1" rx="9" ry="12" transform="rotate(-20 12 1)"/></g>}
  {p.detail === "spectacles" && <g fill="none" stroke={p.light} strokeWidth="6"><circle cx="-10" cy="1" r="11"/><circle cx="12" cy="1" r="10"/></g>}
  {bird ? <><path d={p.detail === "bill" ? "M15 7q48-6 35 12L17 21Z" : "M16 7 41 15 17 23Z"} fill={p.beak ?? p.accent}/>{p.detail === "bill" && <path d="M19 18q18 25 29-1Z" fill={p.light}/>}</> : p.shape === "elephant" ? <><path className="spriteTrunk" d="M12 11q20 15 12 33-6 15-17 4" fill="none" stroke={p.coat} strokeWidth="14" strokeLinecap="round"/><path d="M-4 15q0 24 9 16" fill="none" stroke="#fff6da" strokeWidth="5" strokeLinecap="round"/></> : p.detail === "long-nose" ? <path d="M-15 10 28 12q11 9-1 14-28 8-41-5Z" fill={p.light}/> : <ellipse cx="6" cy="16" rx={p.detail === "big-muzzle" ? 25 : p.detail === "bill" ? 24 : p.shape === "crocodile" ? 31 : 17} ry="11" fill={p.detail === "bill" ? p.accent : p.light}/>}
  {p.detail === "horn" && <path d="M15 7 25-14 29 12Z" fill="#f4e7ce"/>}
  {p.shape === "crocodile" && <path d="m1 21 6 9 5-9 6 9 6-9" fill="#fffae6"/>}
  <g className="spriteEyes" fill="#334a45"><ellipse cx="-9" cy="0" rx="3.2" ry="4.2"/><ellipse cx="12" cy="0" rx="3.2" ry="4.2"/><circle cx="-8" cy="-1" r="1" fill="#fff"/><circle cx="13" cy="-1" r="1" fill="#fff"/></g>
  {!bird && p.shape !== "elephant" && <><ellipse cx="8" cy="12" rx="5" ry="3" fill={p.detail === "bill" ? p.light : p.accent}/><path d="M5 20q4 4 9 0" stroke="#52634c" strokeWidth="1.5" fill="none" strokeLinecap="round"/></>}
  <ellipse cx="-17" cy="11" rx="5" ry="3" fill="#e9a396" opacity=".55"/>
 </g>;
}

/** Modular vector features make a real, deterministic visual combination of the two parents. */
export const AnimalSprite = memo(function AnimalSprite({ animal, headAnimal, baby = false, className = "" }: { animal: Animal; headAnimal?: Animal; baby?: boolean; className?: string }) {
 const clip = useId().replaceAll(":", ""); const p = animalSpriteProfile(animal); const h = animalSpriteProfile(headAnimal ?? animal);
 const head = p.shape === "giraffe" ? [119,45] : p.shape === "snake" ? [132,83] : p.shape === "whale" ? [128,94] : [119,74];
 const label = headAnimal && headAnimal.id !== animal.id ? `${animal.commonName} and ${headAnimal.commonName} fantasy hybrid` : animal.commonName;
 return <svg className={`animalSprite ${baby ? "spriteBaby" : ""} ${className}`} viewBox="0 0 180 160" role="img" aria-label={label} data-animal-id={animal.id} data-head-animal-id={headAnimal?.id ?? animal.id}>
  <ellipse className="spriteShadow" cx="86" cy="144" rx="55" ry="8" fill="#496f5630"/>
  <defs><clipPath id={clip}><ellipse cx="83" cy="109" rx="46" ry="29"/></clipPath></defs>
  <g className="spriteBounce" stroke="#526052" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
   {p.shape === "whale" ? <><path className="spriteTail" d="M49 105q-28-13-38-34 3 31-1 46 17-1 35-6" fill={p.coat}/><path d="M92 84 94 55q20 13 17 32" fill={p.accent}/><ellipse cx="93" cy="110" rx="59" ry="30" fill={p.coat}/><path d="M49 121q53 34 94-3" fill={p.light}/><path className="spriteLegFront" d="M93 117q2 32 27 22l-12-23" fill={p.accent}/></> : p.shape === "snake" ? <><path className="spriteTail" d="M124 103q-6 37-46 31-55-6-40-30 17-26 45 2-33 22-49-13" fill="none" stroke={p.coat} strokeWidth="22"/><path d="M114 120q22-10 18-32" fill="none" stroke={p.coat} strokeWidth="24"/><path d="M28 87q-9 9-5 19" fill="none" stroke={p.accent} strokeWidth="5"/></> : <>
    {p.tail !== "short" && <path className="spriteTail" d={p.tail === "flat" ? "M47 120q-36 3-30-19 6-8 25 8Z" : "M45 111q-29-8-21-33"} fill={p.tail === "flat" ? p.accent : "none"} stroke={p.tail === "flat" ? "#526052" : p.coat} strokeWidth={p.tail === "flat" ? 2 : 12}/>} 
    <g fill={p.detail === "panda" ? p.accent : p.coat}>
     <path className="spriteLegBack" d="M51 116v21q0 10 14 4l4-23Z"/><path className="spriteLegFront" d="M101 117v23q4 7 16 1l-1-25Z"/>
    </g>
    {p.detail === "spines" && <path d="m33 108-8-17 13-2 2-16 13 2 8-15 10 9 15-8 9 13 14-4 7 18 12 4-9 17Z" fill={p.accent}/>}
    {p.shape === "primate" ? <><ellipse cx="85" cy="108" rx="35" ry="34" fill={p.coat}/><path className="spriteLegBack" d="M58 92q-31 10-18 37" fill="none" stroke={p.coat} strokeWidth="17"/><path className="spriteLegFront" d="M108 91q21 13 12 34" fill="none" stroke={p.coat} strokeWidth="16"/><ellipse cx="87" cy="113" rx="21" ry="22" fill={p.light}/></> : p.shape === "bird" ? <><ellipse cx="87" cy="109" rx="35" ry="34" fill={p.coat}/><path className="spriteTail" d="M61 114 28 109 46 131 69 126Z" fill={p.accent}/><ellipse cx="99" cy="118" rx="16" ry="22" fill={p.light}/><path className="spriteWing" d="M62 96q-25 10 8 37 25-13 13-30" fill={p.accent}/><path d="m69 135-5 13m-5-1h16m22-11-2 12m-6 0h14" fill="none" stroke={p.beak ?? p.accent} strokeWidth="4"/></> : <><ellipse cx="83" cy="109" rx="46" ry="29" fill={p.coat}/><Markings p={p} clip={clip}/></>}
    {p.shape === "giraffe" && <path d="M95 103q-2-35 15-57l19 4-5 58Z" fill={p.coat}/>}
    {p.shape === "kangaroo" && <><path d="M52 114q-11 17-32 23 20 4 43-5" fill={p.coat}/><ellipse cx="104" cy="112" rx="17" ry="22" fill={p.light}/></>}
    {p.shape === "turtle" && <><path d="M39 117q-1-54 51-44 37 5 35 46Z" fill={p.accent}/><path d="m64 79 6 18-14 23m14-23h25l12-13m-12 13 4 23" fill="none" stroke={p.light} strokeWidth="3"/></>}
    {p.shape === "crocodile" && <path d="m34 96 6-16 10 9 8-15 11 9 9-12 11 10 12-8 7 14" fill={p.accent}/>}
   </>}
   <g transform={`translate(${head[0]} ${head[1]})${baby ? " scale(1.2)" : ""}`}><Head p={h}/></g>
   {headAnimal && headAnimal.id !== animal.id && <g fill={h.accent} stroke="none" opacity=".85"><circle cx="62" cy="109" r="6"/><circle cx="79" cy="119" r="4"/><circle cx="89" cy="95" r="5"/></g>}
  </g>
 </svg>;
});

export function hybridName(first: Animal, second: Animal) {
 if (first.id === second.id) return `Baby ${first.commonName.toLowerCase()}`;
 const a = first.commonName.split(" ").at(-1)!; const b = second.commonName.split(" ").at(-1)!;
 return `${a.slice(0, Math.max(2, Math.ceil(a.length / 2)))}${b.slice(Math.floor(b.length / 2)).toLowerCase()}`;
}
