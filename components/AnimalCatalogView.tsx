"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { AnimalDataset, BoardCandidate } from "../lib/animalstats";

const Browser = dynamic(() => import("./AnimalDataBrowser"), { loading: () => <p role="status">Loading data…</p> });

export default function AnimalCatalogView({ boards, initialTab, onPlay }: { boards: BoardCandidate[]; initialTab: "categories" | "animals"; onPlay: (id: string) => void }) {
  const [data, setData] = useState<AnimalDataset | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch("/api/animals/data?scope=catalog", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Catalog unavailable");
      const payload = await response.json();
      if (payload.origin !== "release-snapshot" || !Array.isArray(payload.data?.values)) throw new Error("Catalog unavailable");
      setData(payload.data);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <section className="panel animalDataBrowser"><p role="alert">The data could not be loaded.</p><button onClick={() => setAttempt(a => a + 1)}>Try again</button></section>;
  if (!data) return <p role="status">Loading data…</p>;
  return <Browser data={data} boards={boards} initialTab={initialTab} onPlay={onPlay} />;
}
