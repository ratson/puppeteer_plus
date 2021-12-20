import ProgressBar from "https://deno.land/x/progress@v1.2.5/mod.ts";
import { PUPPETEER_REVISIONS } from "../vendor/puppeteer/src/revisions.ts";
import { PuppeteerDeno } from "./Puppeteer.ts";

const supportedProducts = {
  chrome: "Chromium",
  firefox: "Firefox Nightly",
} as const;

function getProduct() {
  const product = Deno.env.get("PUPPETEER_PRODUCT") || "chrome";
  if (product !== "chrome" && product !== "firefox") {
    if (product !== undefined) {
      console.warn(`Unknown product '${product}', falling back to 'chrome'.`);
    }
    return "chrome";
  }
  return product;
}

async function getRevision(product: string) {
  switch (product) {
    case "firefox": {
      const req = await fetch(
        "https://product-details.mozilla.org/1.0/firefox_versions.json",
      );
      const versions = await req.json();
      return versions.FIREFOX_NIGHTLY;
    }
    case "chrome":
    default:
      return (
        Deno.env.get("PUPPETEER_CHROMIUM_REVISION") ||
        PUPPETEER_REVISIONS.chromium
      );
  }
}

export async function downloadBrowser(puppeteer: PuppeteerDeno) {
  const downloadHost = Deno.env.get("PUPPETEER_DOWNLOAD_HOST");
  const downloadPath = Deno.env.get("PUPPETEER_DOWNLOAD_PATH");
  const product = getProduct();

  const browserFetcher = puppeteer.createBrowserFetcher({
    product,
    host: downloadHost,
    path: downloadPath,
  });
  if (product === "firefox") {
    puppeteer._preferredRevision = PUPPETEER_REVISIONS.firefox;
  }

  const revision = await getRevision(product);
  const revisionInfo = browserFetcher.revisionInfo(revision);

  // Do nothing if the revision is already downloaded.
  if (revisionInfo.local) {
    console.log(
      `${
        supportedProducts[product]
      } is already in ${revisionInfo.folderPath}; skipping download.`,
    );
    return;
  }

  let progressBar: ProgressBar;
  const newRevisionInfo = await browserFetcher.download(
    revisionInfo.revision,
    (current, total) => {
      if (!progressBar) {
        progressBar = new ProgressBar({ total });
      }
      // deno-lint-ignore no-explicit-any
      if (!(progressBar as any).isCompleted) {
        progressBar.render(current);
      } else {
        console.log("Done downloading. Installing now.");
      }
    },
  );
  console.log(
    `Downloaded ${newRevisionInfo.product} ${newRevisionInfo.revision} to ${newRevisionInfo.executablePath} from ${newRevisionInfo.url}`,
  );
}
