# puppeteer_plus

<img src="https://user-images.githubusercontent.com/10379601/29446482-04f7036a-841f-11e7-9872-91d1fc2ea683.png" height="200" align="right">

An enhanced [Puppeteer](https://github.com/puppeteer/puppeteer) running on Deno.

## Features

- Add `await using` support for `Browser`, `Page`
- Download Browser executable when necessary
- Fix PDF writing error

## Getting Started

### Installation

To use Puppeteer in your project,

```ts
import puppeteer from "https://deno.land/x/puppeteer_plus/mod.ts";
```

### puppeteer-core

```ts
import puppeteer from "https://deno.land/x/puppeteer_plus/core.ts";
```

`puppeteer-core` is intended to be a lightweight version of Puppeteer for
launching an existing browser installation or for connecting to a remote one. Be
sure that the version of puppeteer-core you install is compatible with the
browser you intend to connect to.

### Usage

Puppeteer will be familiar to people using other browser testing frameworks. You
create an instance of Browser, open pages, and then manipulate them with
[Puppeteer's API](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md).

**Example** - navigating to https://example.com and saving a screenshot as
_example.png_:

Save file as **example.js**

```ts
import puppeteer from "https://deno.land/x/puppeteer_plus/mod.ts";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto("https://example.com");
await page.screenshot({ path: "example.png" });

await browser.close();
```

Execute script on the command line

```bash
deno run -A --unstable example.js
```

Puppeteer sets an initial page size to 800×600px, which defines the screenshot
size. The page size can be customized with
[`Page.setViewport()`](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pagesetviewportviewport).

**Example** - create a PDF.

Save file as **hn.js**

```js
import puppeteer from "https://deno.land/x/puppeteer_plus/mod.ts";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto("https://news.ycombinator.com", {
  waitUntil: "networkidle2",
});
await page.pdf({ path: "hn.pdf", format: "a4" });

await browser.close();
```

Execute script on the command line

```bash
deno run -A --unstable hn.js
```

See
[`Page.pdf()`](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pagepdfoptions)
for more information about creating pdfs.

**Example** - evaluate script in the context of the page

Save file as **get-dimensions.js**

```js
import puppeteer from "https://deno.land/x/puppeteer_plus/mod.ts";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto("https://example.com");

// Get the "viewport" of the page, as reported by the page.
const dimensions = await page.evaluate(() => {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    deviceScaleFactor: window.devicePixelRatio,
  };
});

console.log("Dimensions:", dimensions);

await browser.close();
```

Execute script on the command line

```bash
deno run -A --unstable get-dimensions.js
```

See
[`Page.evaluate()`](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pageevaluatepagefunction-args)
for more information on `evaluate` and related methods like
`evaluateOnNewDocument` and `exposeFunction`.

## Known issues

- Resources is hold until 30 seconds timeout before exit, see
  [#20179](https://github.com/denoland/deno/issues/20179)

## Credits

`puppeteer_plus` is heavily inspired by
[`deno-puppeteer`](https://github.com/lucacasonato/deno-puppeteer), the key
difference is `puppeteer_plus` imports TypeScript version while `deno-puppeteer`
is using JavaScript with types.

This project will definitely not exists without the great work of
[Puppeteer](https://github.com/puppeteer/puppeteer) prject.
