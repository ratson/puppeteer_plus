import { unzip } from "https://deno.land/x/yxz@0.10.0/archive/zip.ts";

export { isWindows } from "https://deno.land/std@0.121.0/_util/os.ts";
export { grantOrThrow } from "https://deno.land/std@0.121.0/permissions/mod.ts";

export { denoDir } from "https://deno.land/x/yxz@0.11.0/os/path.ts";

export type { Product } from "../vendor/puppeteer/src/common/Product.ts";
export { PUPPETEER_REVISIONS } from "../vendor/puppeteer/src/revisions.ts";

export function extractZip(
  zipPath: string,
  { dir }: { dir: string },
) {
  return unzip(zipPath, dir);
}
