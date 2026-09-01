import type { Category } from "./categories";

export function publicCatalogPresentation(approved: Category[], bundled: Category[]) {
  const approvedById = new Map(approved.map((category) => [category.id, category]));
  const blocked = bundled.filter((category) =>
    (category.trustStatus === "quarantined" || category.enabled === false)
    && !approvedById.has(category.id)
  );
  const categories = [...approved, ...blocked].sort((a, b) => {
    const aBlocked = a.trustStatus === "quarantined" || a.enabled === false ? 0 : 1;
    const bBlocked = b.trustStatus === "quarantined" || b.enabled === false ? 0 : 1;
    return aBlocked - bBlocked || a.name.localeCompare(b.name);
  });
  return { approved, blocked, categories };
}
