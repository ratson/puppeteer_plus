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
  const { code, stdout, stderr } = await command.output();
  assertEquals(code, 0);
  assertEquals(new TextDecoder().decode(stdout), "");
  assertEquals(new TextDecoder().decode(stderr), "");
});

Deno.test("fs.open does not return FileHandle", async () => {
  const fileHandle = await fs.open(await Deno.makeTempFile(), "w+");
  assert(!fileHandle.writeFile);
  fileHandle.close();
});

Deno.test("cannot download from https", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--unstable",
      "-A",
      "--check",
      "mod.ts",
    ],
    env: {
      "PUPPETEER_CACHE_DIR": "/tmp",
      "PUPPETEER_DOWNLOAD_BASE_URL":
        "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing",
    },
  });
  const { stderr } = await command.output();
  assert(
    new TextDecoder().decode(stderr).includes(
      '[ERR_INVALID_PROTOCOL]"https:" not supported. Expected "http:"',
    ),
  );
});
