import { assert, assertEquals, browserTest } from "./deps_dev.ts";
import * as fs from "node:fs/promises";

browserTest("puppeteer", async (browser) => {
  const page = await browser.newPage();
  await page.goto("https://deno.land", { waitUntil: "domcontentloaded" });
  const title = await page.$("title");
  assert(title);
  assertEquals(await title.evaluate((e) => e.innerText.split(" ")[0]), "Deno");
});

Deno.test("core", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--unstable",
      "--allow-env",
      "--no-prompt",
      "--check",
      "core.ts",
    ],
  });
  const { code, stdout, stderr } = await command.output();
  assertEquals(code, 0);
  assertEquals(new TextDecoder().decode(stdout), "");
  assertEquals(new TextDecoder().decode(stderr), "");
});

Deno.test("fs", async () => {
  const fileHandle = await fs.open(await Deno.makeTempFile(), "w+");
  assert(!fileHandle.writeFile);
  assert(!fileHandle.close);
  Deno.close(Number(fileHandle));
});
