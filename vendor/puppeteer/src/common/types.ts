/**
 * Copyright 2020 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {JSHandle} from './JSHandle.ts';
import {ElementHandle} from './ElementHandle.ts';

/**
 * @public
 */
export type Awaitable<T> = T | PromiseLike<T>;

/**
 * @public
 */
// @ts-expect-error TS2304
export type HandleFor<T> = T extends Node ? ElementHandle<T> : JSHandle<T>;

/**
 * @public
 */
export type HandleOr<T> = HandleFor<T> | JSHandle<T> | T;

/**
 * @public
 */
export type FlattenHandle<T> = T extends HandleOr<infer U> ? U : never;
/**
 * @public
 */
export type InnerParams<T extends unknown[]> = {
  [K in keyof T]: FlattenHandle<T[K]>;
};

/**
 * @public
 */
export type EvaluateFunc<T extends unknown[]> = (
  ...params: InnerParams<T>
) => Awaitable<unknown>;

/**
 * @public
 */
export type NodeFor<Selector extends string> =
  // @ts-expect-error TS2304
  Selector extends keyof HTMLElementTagNameMap
    // @ts-expect-error TS2304
    ? HTMLElementTagNameMap[Selector]
    // @ts-expect-error TS2304
    : Selector extends keyof SVGElementTagNameMap
    // @ts-expect-error TS2304
    ? SVGElementTagNameMap[Selector]
    // @ts-expect-error TS2304
    : Element;
