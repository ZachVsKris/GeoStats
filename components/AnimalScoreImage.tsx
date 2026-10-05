"use client";

import { useState } from "react";

/** A portable result card without remote images, canvas taint or tracking URLs. */
export default function AnimalScoreImage({ total, maximum, optimal, categories, difficulty, kind, date, challengeUrl }: {
  total: number; maximum: number; optimal: number; categories: number;
  difficulty: string; kind: "daily" | "random"; date: string; challengeUrl: () => string;
}) {
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true); setStatus("");
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1000; canvas.height = 640;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#fff8e8"; ctx.fillRect(0, 0, 1000, 640);
      const font = 'Arial, sans-serif';
      const write = (text: string, x: number, y: number, size: number, color: string, bold = false) => {
        ctx.font = `${bold ? "700" : "400"} ${size}px ${font}`;
        ctx.fillStyle = color; ctx.fillText(text, x, y);
      };
      // Draw a paw with native shapes; platform emoji and animal photos are not
      // needed to generate the image consistently or to keep the canvas safe.
      ctx.fillStyle = "#cc4c35";
      for (const [x, y, rx, ry] of [[85, 67, 10, 15], [107, 57, 10, 15], [128, 66, 10, 15], [109, 99, 25, 18]]) {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      }
      write("AnimalStats", 152, 97, 49, "#233a35", true);
      ctx.strokeStyle = "#dcc6a2"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(56, 195); ctx.lineTo(944, 195); ctx.stroke();
      write(`${difficulty} ${kind === "daily" ? "Daily" : "Random"}`, 56, 251, 28, "#247c56", true);
      if (kind === "daily") { ctx.textAlign = "right"; write(date, 944, 251, 24, "#657066"); ctx.textAlign = "left"; }
      write(String(total), 56, 391, 112, "#233a35", true);
      ctx.font = `700 112px ${font}`;
      const scoreWidth = ctx.measureText(String(total)).width;
      write(`/ ${maximum}`, 76 + scoreWidth, 391, 46, "#657066");
      write(`Optimal Choices: ${optimal} of ${categories}`, 56, 465, 33, "#233a35", true);
      ctx.beginPath(); ctx.moveTo(56, 506); ctx.lineTo(944, 506); ctx.stroke();
      write("Countries, Animals & Things", 56, 567, 26, "#233a35", true);
      ctx.textAlign = "right"; write("animals.geostats.xyz", 944, 567, 26, "#cc4c35", true);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image unavailable")), "image/png"));
      setImage({ url: canvas.toDataURL("image/png"), file: new File([blob], "animalstats-score.png", { type: "image/png" }) });
    } catch {
      setStatus("The image could not be created. You can still copy your score.");
    } finally { setBusy(false); }
  }

  async function share() {
    if (!image) return;
    try {
      if (navigator.share && navigator.canShare?.({ files: [image.file] })) {
        await navigator.share({ files: [image.file], title: "AnimalStats score", text: challengeUrl() });
      } else setStatus("Download the image, then attach it to your message.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Sharing is unavailable here. Download the image to attach it instead.");
    }
  }

  return <>
    <button type="button" className="secondaryScoreAction" disabled={busy} onClick={() => void create()}>{busy ? "Creating image…" : "Score image"}</button>
    {image && <div className="scoreImagePreview"><img src={image.url} alt={`AnimalStats ${difficulty} score: ${total} out of ${maximum}; ${optimal} of ${categories} optimal choices`} /><div><button type="button" onClick={() => void share()}>Share image</button><a href={image.url} download="animalstats-score.png">Download image</a><button type="button" onClick={() => { setImage(null); setStatus(""); }}>Close preview</button></div></div>}
    {status && <p role="status">{status}</p>}
  </>;
}
