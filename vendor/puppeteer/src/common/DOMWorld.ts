/**
 * Copyright 2019 Google Inc. All rights reserved.
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

import { assert } from './assert.ts';
import { helper, debugError } from './helper.ts';
import {
  LifecycleWatcher,
  PuppeteerLifeCycleEvent,
} from './LifecycleWatcher.ts';
import { TimeoutError } from './Errors.ts';
import { JSHandle, ElementHandle } from './JSHandle.ts';
import { ExecutionContext } from './ExecutionContext.ts';
import { TimeoutSettings } from './TimeoutSettings.ts';
import { MouseButton } from './Input.ts';
import { FrameManager, Frame } from './FrameManager.ts';
import { getQueryHandlerAndSelector } from './QueryHandler.ts';
import {
  SerializableOrJSHandle,
  EvaluateHandleFn,
  WrapElementHandle,
  EvaluateFn,
  EvaluateFnReturnType,
  UnwrapPromiseLike,
} from './EvalTypes.ts';
import { isNode } from '../environment.ts';
import { Protocol } from '../../../devtools-protocol/types/protocol.d.ts';
import { CDPSession } from './Connection.ts';

// predicateQueryHandler and checkWaitForOptions are declared here so that
// TypeScript knows about them when used in the predicate function below.
declare const predicateQueryHandler: (
  // @ts-expect-error TS2304
  element: Element | Document,
  selector: string
// @ts-expect-error TS2304
) => Promise<Element | Element[] | NodeListOf<Element>>;
declare const checkWaitForOptions: (
  // @ts-expect-error TS2304
  node: Node,
  waitForVisible: boolean,
  waitForHidden: boolean
// @ts-expect-error TS2304
) => Element | null | boolean;

/**
 * @public
 */
export interface WaitForSelectorOptions {
  visible?: boolean;
  hidden?: boolean;
  timeout?: number;
  root?: ElementHandle;
}

/**
 * @internal
 */
export interface PageBinding {
  name: string;
  pptrFunction: Function;
}

/**
 * @internal
 */
export class DOMWorld {
  private _frameManager: FrameManager;
  private _client: CDPSession;
  private _frame: Frame;
  private _timeoutSettings: TimeoutSettings;
  // @ts-expect-error TS2322
  private _documentPromise?: Promise<ElementHandle> = null;
  // @ts-expect-error TS2322
  private _contextPromise?: Promise<ExecutionContext> = null;

  // @ts-expect-error TS2322
  private _contextResolveCallback?: (x?: ExecutionContext) => void = null;

  private _detached = false;
  /**
   * @internal
   */
  _waitTasks = new Set<WaitTask>();

  /**
   * @internal
   * Contains mapping from functions that should be bound to Puppeteer functions.
   */
  _boundFunctions = new Map<string, Function>();
  // Set of bindings that have been registered in the current context.
  private _ctxBindings = new Set<string>();
  private static bindingIdentifier = (name: string, contextId: number) =>
    `${name}_${contextId}`;

  constructor(
    client: CDPSession,
    frameManager: FrameManager,
    frame: Frame,
    timeoutSettings: TimeoutSettings
  ) {
    // Keep own reference to client because it might differ from the FrameManager's
    // client for OOP iframes.
    this._client = client;
    this._frameManager = frameManager;
    this._frame = frame;
    this._timeoutSettings = timeoutSettings;
    // @ts-expect-error TS2345
    this._setContext(null);
    this._client.on('Runtime.bindingCalled', (event) =>
      this._onBindingCalled(event)
    );
  }

  frame(): Frame {
    return this._frame;
  }

  async _setContext(context?: ExecutionContext): Promise<void> {
    if (context) {
      assert(
        this._contextResolveCallback,
        'Execution Context has already been set.'
      );
      this._ctxBindings.clear();
      this._contextResolveCallback.call(null, context);
      // @ts-expect-error TS2322
      this._contextResolveCallback = null;
      for (const waitTask of this._waitTasks) waitTask.rerun();
    } else {
      // @ts-expect-error TS2322
      this._documentPromise = null;
      this._contextPromise = new Promise((fulfill) => {
        // @ts-expect-error TS2322
        this._contextResolveCallback = fulfill;
      });
    }
  }

