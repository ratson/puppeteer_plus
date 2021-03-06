<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [puppeteer](./puppeteer.md) &gt; [Page](./puppeteer.page.md) &gt; [tap](./puppeteer.page.tap.md)

## Page.tap() method

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [Page.touchscreen](./puppeteer.page.touchscreen.md) to tap in the center of the element. If there's no element matching `selector`, the method throws an error.

<b>Signature:</b>

```typescript
tap(selector: string): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  selector | string | A [Selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) to search for element to tap. If there are multiple elements satisfying the selector, the first will be tapped. |

<b>Returns:</b>

Promise&lt;void&gt;


## Remarks

Shortcut for [page.mainFrame().tap(selector)](./puppeteer.frame.tap.md).

