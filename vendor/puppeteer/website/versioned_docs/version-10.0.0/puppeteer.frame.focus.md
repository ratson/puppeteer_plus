<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [puppeteer](./puppeteer.md) &gt; [Frame](./puppeteer.frame.md) &gt; [focus](./puppeteer.frame.focus.md)

## Frame.focus() method

This method fetches an element with `selector` and focuses it.

<b>Signature:</b>

```typescript
focus(selector: string): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  selector | string | the selector for the element to focus. If there are multiple elements, the first will be focused. |

<b>Returns:</b>

Promise&lt;void&gt;

## Remarks

If there's no element matching `selector`, the method throws an error.

