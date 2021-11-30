import { readZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

export async function extractZip(
  zipPath: string,
  { dir }: { dir: string },
): Promise<void> {
  const z = await readZip(zipPath);
  await z.unzip(dir);
}
