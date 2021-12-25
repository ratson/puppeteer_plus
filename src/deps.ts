import { unzip } from "https://deno.land/x/stdx@0.8.0/archive/zip.ts";

export { grantOrThrow } from "https://deno.land/std@0.119.0/permissions/mod.ts";

export type { Product } from "../vendor/puppeteer/src/common/Product.ts";
export { PUPPETEER_REVISIONS } from "../vendor/puppeteer/src/revisions.ts";

export function extractZip(
  zipPath: string,
  { dir }: { dir: string },
) {
  return unzip(zipPath, dir);
}
