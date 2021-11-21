import { Product } from "../vendor/puppeteer/src/common/Product.ts";
import { PUPPETEER_REVISIONS } from "../vendor/puppeteer/src/revisions.ts";
import { PuppeteerDeno } from "./Puppeteer.ts";

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

  let productName: Product | undefined;
  if (await hasPermission({ name: "env" }, isPuppeteerCore)) {
    productName = Deno.env.get("PUPPETEER_PRODUCT") as Product;
  }

  let preferredRevision = PUPPETEER_REVISIONS.chromium;
  if (productName == "firefox") preferredRevision = PUPPETEER_REVISIONS.firefox;

  const puppeteer = new PuppeteerDeno({
    projectRoot: puppeteerRootDirectory,
    preferredRevision,
    isPuppeteerCore,
    productName,
  });

  return puppeteer;
};
