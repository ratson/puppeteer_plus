import * as subprocess from "https://deno.land/x/stdx@0.7.0/subprocess/mod.ts";

export { grantOrThrow } from "https://deno.land/std@0.119.0/permissions/mod.ts";

export type { Product } from "../vendor/puppeteer/src/common/Product.ts";
export { PUPPETEER_REVISIONS } from "../vendor/puppeteer/src/revisions.ts";

export async function extractZip(
  zipPath: string,
  { dir }: { dir: string },
): Promise<void> {
  const cmd = Deno.build.os === "windows"
    ? [
      "PowerShell",
      "Expand-Archive",
      "-Path",
      zipPath,
      "-DestinationPath",
      dir,
    ]
    : ["unzip", zipPath, "-d", dir];

  await subprocess.run(cmd, { stdout: "null", stderr: "null" });
}
