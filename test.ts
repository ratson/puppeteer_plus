import * as fs from "node:fs/promises";
import { assert, assertEquals, browserTest } from "./deps_dev.ts";

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
      "--allow-read",
      "--no-prompt",
      "--check",
      "core.ts",
    ],
  });
  const { code, stdout } = await command.output();
  assertEquals(code, 0);
  assertEquals(new TextDecoder().decode(stdout), "");
});

Deno.test("fs.open return FileHandle", async () => {
  const fileHandle = await fs.open(await Deno.makeTempFile(), "w+");
  assertEquals(typeof fileHandle.writeFile, "function");
  fileHandle.close();
});
