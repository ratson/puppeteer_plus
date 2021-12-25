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

export function getProduct(): Product {
  const product = Deno.env.get("PUPPETEER_PRODUCT") || "chrome";
  if (product !== "chrome" && product !== "firefox") {
    if (product !== undefined) {
      console.warn(`Unknown product '${product}', falling back to 'chrome'.`);
    }
    return "chrome";
  }
  return product;
}

export const initializePuppeteerDeno = async (
  packageName: string,
): Promise<PuppeteerDeno> => {
  const isPuppeteerCore = packageName === "puppeteer-core";

  const puppeteerRootDirectory =
    await hasPermission({ name: "read", "path": "." }, isPuppeteerCore)
      ? Deno.cwd()
      : "/tmp";

  const productName = isPuppeteerCore ? undefined : getProduct();

  const preferredRevision = productName === "firefox"
    ? PUPPETEER_REVISIONS.firefox
    : PUPPETEER_REVISIONS.chromium;

  const puppeteer = new PuppeteerDeno({
    projectRoot: puppeteerRootDirectory,
    preferredRevision,
    isPuppeteerCore,
    productName,
  });

  return puppeteer;
};