  _hasContext(): boolean {
    return !this._contextResolveCallback;
  }

  _detach(): void {
    this._detached = true;
    for (const waitTask of this._waitTasks)
      waitTask.terminate(
        new Error('waitForFunction failed: frame got detached.')
      );
  }

  executionContext(): Promise<ExecutionContext> {
    if (this._detached)
      throw new Error(
        `Execution context is not available in detached frame "${this._frame.url()}" (are you trying to evaluate?)`
      );
    // @ts-expect-error TS2322
    return this._contextPromise;
  }

  async evaluateHandle<HandlerType extends JSHandle = JSHandle>(
    pageFunction: EvaluateHandleFn,
    ...args: SerializableOrJSHandle[]
  ): Promise<HandlerType> {
    const context = await this.executionContext();
    return context.evaluateHandle(pageFunction, ...args);
  }

  async evaluate<T extends EvaluateFn>(
    pageFunction: T,
    ...args: SerializableOrJSHandle[]
  ): Promise<UnwrapPromiseLike<EvaluateFnReturnType<T>>> {
    const context = await this.executionContext();
    return context.evaluate<UnwrapPromiseLike<EvaluateFnReturnType<T>>>(
      pageFunction,
      ...args
    );
  }

  // @ts-expect-error TS2304
  async $<T extends Element = Element>(
    selector: string
  ): Promise<ElementHandle<T> | null> {
    const document = await this._document();
    const value = await document.$<T>(selector);
    return value;
  }

  async _document(): Promise<ElementHandle> {
    if (this._documentPromise) return this._documentPromise;
    // @ts-expect-error TS2322
    this._documentPromise = this.executionContext().then(async (context) => {
      const document = await context.evaluateHandle('document');
      return document.asElement();
    });
    // @ts-expect-error TS2322
    return this._documentPromise;
  }

  async $x(expression: string): Promise<ElementHandle[]> {
    const document = await this._document();
    const value = await document.$x(expression);
    return value;
  }

  async $eval<ReturnType>(
    selector: string,
    pageFunction: (
      // @ts-expect-error TS2304
      element: Element,
      ...args: unknown[]
    ) => ReturnType | Promise<ReturnType>,
    ...args: SerializableOrJSHandle[]
  ): Promise<WrapElementHandle<ReturnType>> {
    const document = await this._document();
    return document.$eval<ReturnType>(selector, pageFunction, ...args);
  }

  async $$eval<ReturnType>(
    selector: string,
    pageFunction: (
      // @ts-expect-error TS2304
      elements: Element[],
      ...args: unknown[]
    ) => ReturnType | Promise<ReturnType>,
    ...args: SerializableOrJSHandle[]
  ): Promise<WrapElementHandle<ReturnType>> {
    const document = await this._document();
    const value = await document.$$eval<ReturnType>(
      selector,
      pageFunction,
      ...args
    );
    return value;
  }

  // @ts-expect-error TS2304
  async $$<T extends Element = Element>(
    selector: string
  ): Promise<Array<ElementHandle<T>>> {
    const document = await this._document();
    const value = await document.$$<T>(selector);
    return value;
  }

  async content(): Promise<string> {
    return await this.evaluate(() => {
      let retVal = '';
      // @ts-expect-error TS2584
      if (document.doctype)
        // @ts-expect-error TS2304
        retVal = new XMLSerializer().serializeToString(document.doctype);
      // @ts-expect-error TS2584
      if (document.documentElement)
        // @ts-expect-error TS2584
        retVal += document.documentElement.outerHTML;
      return retVal;
    });
  }

