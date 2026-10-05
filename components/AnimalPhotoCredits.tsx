"use client";

import { useRef } from "react";
import type { Animal, AnimalPhoto } from "../lib/animalstats";
import useGameDialog from "./useGameDialog";

const LICENSE_URLS: Record<string, string> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "Public domain": "https://creativecommons.org/publicdomain/mark/1.0/",
};

export default function AnimalPhotoCredits({ photos, animals, onClose }: {
  photos: AnimalPhoto[]; animals: Animal[]; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGameDialog(true, ref, onClose);
  const names = new Map(animals.map(animal => [animal.id, animal.commonName]));
  return <div className="sourceModal" role="dialog" aria-modal="true" aria-label="Animal photo credits" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="sourcePanel sourcePanelSimple" ref={ref}>
      <button className="sourceClose" aria-label="Close photo credits" onClick={onClose}>×</button>
      <h2>Photo credits</h2>
      <p>Photos are resized and displayed in cropped frames. Original files and licenses are linked below.</p>
      <ul className="animalPhotoCredits">{photos.filter(photo => photo.approved && !photo.assetUrl.endsWith(".svg")).map(photo => <li key={photo.animalId}>
        <strong>{names.get(photo.animalId)}</strong><span>{photo.creator}</span>
        <a href={photo.originalUrl} target="_blank" rel="noreferrer">Original photo</a>
        {LICENSE_URLS[photo.license] ? <a href={LICENSE_URLS[photo.license]} target="_blank" rel="noreferrer">{photo.license}</a> : <span>{photo.license}</span>}
      </li>)}</ul>
    </div>
  </div>;
}
