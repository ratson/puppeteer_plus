import process from 'https://deno.land/std@0.151.0/node/process.ts';
import * as os from 'https://deno.land/std@0.151.0/node/os.ts';

/**
 * Gets the temporary directory, either from the environmental variable
 * `PUPPETEER_TMP_DIR` or the `os.tmpdir`.
 *
 * @returns The temporary directory path.
 *
 * @internal
 */
export const tmpdir = (): string => {
  return process.env['PUPPETEER_TMP_DIR'] || os.tmpdir();
};
