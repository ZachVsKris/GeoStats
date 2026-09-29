export function animalPreviewEnabled() {
 return Reflect.get(process.env, "ANIMALSTATS_PREVIEW_ENABLED") === "true" ||
  (Reflect.get(process.env, "VERCEL_ENV") === "preview" && Reflect.get(process.env, "VERCEL_GIT_COMMIT_REF") === "feature/animalstats-prototype");
}
