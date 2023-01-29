import process from 'node:process';
import * as os from 'node:os';

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
