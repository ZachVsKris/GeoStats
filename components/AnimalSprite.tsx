"use client";

import { memo, useId } from "react";
import type { Animal } from "../lib/animalstats";
import artwork from "../lib/animalstatsArtwork.json";

type Art = { atlas: number; frame: number[]; head: number[]; headsFrame: number[]; bodiesFrame: number[]; socket: number[]; headAnchor: number[]; atlasOutline: string; headsOutline: string; bodiesOutline: string };
type Part = "atlas" | "heads" | "bodies";
const animals: Record<string, Art> = artwork.animals;

function ArtImage({ art, kind = "atlas" }: { art: Art; kind?: Part }) {
 const clip = useId().replaceAll(":", "");
 const outline = kind === "atlas" ? art.atlasOutline : kind === "heads" ? art.headsOutline : art.bodiesOutline;
 const [x,y,w,h] = kind === "atlas" ? art.frame : kind === "heads" ? art.headsFrame : art.bodiesFrame;
 const [atlasWidth,atlasHeight] = (kind === "atlas" ? artwork.atlases : kind === "heads" ? artwork.headsAtlases : artwork.bodiesAtlases)[art.atlas-1];
 const source = `/animalstats/art-v2/${kind}-${art.atlas}.webp`;
 const optimizedSource = `/_next/image?url=${encodeURIComponent(source)}&w=1080&q=75`;
 return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden" aria-hidden="true"><defs><clipPath id={clip}><path d={outline}/></clipPath></defs><image clipPath={`url(#${clip})`} href={optimizedSource} x={-x} y={-y} width={atlasWidth} height={atlasHeight}/></svg>;
}

export const AnimalSprite = memo(function AnimalSprite({ animal, headAnimal, baby = false, className = "" }: { animal: Animal; headAnimal?: Animal; baby?: boolean; className?: string }) {
 const body = animals[animal.id];
 const head = animals[(headAnimal ?? animal).id];
 const hybrid = Boolean(headAnimal && headAnimal.id !== animal.id);
 const label = hybrid ? `${animal.commonName} body with ${headAnimal!.commonName} head — fictional hybrid` : `${baby ? "Baby " : ""}${animal.commonName}`;
 if (!body || !head) return <svg className={`animalSprite ${className}`} viewBox="0 0 180 160" role="img" aria-label={label} data-animal-id={animal.id} data-head-animal-id={headAnimal?.id ?? animal.id}><text x="90" y="80" textAnchor="middle" fontSize="12">{animal.commonName}</text></svg>;
 let [,,w,h] = hybrid ? body.bodiesFrame : body.frame;
 let headX = 0, headY = 0, headScale = 1, minX = 0, minY = 0;
 const [,,headWidth,headHeight] = head.headsFrame;
 if (hybrid) {
  // Dedicated, complete modular artwork avoids cutting through limbs, ears,
  // manes or trunks. Each body socket and head anchor is authored by species.
  const targetHeadWidth = w * Math.max(.27, body.head[2]-body.head[0]) * 1.12;
  headScale = targetHeadWidth/headWidth;
  headX = body.socket[0]*w - head.headAnchor[0]*headWidth*headScale;
  headY = body.socket[1]*h - head.headAnchor[1]*headHeight*headScale;
  minX = Math.min(0,headX); minY = Math.min(0,headY);
  w = Math.max(w,headX+headWidth*headScale)-minX;
  h = Math.max(h,headY+headHeight*headScale)-minY;
 }
 // Equal maximum silhouette extent preserves anatomy without real size clues.
 const scale = 142/Math.max(w,h);
 return <svg className={`animalSprite preciseCartoon ${baby ? "spriteBaby" : ""} ${className}`} viewBox="0 0 180 160" role="img" aria-label={label} data-animal-id={animal.id} data-head-animal-id={headAnimal?.id ?? animal.id} data-art-version={artwork.version} data-normalized-size="142">
  <title>{label}</title>
  <ellipse className="spriteShadow" cx="90" cy="148" rx="47" ry="5" fill="#233d2b" opacity=".12"/>
  <g className="spriteBounce"><g transform={`translate(${(180-w*scale)/2-minX*scale} ${145-h*scale-minY*scale}) scale(${scale})`}>
   <ArtImage art={body} kind={hybrid ? "bodies" : "atlas"}/>
   {hybrid && <g transform={`translate(${headX} ${headY}) scale(${headScale})`}><g className="preciseHead" style={{ transformOrigin: `${head.headAnchor[0]*headWidth}px ${head.headAnchor[1]*headHeight}px` }}><ArtImage art={head} kind="heads"/></g></g>}
  </g></g>
 </svg>;
});

export function hybridName(first: Animal, second: Animal) {
 if (first.id === second.id) return `Baby ${first.commonName.toLowerCase()}`;
 const a = first.commonName.split(" ").at(-1)!; const b = second.commonName.split(" ").at(-1)!;
 return `${a.slice(0, Math.max(2, Math.ceil(a.length / 2)))}${b.slice(Math.floor(b.length / 2)).toLowerCase()}`;
}
