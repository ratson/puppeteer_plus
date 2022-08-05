import {dirname} from 'https://deno.land/std@0.151.0/node/path.ts';
import {puppeteerDirname} from './compat.ts';

/**
 * @internal
 */
export const rootDirname = dirname(dirname(dirname(puppeteerDirname)));