  async setContent(
    html: string,
    options: {
      timeout?: number;
      waitUntil?: PuppeteerLifeCycleEvent | PuppeteerLifeCycleEvent[];
    } = {}
  ): Promise<void> {
    const {
      waitUntil = ['load'],
      timeout = this._timeoutSettings.navigationTimeout(),
    } = options;
    // We rely upon the fact that document.open() will reset frame lifecycle with "init"
    // lifecycle event. @see https://crrev.com/608658
    await this.evaluate<(x: string) => void>((html) => {
      // @ts-expect-error TS2584
      document.open();
      // @ts-expect-error TS2584
      document.write(html);
      // @ts-expect-error TS2584
      document.close();
    }, html);
    const watcher = new LifecycleWatcher(
      this._frameManager,
      this._frame,
      waitUntil,
      timeout
    );
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise(),
      watcher.lifecyclePromise(),
    ]);
    watcher.dispose();
    if (error) throw error;
  }

  /**
   * Adds a script tag into the current context.
   *
   * @remarks
   *
   * You can pass a URL, filepath or string of contents. Note that when running Puppeteer
   * in a browser environment you cannot pass a filepath and should use either
   * `url` or `content`.
   */
  async addScriptTag(options: {
    url?: string;
    path?: string;
    content?: string;
    id?: string;
    type?: string;
  }): Promise<ElementHandle> {
    const {
      url = null,
      path = null,
      content = null,
      id = '',
      type = '',
    } = options;
    if (url !== null) {
      try {
        const context = await this.executionContext();
        // @ts-expect-error TS2322
        return (
          await context.evaluateHandle(addScriptUrl, url, id, type)
        ).asElement();
      } catch (error) {
        throw new Error(`Loading script from ${url} failed`);
      }
    }

    if (path !== null) {
      if (!isNode) {
        throw new Error(
          'Cannot pass a filepath to addScriptTag in the browser environment.'
        );
      }
      const fs = await helper.importFSModule();
      let contents = await fs.promises.readFile(path, 'utf8');
      contents += '//# sourceURL=' + path.replace(/\n/g, '');
      const context = await this.executionContext();
      // @ts-expect-error TS2322
      return (
        await context.evaluateHandle(addScriptContent, contents, id, type)
      ).asElement();
    }

    if (content !== null) {
      const context = await this.executionContext();
      // @ts-expect-error TS2322
      return (
        await context.evaluateHandle(addScriptContent, content, id, type)
      ).asElement();
    }

    throw new Error(
      'Provide an object with a `url`, `path` or `content` property'
    );

    async function addScriptUrl(
      url: string,
      id: string,
      type: string
    // @ts-expect-error TS2304
    ): Promise<HTMLElement> {
      // @ts-expect-error TS2584
      const script = document.createElement('script');
      script.src = url;
      if (id) script.id = id;
      if (type) script.type = type;
      const promise = new Promise((res, rej) => {
        script.onload = res;
        script.onerror = rej;
      });
      // @ts-expect-error TS2584
      document.head.appendChild(script);
      await promise;
      return script;
    }

    function addScriptContent(
      content: string,
      id: string,
      type = 'text/javascript'
    // @ts-expect-error TS2304
    ): HTMLElement {
      // @ts-expect-error TS2584
      const script = document.createElement('script');
      script.type = type;
      script.text = content;
      if (id) script.id = id;
      let error = null;
      // @ts-expect-error TS7006
      script.onerror = (e) => (error = e);
      // @ts-expect-error TS2584
      document.head.appendChild(script);
      if (error) throw error;
      return script;
    }
  }

  /**
   * Adds a style tag into the current context.
   *
   * @remarks
   *
   * You can pass a URL, filepath or string of contents. Note that when running Puppeteer
   * in a browser environment you cannot pass a filepath and should use either
   * `url` or `content`.
   *
   */
  async addStyleTag(options: {
    url?: string;
    path?: string;
    content?: string;
  }): Promise<ElementHandle> {
    const { url = null, path = null, content = null } = options;
    if (url !== null) {
      try {
        const context = await this.executionContext();
        // @ts-expect-error TS2322
        return (await context.evaluateHandle(addStyleUrl, url)).asElement();
      } catch (error) {
        throw new Error(`Loading style from ${url} failed`);
      }
    }

    if (path !== null) {
      if (!isNode) {
        throw new Error(
          'Cannot pass a filepath to addStyleTag in the browser environment.'
        );
      }
      const fs = await helper.importFSModule();
      let contents = await fs.promises.readFile(path, 'utf8');
      contents += '/*# sourceURL=' + path.replace(/\n/g, '') + '*/';
      const context = await this.executionContext();
      // @ts-expect-error TS2322
      return (
        await context.evaluateHandle(addStyleContent, contents)
      ).asElement();
    }

    if (content !== null) {
      const context = await this.executionContext();
      // @ts-expect-error TS2322
      return (
        await context.evaluateHandle(addStyleContent, content)
      ).asElement();
    }

    throw new Error(
      'Provide an object with a `url`, `path` or `content` property'
    );

    // @ts-expect-error TS2304
    async function addStyleUrl(url: string): Promise<HTMLElement> {
      // @ts-expect-error TS2584
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      const promise = new Promise((res, rej) => {
        link.onload = res;
        link.onerror = rej;
      });
      // @ts-expect-error TS2584
      document.head.appendChild(link);
      await promise;
      return link;
    }

    // @ts-expect-error TS2304
    async function addStyleContent(content: string): Promise<HTMLElement> {
      // @ts-expect-error TS2584
      const style = document.createElement('style');
      style.type = 'text/css';
      // @ts-expect-error TS2584
      style.appendChild(document.createTextNode(content));
      const promise = new Promise((res, rej) => {
        style.onload = res;
        style.onerror = rej;
      });
      // @ts-expect-error TS2584
      document.head.appendChild(style);
      await promise;
      return style;
    }
  }

  async click(
    selector: string,
    options: { delay?: number; button?: MouseButton; clickCount?: number }
  ): Promise<void> {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.click(options);
    await handle.dispose();
  }

  async focus(selector: string): Promise<void> {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.focus();
    await handle.dispose();
  }

  async hover(selector: string): Promise<void> {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.hover();
    await handle.dispose();
  }

  async select(selector: string, ...values: string[]): Promise<string[]> {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    const result = await handle.select(...values);
    await handle.dispose();
    return result;
  }

  async tap(selector: string): Promise<void> {
    const handle = await this.$(selector);
    // @ts-expect-error TS2531
    await handle.tap();
    // @ts-expect-error TS2531
    await handle.dispose();
  }

  async type(
    selector: string,
    text: string,
    options?: { delay: number }
  ): Promise<void> {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.type(text, options);
    await handle.dispose();
  }

  async waitForSelector(
    selector: string,
    options: WaitForSelectorOptions
  ): Promise<ElementHandle | null> {
    const { updatedSelector, queryHandler } =
      getQueryHandlerAndSelector(selector);
    // @ts-expect-error TS2722
    return queryHandler.waitFor(this, updatedSelector, options);
  }

  // If multiple waitFor are set up asynchronously, we need to wait for the
  // first one to set up the binding in the page before running the others.
  private _settingUpBinding: Promise<void> | null = null;
  /**
   * @internal
   */
  async addBindingToContext(
    context: ExecutionContext,
    name: string
  ): Promise<void> {
    // Previous operation added the binding so we are done.
    if (
      this._ctxBindings.has(
        DOMWorld.bindingIdentifier(name, context._contextId)
      )
    ) {
      return;
    }
    // Wait for other operation to finish
    if (this._settingUpBinding) {
      await this._settingUpBinding;
      return this.addBindingToContext(context, name);
    }

    const bind = async (name: string) => {
      const expression = helper.pageBindingInitString('internal', name);
      try {
        // TODO: In theory, it would be enough to call this just once
        await context._client.send('Runtime.addBinding', {
          name,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore The protocol definition is not up to date.
          executionContextName: context._contextName,
        });
        await context.evaluate(expression);
      } catch (error) {
        // We could have tried to evaluate in a context which was already
        // destroyed. This happens, for example, if the page is navigated while
        // we are trying to add the binding
        const ctxDestroyed = error.message.includes(
          'Execution context was destroyed'
        );
        const ctxNotFound = error.message.includes(
          'Cannot find context with specified id'
        );
        if (ctxDestroyed || ctxNotFound) {
          return;
        } else {
          debugError(error);
          return;
        }
      }
      this._ctxBindings.add(
        DOMWorld.bindingIdentifier(name, context._contextId)
      );
    };

    this._settingUpBinding = bind(name);
    await this._settingUpBinding;
    this._settingUpBinding = null;
  }

  private async _onBindingCalled(
    event: Protocol.Runtime.BindingCalledEvent
  ): Promise<void> {
    let payload: { type: string; name: string; seq: number; args: unknown[] };
    if (!this._hasContext()) return;
    const context = await this.executionContext();
    try {
      payload = JSON.parse(event.payload);
    } catch {
      // The binding was either called by something in the page or it was
      // called before our wrapper was initialized.
      return;
    }
    const { type, name, seq, args } = payload;
    if (
      type !== 'internal' ||
      !this._ctxBindings.has(
        DOMWorld.bindingIdentifier(name, context._contextId)
      )
    )
      return;
    if (context._contextId !== event.executionContextId) return;
    try {
      // @ts-expect-error TS2722
      const result = await this._boundFunctions.get(name)(...args);
      await context.evaluate(deliverResult, name, seq, result);
    } catch (error) {
      // The WaitTask may already have been resolved by timing out, or the
      // exection context may have been destroyed.
      // In both caes, the promises above are rejected with a protocol error.
      // We can safely ignores these, as the WaitTask is re-installed in
      // the next execution context if needed.
      if (error.message.includes('Protocol error')) return;
      debugError(error);
    }
    function deliverResult(name: string, seq: number, result: unknown): void {
      // @ts-expect-error TS7053
      globalThis[name].callbacks.get(seq).resolve(result);
      // @ts-expect-error TS7053
      globalThis[name].callbacks.delete(seq);
    }
  }

  /**
   * @internal
   */
  async waitForSelectorInPage(
    queryOne: Function,
    selector: string,
    options: WaitForSelectorOptions,
    binding?: PageBinding
  ): Promise<ElementHandle | null> {
    const {
      visible: waitForVisible = false,
      hidden: waitForHidden = false,
      timeout = this._timeoutSettings.timeout(),
    } = options;
    const polling = waitForVisible || waitForHidden ? 'raf' : 'mutation';
    const title = `selector \`${selector}\`${
      waitForHidden ? ' to be hidden' : ''
    }`;
    async function predicate(
      // @ts-expect-error TS2304
      root: Element | Document,
      selector: string,
      waitForVisible: boolean,
      waitForHidden: boolean
    // @ts-expect-error TS2304
    ): Promise<Node | null | boolean> {
      const node = predicateQueryHandler
        // @ts-expect-error TS2304
        ? ((await predicateQueryHandler(root, selector)) as Element)
        : root.querySelector(selector);
      return checkWaitForOptions(node, waitForVisible, waitForHidden);
    }
    const waitTaskOptions: WaitTaskOptions = {
      domWorld: this,
      predicateBody: helper.makePredicateString(predicate, queryOne),
      predicateAcceptsContextElement: true,
      title,
      polling,
      timeout,
      args: [selector, waitForVisible, waitForHidden],
      binding,
      root: options.root,
    };
    const waitTask = new WaitTask(waitTaskOptions);
    const jsHandle = await waitTask.promise;
    const elementHandle = jsHandle.asElement();
    if (!elementHandle) {
      await jsHandle.dispose();
      return null;
    }
    return elementHandle;
  }

  async waitForXPath(
    xpath: string,
    options: WaitForSelectorOptions
  ): Promise<ElementHandle | null> {
    const {
      visible: waitForVisible = false,
      hidden: waitForHidden = false,
      timeout = this._timeoutSettings.timeout(),
    } = options;
    const polling = waitForVisible || waitForHidden ? 'raf' : 'mutation';
    const title = `XPath \`${xpath}\`${waitForHidden ? ' to be hidden' : ''}`;
    function predicate(
      // @ts-expect-error TS2304
      root: Element | Document,
      xpath: string,
      waitForVisible: boolean,
      waitForHidden: boolean
    // @ts-expect-error TS2304
    ): Node | null | boolean {
      // @ts-expect-error TS2584
      const node = document.evaluate(
        xpath,
        root,
        null,
        // @ts-expect-error TS2304
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      return checkWaitForOptions(node, waitForVisible, waitForHidden);
    }
    const waitTaskOptions: WaitTaskOptions = {
      domWorld: this,
      predicateBody: helper.makePredicateString(predicate),
      predicateAcceptsContextElement: true,
      title,
      polling,
      timeout,
      args: [xpath, waitForVisible, waitForHidden],
      root: options.root,
    };
    const waitTask = new WaitTask(waitTaskOptions);
    const jsHandle = await waitTask.promise;
    const elementHandle = jsHandle.asElement();
    if (!elementHandle) {
      await jsHandle.dispose();
      return null;
    }
    return elementHandle;
  }

  waitForFunction(
    pageFunction: Function | string,
    options: { polling?: string | number; timeout?: number } = {},
    ...args: SerializableOrJSHandle[]
  ): Promise<JSHandle> {
    const { polling = 'raf', timeout = this._timeoutSettings.timeout() } =
      options;
    const waitTaskOptions: WaitTaskOptions = {
      domWorld: this,
      predicateBody: pageFunction,
      predicateAcceptsContextElement: false,
      title: 'function',
      polling,
      timeout,
      args,
    };
    const waitTask = new WaitTask(waitTaskOptions);
    return waitTask.promise;
  }

  async title(): Promise<string> {
    // @ts-expect-error TS2584
    return this.evaluate(() => document.title);
  }
}

