"use client";

import { useRef } from "react";
import type { Animal, AnimalPhoto } from "../lib/animalstats";
import useGameDialog from "./useGameDialog";

export default function AnimalPhotoGallery({ animals, photos, onClose }: { animals: Animal[]; photos: AnimalPhoto[]; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useGameDialog(true, panel, onClose);
  const byId = new Map(photos.filter(p => p.approved).map(p => [p.animalId, p]));
  return <div className="sourceModal" role="dialog" aria-modal="true" aria-labelledby="animalPhotoGalleryTitle" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className="sourcePanel animalPhotoGallery">
      <button className="sourceClose" aria-label="Close animal photos" onClick={onClose}>×</button>
      <h2 id="animalPhotoGalleryTitle">Animal photos</h2>
      <div className="animalPhotoGalleryGrid">{animals.map(animal => {
        const photo = byId.get(animal.id);
        return photo && <figure key={animal.id}><img src={photo.assetUrl} alt={animal.commonName} draggable={false} /><figcaption><strong>{animal.commonName}</strong><small>{photo.creator} · {photo.license}</small><a href={photo.originalUrl} target="_blank" rel="noreferrer">Original photo ↗</a></figcaption></figure>;
      })}</div>
    </div>
  </div>;
}
