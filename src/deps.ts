import * as subprocess from "https://deno.land/x/stdx@0.7.0/subprocess/mod.ts";

export async function extractZip(
  zipPath: string,
  { dir }: { dir: string },
): Promise<void> {
  const cmd = Deno.build.os === "windows"
    ? [
      "PowerShell",
      "Expand-Archive",
      "-Path",
      zipPath,
      "-DestinationPath",
      dir,
    ]
    : ["unzip", zipPath, "-d", dir];

  await subprocess.run(cmd, { stdout: "null", stderr: "null" });
}
