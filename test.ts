import { assert, assertEquals, browserTest, subprocess } from "./deps_dev.ts";

browserTest("puppeteer", async (browser) => {
  const page = await browser.newPage();
  await page.goto("https://deno.land", { waitUntil: "domcontentloaded" });
  const h1 = await page.$("h1");
  assert(h1);
  // deno-lint-ignore no-explicit-any
  assertEquals(await h1.evaluate((e: any) => e.innerText), "Deno");
});

Deno.test("core", async () => {
  await subprocess.run([
    Deno.execPath(),
    "run",
    "--unstable",
    "--allow-env=NODE_DEBUG",
    "--check",
    "core.ts",
  ], {
    check: true,
  });
});
