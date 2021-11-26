import { assertStrictEquals, browserTest } from "../deps_dev.ts";
import {
  args,
  deleteNavigatorWebdriverProperty,
} from "./navigator.webdriver.ts";

// Expecting the input string to be in one of these formats:
// - The UA string
// - The shorter version string from Puppeteers browser.version()
// - The shortest four-integer string
function parseLooseVersionString(looseVersionString: string) {
  const m = looseVersionString
    .match(/(\d+\.){3}\d+/);
  if (!m) return [];
  return m[0].split(".")
    .map((x) => parseInt(x));
}

function compareLooseVersionStrings(version0: string, version1: string) {
  const parsed0 = parseLooseVersionString(version0);
  const parsed1 = parseLooseVersionString(version1);
  assertStrictEquals(parsed0.length, 4);
  assertStrictEquals(parsed1.length, 4);
  for (let i = 0; i < parsed0.length; i++) {
    if (parsed0[i] < parsed1[i]) {
      return -1;
    } else if (parsed0[i] > parsed1[i]) {
      return 1;
    }
  }
  return 0;
}

function getExpectedValue(looseVersionString: string) {
  if (compareLooseVersionStrings(looseVersionString, "89.0.4339.0") >= 0) {
    return false;
  } else {
    return undefined;
  }
}

browserTest("default", async (browser) => {
  const page = await browser.newPage();

  const data = await page.evaluate(() =>
    // @ts-expect-error non-standard property
    navigator.webdriver
  );

  assertStrictEquals(data, true);
});

browserTest("navigator.webdriver is undefined", async (browser) => {
  const page = await browser.newPage();
  await deleteNavigatorWebdriverProperty(page);

  const data = await page.evaluate(() =>
    // @ts-expect-error non-standard
    navigator.webdriver
  );

  assertStrictEquals(data, getExpectedValue(await browser.version()));
}, { launch: { args } });

// https://github.com/berstend/puppeteer-extra/pull/130
browserTest("keep other navigator methods", async (browser) => {
  const page = await browser.newPage();

  try {
    const data = await page.evaluate(() =>
      // @ts-expect-error non-standard
      navigator.javaEnabled()
    );
    assertStrictEquals(data, false);
  } catch (err) {
    assertStrictEquals(err, undefined);
  }
}, { launch: { args } });
