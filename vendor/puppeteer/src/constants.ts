import {dirname} from 'node:path';
import {puppeteerDirname} from './compat.ts';

/**
 * @internal
 */
export const rootDirname = dirname(dirname(dirname(puppeteerDirname)));