/**
 * @internal
 */
export interface WaitTaskOptions {
  domWorld: DOMWorld;
  predicateBody: Function | string;
  predicateAcceptsContextElement: boolean;
  title: string;
  polling: string | number;
  timeout: number;
  binding?: PageBinding;
  args: SerializableOrJSHandle[];
  root?: ElementHandle;
}

/**
 * @internal
 */
export class WaitTask {
  _domWorld: DOMWorld;
  _polling: string | number;
  _timeout: number;
  _predicateBody: string;
  _predicateAcceptsContextElement: boolean;
  _args: SerializableOrJSHandle[];
  _binding: PageBinding;
  _runCount = 0;
  promise: Promise<JSHandle>;
  // @ts-expect-error TS2564
  _resolve: (x: JSHandle) => void;
  // @ts-expect-error TS2564
  _reject: (x: Error) => void;
  _timeoutTimer?: number;
  _terminated = false;
  // @ts-expect-error TS2322
  _root: ElementHandle = null;

  constructor(options: WaitTaskOptions) {
    if (helper.isString(options.polling))
      assert(
        options.polling === 'raf' || options.polling === 'mutation',
        'Unknown polling option: ' + options.polling
      );
    else if (helper.isNumber(options.polling))
      assert(
        options.polling > 0,
        'Cannot poll with non-positive interval: ' + options.polling
      );
    else throw new Error('Unknown polling options: ' + options.polling);

    function getPredicateBody(predicateBody: Function | string) {
      if (helper.isString(predicateBody)) return `return (${predicateBody});`;
      return `return (${predicateBody})(...args);`;
    }

    this._domWorld = options.domWorld;
    this._polling = options.polling;
    this._timeout = options.timeout;
    // @ts-expect-error TS2322
    this._root = options.root;
    this._predicateBody = getPredicateBody(options.predicateBody);
    this._predicateAcceptsContextElement =
      options.predicateAcceptsContextElement;
    this._args = options.args;
    // @ts-expect-error TS2322
    this._binding = options.binding;
    this._runCount = 0;
    this._domWorld._waitTasks.add(this);
    if (this._binding) {
      this._domWorld._boundFunctions.set(
        this._binding.name,
        this._binding.pptrFunction
      );
    }
    this.promise = new Promise<JSHandle>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    // Since page navigation requires us to re-install the pageScript, we should track
    // timeout on our end.
    if (options.timeout) {
      const timeoutError = new TimeoutError(
        `waiting for ${options.title} failed: timeout ${options.timeout}ms exceeded`
      );
      this._timeoutTimer = setTimeout(
        () => this.terminate(timeoutError),
        options.timeout
      );
    }
    this.rerun();
  }

