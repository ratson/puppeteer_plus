import puppeteer from "../mod.ts";

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on("request", (request) => {
  if (request.resourceType() === "image") request.abort();
  else request.continue();
});
await page.goto("https://news.google.com/news/");

const tempFilePath = await Deno.makeTempFile({ suffix: ".png" });
await page.screenshot({ path: tempFilePath, fullPage: true });

await browser.close();

console.log(tempFilePath);
