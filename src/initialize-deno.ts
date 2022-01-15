import {
  dirname,
  fromFileUrl,
  grantOrThrow,
  Product,
  PUPPETEER_REVISIONS,
} from "./deps.ts";
import { PuppeteerDeno } from "./Puppeteer.ts";

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
  const projectRoot = dirname(dirname(fromFileUrl(import.meta.url)));

  if (!isPuppeteerCore) {
    await grantOrThrow([
      { name: "env" },
      { name: "read", path: projectRoot },
      { name: "write", path: projectRoot },
      { name: "net", host: "storage.googleapis.com" },
      { name: "run", command: "unzip" },
    ]);
  }

  const productName = isPuppeteerCore ? undefined : getProduct();

  const preferredRevision = productName === "firefox"
    ? PUPPETEER_REVISIONS.firefox
    : PUPPETEER_REVISIONS.chromium;

  const puppeteer = new PuppeteerDeno({
    projectRoot,
    preferredRevision,
    isPuppeteerCore,
    productName,
  });

  return puppeteer;
};
