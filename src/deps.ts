import { readZip } from "https://deno.land/x/puppeteer@5.5.1/vendor/puppeteer-core/vendor/zip/mod.ts";

export async function extractZip(
  zipPath: string,
  { dir }: { dir: string },
): Promise<void> {
  const z = await readZip(zipPath);
  await z.unzip(dir);
}
