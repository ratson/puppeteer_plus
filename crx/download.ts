import { basename } from "https://deno.land/std@0.177.0/path/mod.ts";
import { download, type DownloadOptions as _DownloadOptions } from "https://deno.land/x/yxz@0.18.1/network/download.ts";
import unzip from './unzip.ts'

const computeDownloadUrl = (id: string) =>
    `https://update.googleapis.com/service/update2/crx?response=redirect&acceptformat=crx3&prodversion=111.0&testsource=download-crx&x=id%3D${id}%26installsource%3Dondemand%26uc`;

export function extractExtensionId(url: string) {
    const { pathname } = new URL(url);
    if (pathname.indexOf("/webstore/detail") !== 0) {
        throw new Error(
            "Invalid extension URL. Correct URL format: https://chrome.google.com/webstore/detail/[name]/[id] or https://chrome.google.com/webstore/detail/[id]",
        );
    }
    return basename(pathname);
}

export interface DownloadOptions {
    by?: "id" | "url";
    extract?: boolean;
    onProgress?: _DownloadOptions["onProgress"];
}

export default async function downloadExtension(
    input: string,
    outputPath: string,
    options: DownloadOptions = {},
) {
    const by = options.by === undefined
        ? (input.startsWith("https://") ? "url" : "id")
        : options.by;
    const extract = options.extract === undefined && outputPath.endsWith("/")
        ? true
        : options.extract;

    const id = by === "id" ? input : extractExtensionId(input);
    const url = computeDownloadUrl(id);
    const downloadPath = extract ? await Deno.makeTempFile() : outputPath;

    await download(url, downloadPath, { onProgress: options.onProgress });

    if (extract) {
        await unzip(downloadPath, outputPath);
    }
}
