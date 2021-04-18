import { PuppeteerDeno } from "./Puppeteer.ts";
import { PUPPETEER_REVISIONS } from "../vendor/puppeteer/src/revisions.ts";

async function hasPermission(desc: Deno.PermissionDescriptor, noPrompt = true) {
  let status = await Deno.permissions.query(desc);
  if (!noPrompt && status.state !== "granted") {
    status = await Deno.permissions.request(desc);
  }
  return status.state === "granted";
}

export const initializePuppeteerDeno = async (
  packageName: string,
): Promise<PuppeteerDeno> => {
  const isPuppeteerCore = packageName === "puppeteer-core";

  const puppeteerRootDirectory =
    await hasPermission({ name: "read", "path": "." }, isPuppeteerCore)
      ? Deno.cwd()
      : "/tmp";

  let productName;
  if (await hasPermission({ name: "env" }, isPuppeteerCore)) {
    productName = Deno.env.get("PUPPETEER_PRODUCT") as "chrome" | "firefox";
  }

  let preferredRevision = PUPPETEER_REVISIONS.chromium;
  if (productName == "firefox") preferredRevision = PUPPETEER_REVISIONS.firefox;

  return new PuppeteerDeno({
    projectRoot: puppeteerRootDirectory,
    preferredRevision,
    isPuppeteerCore,
    productName,
  });
};
