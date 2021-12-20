import { Product } from "../vendor/puppeteer/src/common/Product.ts";
import { PUPPETEER_REVISIONS } from "../vendor/puppeteer/src/revisions.ts";
import { downloadBrowser } from "./install.ts";
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

  const preferredRevision = productName === "firefox"
    ? PUPPETEER_REVISIONS.firefox
    : PUPPETEER_REVISIONS.chromium;

  const puppeteer = new PuppeteerDeno({
    projectRoot: puppeteerRootDirectory,
    preferredRevision,
    isPuppeteerCore,
    productName,
  });

  if (!isPuppeteerCore) {
    if (!Deno.env.get("PUPPETEER_EXECUTABLE_PATH")) {
      await downloadBrowser(puppeteer);
    }
  }

  return puppeteer;
};
