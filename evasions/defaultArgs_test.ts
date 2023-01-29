import {
  assertArrayIncludes,
  assertStrictEquals,
  browserTest,
} from "../deps_dev.ts";
import { argsToIgnore } from "./defaultArgs.ts";

browserTest("default", async (browser) => {
  const page = await browser.newPage();
  // @ts-ignore
  page._client
  // @ts-ignore
  const { arguments: launchArgs } = await page._client().send(
    "Browser.getBrowserCommandLine",
  );
  assertArrayIncludes(launchArgs, argsToIgnore);
});

browserTest("applied", async (browser) => {
  const page = await browser.newPage();
  // @ts-ignore
  const { arguments: launchArgs } = await page._client().send(
    "Browser.getBrowserCommandLine",
  );
  for (const arg of argsToIgnore) {
    assertStrictEquals(
      launchArgs.includes(arg),
      false,
      `${arg} in ${Deno.inspect(launchArgs)}`,
    );
  }
}, { launch: { ignoreDefaultArgs: argsToIgnore } });
