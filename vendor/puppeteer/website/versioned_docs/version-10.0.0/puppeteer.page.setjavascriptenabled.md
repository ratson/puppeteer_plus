<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [puppeteer](./puppeteer.md) &gt; [Page](./puppeteer.page.md) &gt; [setJavaScriptEnabled](./puppeteer.page.setjavascriptenabled.md)

## Page.setJavaScriptEnabled() method

<b>Signature:</b>

```typescript
setJavaScriptEnabled(enabled: boolean): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  enabled | boolean | Whether or not to enable JavaScript on the page. |

<b>Returns:</b>

Promise&lt;void&gt;


## Remarks

NOTE: changing this value won't affect scripts that have already been run. It will take full effect on the next navigation.

