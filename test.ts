import { assert, assertEquals, browserTest, subprocess } from "./deps_dev.ts";

browserTest("puppeteer", async (browser) => {
  const page = await browser.newPage();
  await page.goto("https://deno.land", { waitUntil: "domcontentloaded" });
  const title = await page.$("title");
  assert(title);
  assertEquals(await title.evaluate((e) => e.innerText.split(" ")[0]), "Deno");
});

Deno.test("core", async () => {
  await subprocess.run([
    Deno.execPath(),
    "run",
    "--unstable",
    "--allow-env",
    "--no-prompt",
    "--check",
    "core.ts",
  ], {
    check: true,
  });
});