  terminate(error: Error): void {
    this._terminated = true;
    this._reject(error);
    this._cleanup();
  }

  async rerun(): Promise<void> {
    const runCount = ++this._runCount;
    // @ts-expect-error TS2322
    let success: JSHandle = null;
    // @ts-expect-error TS2322
    let error: Error = null;
    const context = await this._domWorld.executionContext();
    if (this._terminated || runCount !== this._runCount) return;
    if (this._binding) {
      await this._domWorld.addBindingToContext(context, this._binding.name);
    }
    if (this._terminated || runCount !== this._runCount) return;
    try {
      success = await context.evaluateHandle(
        waitForPredicatePageFunction,
        this._root || null,
        this._predicateBody,
        this._predicateAcceptsContextElement,
        this._polling,
        this._timeout,
        ...this._args
      );
    } catch (error_) {
      error = error_;
    }

    if (this._terminated || runCount !== this._runCount) {
      if (success) await success.dispose();
      return;
    }

    // Ignore timeouts in pageScript - we track timeouts ourselves.
    // If the frame's execution context has already changed, `frame.evaluate` will
    // throw an error - ignore this predicate run altogether.
    if (
      !error &&
      (await this._domWorld.evaluate((s) => !s, success).catch(() => true))
    ) {
      await success.dispose();
      return;
    }
    if (error) {
      if (error.message.includes('TypeError: binding is not a function')) {
        return this.rerun();
      }
      // When frame is detached the task should have been terminated by the DOMWorld.
      // This can fail if we were adding this task while the frame was detached,
      // so we terminate here instead.
      if (
        error.message.includes(
          'Execution context is not available in detached frame'
        )
      ) {
        this.terminate(
          new Error('waitForFunction failed: frame got detached.')
        );
        return;
      }

      // When the page is navigated, the promise is rejected.
      // We will try again in the new execution context.
      if (error.message.includes('Execution context was destroyed')) return;

      // We could have tried to evaluate in a context which was already
      // destroyed.
      if (error.message.includes('Cannot find context with specified id'))
        return;

      this._reject(error);
    } else {
      this._resolve(success);
    }
    this._cleanup();
  }

