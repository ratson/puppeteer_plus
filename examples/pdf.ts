import { launch } from "../mod.ts";

await using browser = await launch();
await using page = await browser.newPage();
await page.goto("https://news.ycombinator.com", {
  waitUntil: "networkidle2",
});

const tempFilePath = await Deno.makeTempFile({ suffix: ".pdf" });
await page.pdf({ path: tempFilePath, format: "a4" });

console.log(tempFilePath);
Deno.exit();