  _cleanup(): void {
    clearTimeout(this._timeoutTimer);
    this._domWorld._waitTasks.delete(this);
  }
}

async function waitForPredicatePageFunction(
  // @ts-expect-error TS2304
  root: Element | Document | null,
  predicateBody: string,
  predicateAcceptsContextElement: boolean,
  polling: string,
  timeout: number,
  ...args: unknown[]
): Promise<unknown> {
  // @ts-expect-error TS2584
  root = root || document;
  const predicate = new Function('...args', predicateBody);
  let timedOut = false;
  if (timeout) setTimeout(() => (timedOut = true), timeout);
  if (polling === 'raf') return await pollRaf();
  if (polling === 'mutation') return await pollMutation();
  if (typeof polling === 'number') return await pollInterval(polling);

  /**
   * @returns {!Promise<*>}
   */
  async function pollMutation(): Promise<unknown> {
    const success = predicateAcceptsContextElement
      ? await predicate(root, ...args)
      : await predicate(...args);
    if (success) return Promise.resolve(success);

    // @ts-expect-error TS7034
    let fulfill;
    const result = new Promise((x) => (fulfill = x));
    // @ts-expect-error TS2304
    const observer = new MutationObserver(async () => {
      if (timedOut) {
        observer.disconnect();
        // @ts-expect-error TS7005
        fulfill();
      }
      const success = predicateAcceptsContextElement
        ? await predicate(root, ...args)
        : await predicate(...args);
      if (success) {
        observer.disconnect();
        // @ts-expect-error TS7005
        fulfill(success);
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    return result;
  }

  async function pollRaf(): Promise<unknown> {
    // @ts-expect-error TS7034
    let fulfill;
    const result = new Promise((x) => (fulfill = x));
    await onRaf();
    return result;

    async function onRaf(): Promise<unknown> {
      if (timedOut) {
        // @ts-expect-error TS7005
        fulfill();
        return;
      }
      const success = predicateAcceptsContextElement
        ? await predicate(root, ...args)
        : await predicate(...args);
      // @ts-expect-error TS7005
      if (success) fulfill(success);
      // @ts-expect-error TS2304
      else requestAnimationFrame(onRaf);
    }
  }

  async function pollInterval(pollInterval: number): Promise<unknown> {
    // @ts-expect-error TS7034
    let fulfill;
    const result = new Promise((x) => (fulfill = x));
    await onTimeout();
    return result;

    async function onTimeout(): Promise<unknown> {
      if (timedOut) {
        // @ts-expect-error TS7005
        fulfill();
        return;
      }
      const success = predicateAcceptsContextElement
        ? await predicate(root, ...args)
        : await predicate(...args);
      // @ts-expect-error TS7005
      if (success) fulfill(success);
      else setTimeout(onTimeout, pollInterval);
    }
  }
}