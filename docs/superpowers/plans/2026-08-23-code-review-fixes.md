# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the actionable issues raised in the code review: (1) lossy error wrapping in `OllamaClient`, (2) the no-op `onSuccess`/`onFailure` contract on `BaseTask`, (3) private-state reflection in `TaskQueue`, (4) random mutator selection ambiguity, (5) silent feature-load failure in `app.ts`, (6) stale `AGENTS.md` version, and (7) the pre-ES6 `const self = this` event-binding pattern.

**Architecture:** All changes are internal refactors preserving existing public interfaces. Error handling uses ES2022 `Error(cause)`. The `onSuccess`/`onFailure` contract becomes a real typed callback registry on `BaseTask` that subclasses invoke (not override). `TaskQueue` receives the services via an explicit accessor on `BaseTask`. Mutator selection becomes deterministic (exactly-one-or-throw). `app.ts` exits the process on feature-load failure so misconfigured bots fail loudly instead of silently never logging in.

**Tech Stack:** TypeScript 5.8 (ES2022, ESNext modules), Jest 30 with `ts-jest`, ESLint 9 flat config, `discord.js` 14, `ollama` 0.6.

## Global Constraints

- **TypeScript strict:** `explicit-function-return-type: error` and `no-floating-promises: error` are enforced. Every new function/method needs an explicit return type. No unawaited promises.
- **Imports:** ES modules with `.js` extensions on relative imports (project convention for ESM compat). Imports must be sorted (enforced by `eslint-plugin-simple-import-sort`).
- **No comments:** Project convention — do not add code comments unless the plan explicitly shows them.
- **Private fields:** Use ES `#` private fields (project convention), not `private` keyword.
- **Tests:** Co-located `*.test.ts`, Jest 30, `@jest/globals` imports. Run with `npm test`. Lint with `npm run lint`. Typecheck with `npm run build`.
- **Error wrapping:** Use `new Error(message, { cause: originalError })` — never `new Error(error as string)`. The codebase targets Node 24, which supports `Error.cause` (Node 16.9+).
- **Commit style:** Conventional Commits (`fix:`, `refactor:`, `docs:`, `test:`). One logical change per commit. Never amend a failed commit — create a new one.

---

## File Structure

This plan touches existing files only — no new source files are created. Test files are created or extended alongside their source.

| File | Responsibility | Change Type |
| --- | --- | --- |
| `src/services/clients/llm/ollama/OllamaClient.ts` | Ollama API wrapper | Modify — error handling |
| `src/services/clients/llm/ollama/OllamaClient.test.ts` | OllamaClient tests | Extend — error-cause assertions |
| `src/services/tasks/models/BaseTask.ts` | Abstract task base | Modify — callback registry |
| `src/services/IBotServiceContainer.ts` | Container interface | No change (consumers use existing `getLogger` etc.) |
| `src/services/tasks/TaskQueue.ts` | Task dispatch | Modify — drop reflection, use accessor |
| `src/services/tasks/TaskQueue.test.ts` | TaskQueue tests | Extend — services-accessor test |
| `src/services/BotServiceContainer.ts` | Composition root | Modify — deterministic mutator selection |
| `src/services/clients/media/comfy-ui/services/workflow-mutators/IWorkflowMutator.ts` | Mutator interface | No change |
| `src/services/clients/llm/ollama/tasks/OllamaGenerateTask.ts` | LLM generate task | Modify — use registry, drop private fields |
| `src/services/clients/llm/ollama/tasks/OllamaGenerateStructuredTask.ts` | LLM structured task | Modify — use registry, drop private fields |
| `src/services/clients/llm/ollama/tasks/OllamaGenerateTask.test.ts` | Generate task tests | Verify still green after refactor |
| `src/services/clients/llm/ollama/tasks/OllamaGenerateStructuredTask.test.ts` | Structured task tests | Verify still green after refactor |
| `src/app.ts` | Entry point | Modify — fail loudly on feature load |
| `src/services/clients/chat/discord/GenerativeChatClient.ts` | Chat client | Modify — arrow-function event binding |
| `src/services/clients/chat/discord/GenerativeMediaChatClient.ts` | Media client | Modify — arrow-function event binding |
| `AGENTS.md` | Repo docs | Modify — version bump to 9.4.0 |

---

## Task 1: Replace `throw new Error(error as string)` with `Error(cause)` in OllamaClient

**Files:**
- Modify: `src/services/clients/llm/ollama/OllamaClient.ts` (lines 69, 99, 161, 205, 248, 292)
- Test: `src/services/clients/llm/ollama/OllamaClient.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `OllamaClient` methods now throw `Error` instances whose `.cause` is the original error (preserves stack). No signature changes — callers unaffected.

The `OllamaClient` has six `throw new Error(error as string)` sites that coerce an Error to a string, destroying its stack and type. Each becomes `throw new Error('<contextual message>', { cause: error })`. The `free()` and `waitForModelUnload()` methods already swallow-and-log correctly; they are left alone.

- [ ] **Step 1: Write failing tests for error-cause preservation in `generate()`**

Append to `src/services/clients/llm/ollama/OllamaClient.test.ts`, inside the existing `describe('OllamaClient', ...)` block (after the `waitForModelUnload` describe):

```typescript
  describe('error handling', () => {
    it('generate() should throw an Error with .cause preserving the original error', async (): Promise<void> => {
      const originalError = new Error('ollama down');
      mockOllamaInstance.generate.mockRejectedValue(originalError);

      await expect(client.generate('prompt')).rejects.toThrow();

      try {
        await client.generate('prompt');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).cause).toBe(originalError);
        expect((error as Error).message).not.toContain('[object Object]');
      }
    });

    it('generateStructured() should throw an Error with .cause preserving the original error', async (): Promise<void> => {
      const originalError = new Error('structured request failed');
      mockOllamaInstance.generate.mockRejectedValue(originalError);

      await expect(client.generateStructured('prompt', {
        systemPrompt: '',
        schema: {}
      })).rejects.toThrow();

      try {
        await client.generateStructured('prompt', {
          systemPrompt: '',
          schema: {}
        });
      } catch (error) {
        expect((error as Error).cause).toBe(originalError);
      }
    });

    it('sendMessage() should throw an Error with .cause preserving the original error', async (): Promise<void> => {
      const originalError = new Error('chat endpoint gone');
      mockOllamaInstance.chat.mockRejectedValue(originalError);

      await expect(client.sendMessage('prompt', [])).rejects.toThrow();

      try {
        await client.sendMessage('prompt', []);
      } catch (error) {
        expect((error as Error).cause).toBe(originalError);
      }
    });

    it('show() should throw an Error with .cause preserving the original error', async (): Promise<void> => {
      const originalError = new Error('show failed');
      mockOllamaInstance.ps.mockResolvedValue({ models: [] });
      mockOllamaInstance.generate.mockResolvedValue({});
      (mockOllamaInstance as unknown as { show: jest.Mock }).show = jest.fn().mockRejectedValue(originalError);

      await expect(client.show('test-model')).rejects.toThrow();

      try {
        await client.show('test-model');
      } catch (error) {
        expect((error as Error).cause).toBe(originalError);
      }
    });

    it('interpretImages() should throw an Error with .cause preserving the original error', async (): Promise<void> => {
      const originalError = new Error('vision endpoint failed');
      mockOllamaInstance.generate.mockRejectedValue(originalError);

      await expect(client.interpretImages(['base64data'])).rejects.toThrow();

      try {
        await client.interpretImages(['base64data']);
      } catch (error) {
        expect((error as Error).cause).toBe(originalError);
      }
    });
  });
```

Also, the existing `jest.mock('ollama', ...)` factory at the top of the test file must expose a `show` mock. Update the factory to include it — replace the existing `jest.mock('ollama', ...)` block:

```typescript
jest.mock('ollama', () => {
  const mockOllama = jest.fn().mockImplementation(() => ({
    generate: jest.fn(),
    ps: jest.fn(),
    chat: jest.fn(),
    show: jest.fn(),
    embed: jest.fn()
  }));
  return { Ollama: mockOllama, __esModule: true };
});
```

And add `show` and `embed` to the `mockOllamaInstance` declaration in `beforeEach`:

```typescript
    mockOllamaInstance = {
      generate: jest.fn<() => Promise<unknown>>(),
      ps: jest.fn<() => Promise<{ models: Array<{ name: string; model: string }> }>>(),
      chat: jest.fn<() => Promise<unknown>>(),
      show: jest.fn<() => Promise<unknown>>(),
      embed: jest.fn<() => Promise<{ embeddings: number[][] }>>()
    };
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- OllamaClient.test`
Expected: The five new `error handling` tests FAIL, because `error as string` produces `"[object Object]"` or stringifies the message, so `.cause` is `undefined` and assertions fail.

- [ ] **Step 3: Replace `throw new Error(error as string)` with `throw new Error(<message>, { cause: error })`**

In `src/services/clients/llm/ollama/OllamaClient.ts`, make these exact replacements:

**Line 69** (in `generate()`):
```typescript
      throw new Error(error as string);
```
becomes
```typescript
      throw new Error('Failed to generate a response from Ollama.', { cause: error });
```

**Line 99** (in `show()`):
```typescript
      throw new Error(error as string);
```
becomes
```typescript
      throw new Error(`Failed to query Ollama for model details for '${model}'.`, { cause: error });
```
Note: this also removes the duplicate log line above — keep the `this.#logger.error(...)` line as-is, just change the throw.

**Line 161** (in `generateStructured()`):
```typescript
      throw new Error(error as string);
```
becomes
```typescript
      throw new Error('Failed to send Ollama a structured request.', { cause: error });
```

**Line 205** (in `sendMessage()`):
```typescript
      throw new Error(error as string);
```
becomes
```typescript
      throw new Error('Failed to send Ollama a message.', { cause: error });
```

**Line 248** (in `sendMessageAndGetStream()`):
```typescript
      throw new Error(error as string);
```
becomes
```typescript
      throw new Error('Failed to send Ollama a message and retrieve a stream.', { cause: error });
```

**Line 292** (in `interpretImages()`):
```typescript
      throw new Error(error as string);
```
becomes
```typescript
      throw new Error('Failed to interpret image(s) via Ollama.', { cause: error });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- OllamaClient.test`
Expected: All tests PASS, including the five new `error handling` tests.

- [ ] **Step 5: Run lint and typecheck**

Run: `npm run lint`; `npm run build`
Expected: No errors. If `error as string` lint warnings existed they are now gone.

- [ ] **Step 6: Commit**

```bash
git add src/services/clients/llm/ollama/OllamaClient.ts src/services/clients/llm/ollama/OllamaClient.test.ts
git commit -m "fix(ollama): preserve original error via Error(cause) instead of string coercion"
```

---

## Task 2: Replace no-op `onSuccess`/`onFailure` setters with a real callback registry on `BaseTask`

**Files:**
- Modify: `src/services/tasks/models/BaseTask.ts`
- Modify: `src/services/clients/llm/ollama/tasks/OllamaGenerateTask.ts`
- Modify: `src/services/clients/llm/ollama/tasks/OllamaGenerateStructuredTask.ts`
- Test: `src/services/clients/llm/ollama/tasks/OllamaGenerateTask.test.ts`
- Test: `src/services/clients/llm/ollama/tasks/OllamaGenerateStructuredTask.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `BaseTask<T>` now exposes a protected `#onSuccess`/`#onFailure` registry accessed via `protected get onSuccessCallback()` / `protected get onFailureCallback()`. Subclasses no longer `override set onSuccess`; they call `this.onSuccessCallback(payload)` from `postProcess()`. The public `onSuccess = ...` / `onFailure = ...` assignment API is preserved for callers (`MessageToMusicMutator` etc.), so no consumer code changes.

The current design: `BaseTask` declares `set onSuccess(callback) { }` (a no-op). Subclasses like `OllamaGenerateTask` override the setter to actually store the callback in a private field, then call it from `postProcess()`. This is fragile — the contract is "subclass must override the setter or callbacks silently vanish." We make it real: `BaseTask` stores the callbacks, subclasses read them via a protected getter.

- [ ] **Step 1: Write a failing test asserting `BaseTask` stores callbacks without subclass override**

Create a new test file: `src/services/tasks/models/BaseTask.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { IConfigurationService } from '../../environment-settings/IConfigurationService.js';
import type { IBotServiceContainer } from '../../IBotServiceContainer.js';
import type { ILogger } from '../../ILogger.js';
import type { IParallelizationStrategy } from '../../parallelization/IParallelizationStrategy.js';
import { TaskStatus } from '../enums/TaskStatus.js';
import { BaseTask } from './BaseTask.js';

function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn()
  };
}

function createMockServices(): IBotServiceContainer {
  const logger = createMockLogger();
  return {
    configurationService: { maxTaskAttempts: 3 } as unknown as IConfigurationService,
    parallelizationStrategy: { getTaskChannel: jest.fn(() => 'test') } as unknown as IParallelizationStrategy,
    getLogger: jest.fn(() => logger)
  } as unknown as IBotServiceContainer;
}

class TestTask extends BaseTask<string> {
  override get taskChannel(): string {
    return 'test-channel';
  }

  override async process(): Promise<void> {
    this.#result = 'done';
  }

  #result: string | null = null;

  override async postProcess(): Promise<void> {
    await super.postProcess();
    if (this.taskStatus === TaskStatus.Successful && this.#result !== null) {
      this.invokeOnSuccess(this.#result);
    }
    if (this.taskStatus === TaskStatus.Dead) {
      this.invokeOnFailure(this.lastError ?? new Error('died'));
    }
  }
}

describe('BaseTask callback registry', () => {
  let task: TestTask;

  beforeEach((): void => {
    task = new TestTask(createMockServices());
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  it('invokes onSuccess callback set via the public setter without subclass override', async (): Promise<void> => {
    const onSuccess = jest.fn<(payload: string) => void>();
    task.onSuccess = onSuccess;

    await task.process();
    task.taskStatus = TaskStatus.Successful;
    await task.postProcess();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('done');
  });

  it('invokes onFailure callback set via the public setter without subclass override', async (): Promise<void> => {
    const onFailure = jest.fn<(error: Error) => void>();
    task.onFailure = onFailure;

    task.lastError = new Error('boom');
    task.taskStatus = TaskStatus.Failed;
    task.taskStatus = TaskStatus.Failed;
    task.taskStatus = TaskStatus.Failed;
    await task.postProcess();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect((onFailure.mock.calls[0][0] as Error).message).toBe('boom');
  });

  it('does not throw when no callback is set and task succeeds', async (): Promise<void> => {
    await task.process();
    task.taskStatus = TaskStatus.Successful;
    await expect(task.postProcess()).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BaseTask.test`
Expected: FAIL — `TestTask` references `this.invokeOnSuccess` / `this.invokeOnFailure` which do not exist on `BaseTask`.

- [ ] **Step 3: Add the callback registry to `BaseTask`**

In `src/services/tasks/models/BaseTask.ts`, replace the no-op setters (lines 61-63):

```typescript
  set onSuccess(callback: (payload: T) => void) { }

  set onFailure(callback: (error: Error) => void) { }
```

with a real registry:

```typescript
  #onSuccess: ((payload: T) => void) | null = null;
  set onSuccess(callback: (payload: T) => void) {
    this.#onSuccess = callback;
  }

  #onFailure: ((error: Error) => void) | null = null;
  set onFailure(callback: (error: Error) => void) {
    this.#onFailure = callback;
  }

  protected invokeOnSuccess(payload: T): void {
    this.#onSuccess?.(payload);
  }

  protected invokeOnFailure(error: Error): void {
    this.#onFailure?.(error);
  }
```

- [ ] **Step 4: Update `OllamaGenerateTask` to use the registry instead of its own private fields**

In `src/services/clients/llm/ollama/tasks/OllamaGenerateTask.ts`, replace the entire file content:

```typescript
import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchange } from '../../../../../models/IHttpExchange.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaGenerateTask extends OllamaBaseTask<IHttpExchange<GenerateRequest, GenerateResponse>> {
  readonly #prompt: string;
  readonly #temperature: number | undefined = undefined;

  #ollamaExchange: IHttpExchange<GenerateRequest, GenerateResponse> | null = null;

  constructor(services: IBotServiceContainer, prompt: string, temperature: number | undefined = undefined) {
    super(services);
    this.logger = services.getLogger('OllamaGenerateTask');

    this.#prompt = prompt;
    this.#temperature = temperature;
  }

  override async process(): Promise<void> {
    this.logger.info('Starting task with prompt:', this.#prompt);
    this.#ollamaExchange = await this.ollamaClient.generate(this.#prompt, this.#temperature);
  }

  override async postProcess(): Promise<void> {
    await super.postProcess();

    switch (this.taskStatus) {
      case TaskStatus.Successful:
        this.logger.success('Task successful - passing Ollama exchange to callback:', this.#ollamaExchange);

        if(this.#ollamaExchange !== null) {
          this.invokeOnSuccess(this.#ollamaExchange);
        }

        break;

      case TaskStatus.Dead:
        this.logger.error('Task dead - invoking onFailure callback.');

        this.invokeOnFailure(this.lastError ?? new Error('Task died without a captured error.'));

        break;
    }
  }
}
```

- [ ] **Step 5: Update `OllamaGenerateStructuredTask` similarly**

In `src/services/clients/llm/ollama/tasks/OllamaGenerateStructuredTask.ts`, replace the entire file content:

```typescript
import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchangeWithAttachedData } from '../../../../../models/IHttpExchangeWithAttachedData.js';
import { IBotServiceContainer } from "../../../../IBotServiceContainer.js"
import { TaskStatus } from '../../../../tasks/enums/TaskStatus.js';
import { IStructuredRequestData } from '../models/IStructuredRequestData.js';
import { OllamaBaseTask } from './OllamaBaseTask.js';

export class OllamaGenerateStructuredTask<T> extends OllamaBaseTask<IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T>> {
  readonly #prompt: string;
  readonly #structuredRequestData: IStructuredRequestData;

  #ollamaExchange: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, T> | null = null;

  constructor(services: IBotServiceContainer, prompt: string, structuredRequestData: IStructuredRequestData) {
    super(services);
    this.logger = services.getLogger('OllamaGenerateStructuredTask');

    this.#prompt = prompt;
    this.#structuredRequestData = structuredRequestData;
  }

  override async process(): Promise<void> {
    this.logger.info('Starting task with prompt:', this.#prompt);
    this.#ollamaExchange = await this.ollamaClient.generateStructured<T>(this.#prompt, this.#structuredRequestData);
  }

  override async postProcess(): Promise<void> {
    await super.postProcess();

    switch (this.taskStatus) {
      case TaskStatus.Successful:
        this.logger.success('Task successful - passing Ollama exchange to callback:', this.#ollamaExchange);

        if(this.#ollamaExchange !== null) {
          this.invokeOnSuccess(this.#ollamaExchange);
        }

        break;

      case TaskStatus.Dead:
        this.logger.error('Task dead - invoking onFailure callback.');

        this.invokeOnFailure(this.lastError ?? new Error('Task died without a captured error.'));

        break;
    }
  }
}
```

- [ ] **Step 6: Run all task tests to verify the refactor preserves behavior**

Run: `npm test -- OllamaGenerateTask.test OllamaGenerateStructuredTask.test BaseTask.test`
Expected: All PASS. The existing `OllamaGenerateTask.test.ts` asserts `task.onSuccess = onSuccess` followed by `postProcess()` calls `onSuccess` — this still works because the public setter is preserved and `invokeOnSuccess` reads the same stored callback.

- [ ] **Step 7: Run lint and typecheck**

Run: `npm run lint`; `npm run build`
Expected: No errors. The `override set onSuccess` declarations are gone, so no unused-override warnings.

- [ ] **Step 8: Commit**

```bash
git add src/services/tasks/models/BaseTask.ts src/services/tasks/models/BaseTask.test.ts src/services/clients/llm/ollama/tasks/OllamaGenerateTask.ts src/services/clients/llm/ollama/tasks/OllamaGenerateStructuredTask.ts
git commit -m "refactor(tasks): make BaseTask onSuccess/onFailure a real callback registry"
```

---

## Task 3: Remove private-state reflection from `TaskQueue` via a public `services` accessor on `BaseTask`

**Files:**
- Modify: `src/services/tasks/models/BaseTask.ts`
- Modify: `src/services/tasks/TaskQueue.ts` (line 47-50)
- Test: `src/services/tasks/TaskQueue.test.ts`

**Interfaces:**
- Consumes: Task 2's `BaseTask` changes (same file)
- Produces: `BaseTask` exposes a public readonly `services: IBotServiceContainer` (promoted from `protected`). `TaskQueue` reads `task.services` directly instead of `(task as unknown as { services }).services`.

`TaskQueue.#getTaskServices` uses a type assertion to read the `protected services` field. We promote `services` to a public readonly getter on `BaseTask` and remove the reflection.

- [ ] **Step 1: Write a failing test asserting `TaskQueue` reads services from the public accessor**

Append to `src/services/tasks/TaskQueue.test.ts`. First, read the existing file to see its current structure, then add this test inside the top-level `describe`:

```typescript
  it('does not use private-state reflection to access task services (regression)', (): void => {
    const task = createMockTask('reflection-channel');
    const queue = new TaskQueue(createMockGlobalServices());

    queue.add(task);

    const taskServicesField = (task as unknown as { services?: unknown }).services;
    expect(taskServicesField).toBeDefined();
    expect(taskServicesField).toBe(task.services);
  });
```

If `createMockTask` / `createMockGlobalServices` helper names differ in the existing test file, use the existing helper names instead — do not rename them. The intent: after `add()`, `task.services` is defined and equals the value the reflection hack would have read.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- TaskQueue.test`
Expected: FAIL — `task.services` is `protected`, so TypeScript compilation of the test fails, OR the property is not accessible and the assertion fails.

- [ ] **Step 3: Promote `services` to public readonly on `BaseTask`**

In `src/services/tasks/models/BaseTask.ts`, change:

```typescript
  protected services: IBotServiceContainer;
```
to:
```typescript
  readonly services: IBotServiceContainer;
```

The constructor already assigns `this.services = services;` — keep that line as-is (assignment in constructor is allowed for `readonly`).

- [ ] **Step 4: Remove the reflection helper from `TaskQueue`**

In `src/services/tasks/TaskQueue.ts`, delete the `#getTaskServices` method (lines 47-50):

```typescript
  #getTaskServices(task: BaseTask<unknown>): IBotServiceContainer {
    // Access the private services field via type assertion
    return (task as unknown as { services: IBotServiceContainer }).services;
  }
```

And change the call site in `add()` (line 25):

```typescript
    const taskServices = this.#getTaskServices(task);
```
to:
```typescript
    const taskServices = task.services;
```

- [ ] **Step 5: Run TaskQueue tests to verify they pass**

Run: `npm test -- TaskQueue.test`
Expected: All PASS — the reflection is gone, `task.services` is now public.

- [ ] **Step 6: Run full test suite, lint, and typecheck**

Run: `npm test`; `npm run lint`; `npm run build`
Expected: All green. No other code references `#getTaskServices` or relies on `services` being protected (a quick grep confirms — `OllamaBaseTask` reads `services` via constructor param, not via the field).

- [ ] **Step 7: Commit**

```bash
git add src/services/tasks/models/BaseTask.ts src/services/tasks/TaskQueue.ts src/services/tasks/TaskQueue.test.ts
git commit -m "refactor(tasks): read task services via public accessor instead of reflection"
```

---

## Task 4: Make `getWorkflowMutator` selection deterministic (exactly-one-or-throw)

**Files:**
- Modify: `src/services/BotServiceContainer.ts` (lines 166-195)

**Interfaces:**
- Consumes: nothing new
- Produces: `getWorkflowMutator` throws when zero OR multiple mutators match, instead of randomly picking among multiple. Callers (e.g. `ComfyUiInteractionTask`) already handle a thrown `Error` from this method.

Currently when multiple mutators match an `(interaction, workflow.type)` pair, the code randomly picks one. This is wrong for deterministic interactions like `Retry` or `GuidanceScalePlus` — exactly one mutator should match. If two match, that's a config bug that should surface loudly, not be silently randomized.

- [ ] **Step 1: Write a failing test for the multiple-match case**

Append to `src/services/clients/media/comfy-ui/services/workflow-mutators/JsonMutator.test.ts` (or create a new `BotServiceContainer.test.ts` if no container-level test exists — prefer extending an existing mutator test only if it tests `getWorkflowMutator`; otherwise create `src/services/BotServiceContainer.test.ts`):

Create `src/services/BotServiceContainer.test.ts`:

```typescript
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { BotInteraction } from '../enums/BotInteraction.js';
import { BotMode } from '../enums/BotMode.js';
import { NodeEnvironment } from '../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from './environment-settings/IConfigurationService.js';
import type { IGlobalServiceContainer } from './IGlobalServiceContainer.js';
import { GlobalServiceContainer } from './GlobalServiceContainer.js';
import { BotServiceContainer } from './BotServiceContainer.js';
import { SupportedFeature } from './features/enum/SupportedFeature.js';

function createMockBotConfig(overrides: Partial<IConfigurationService['botFunction'] extends never ? never : Record<string, unknown>> = {}): unknown {
  return {
    botId: 'test-bot',
    mode: 'media',
    nodeEnvironment: NodeEnvironment.Test,
    botFunction: BotMode.Media,
    discordToken: 'token',
    discordChannels: [],
    discordChannelsDisallowed: [],
    requiresMention: false,
    responseRate: 100,
    ollamaHosts: [new URL('http://localhost:11434')],
    ollamaModels: ['test'],
    ollamaSystemPrompt: '',
    ollamaStreamsResponse: false,
    comfyUiHosts: [new URL('http://localhost:8188')],
    comfyUiGuidanceScaleInterval: 0.5,
    randomPrompts: [],
    ...overrides
  };
}

describe('BotServiceContainer.getWorkflowMutator', () => {
  it('throws when zero mutators match the interaction/type pair', (): void => {
    const globalConfig = {
      taskQueue: { numAttempts: 3, retryDelayMs: 100, strategy: TaskQueueStrategy.Parallel }
    };
    const global = {} as IGlobalServiceContainer;
    const botConfig = createMockBotConfig() as never;
    const container = new BotServiceContainer(global as GlobalServiceContainer, botConfig as never);

    expect(() => container.getWorkflowMutator(
      'NonExistentInteraction' as unknown as BotInteraction,
      { type: SupportedFeature.Img2Img, name: 'workflow' } as never
    )).toThrow(/not supported by your current configuration/);
  });
});
```

Note: the zero-match case already throws today, so this test should PASS before the change — it documents the preserved behavior. The real new behavior is "multiple matches throw." Since we cannot easily construct a real multiple-match scenario without registering a duplicate mutator, the deterministic behavior is verified by reading the post-refactor code: the `else if (supportedMutators.length > 1)` branch must throw instead of randomize.

- [ ] **Step 2: Make the multiple-match case throw**

In `src/services/BotServiceContainer.ts`, replace the `getWorkflowMutator` method body (lines 166-195):

```typescript
  getWorkflowMutator(interactionType: BotInteraction, workflow: IWorkflow): IWorkflowMutator {
    const mutators: IWorkflowMutator[] = [
      new ContextualMediaMutator(this),
      new GuidanceScaleMutator(this),
      new JsonMutator(this),
      new MessageToMediaMutator(this),
      new MessageToMusicMutator(this),
      new ExpandPromptMutator(this),
      new RandomPromptMutator(this),
      new RetryMutator(this)
    ];

    const supportedMutators = mutators.filter(
      mutator => mutator.interactions.includes(interactionType)
        && mutator.types.includes(workflow.type));

    if(supportedMutators.length === 1) {
      return supportedMutators[0];
    } else if(supportedMutators.length > 1) {
      const mutator = getRandomArrayEntry(supportedMutators);

      if(mutator === null) {
        throw new Error('A supported mutator could not be found.');
      }

      return mutator;
    } else {
      throw new Error('The task you are attempting to instantiate is not supported by your current configuration.');
    }
  }
```

with:

```typescript
  getWorkflowMutator(interactionType: BotInteraction, workflow: IWorkflow): IWorkflowMutator {
    const mutators: IWorkflowMutator[] = [
      new ContextualMediaMutator(this),
      new GuidanceScaleMutator(this),
      new JsonMutator(this),
      new MessageToMediaMutator(this),
      new MessageToMusicMutator(this),
      new ExpandPromptMutator(this),
      new RandomPromptMutator(this),
      new RetryMutator(this)
    ];

    const supportedMutators = mutators.filter(
      mutator => mutator.interactions.includes(interactionType)
        && mutator.types.includes(workflow.type));

    if (supportedMutators.length === 1) {
      return supportedMutators[0];
    }

    if (supportedMutators.length > 1) {
      const names = supportedMutators.map(m => m.constructor.name).join(', ');
      throw new Error(
        `Ambiguous workflow mutator selection: ${supportedMutators.length} mutators match `
        + `interaction '${interactionType}' and type '${workflow.type}': ${names}. `
        + `Exactly one mutator must match.`
      );
    }

    throw new Error('The task you are attempting to instantiate is not supported by your current configuration.');
  }
```

Now remove the now-unused `getRandomArrayEntry` import from the top of the file if it is no longer referenced anywhere else in `BotServiceContainer.ts`. Check with: does `BotServiceContainer.ts` use `getRandomArrayEntry` anywhere else? If not, remove it from the import statement at line 16:

```typescript
import { getRandomArrayEntry } from '../utilities/random-utilities.js';
```
becomes (delete the line entirely — it was only used by `getWorkflowMutator`).

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint`; `npm run build`
Expected: No errors. If lint flags the unused import, the removal in Step 2 fixed it.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All green. No existing test asserts the random-pick behavior (verified by grepping `getWorkflowMutator` in test files — only `JsonMutator.test.ts` and `MessageToMusicMutator.test.ts` exist and they test individual mutators, not the container's selection).

- [ ] **Step 5: Commit**

```bash
git add src/services/BotServiceContainer.ts src/services/BotServiceContainer.test.ts
git commit -m "refactor(container): throw on ambiguous workflow mutator selection instead of randomizing"
```

---

## Task 5: Make `app.ts` fail loudly on feature-load failure

**Files:**
- Modify: `src/app.ts` (lines 24-29)

**Interfaces:**
- Consumes: nothing new
- Produces: When `featureService.loadFeatures()` rejects for a bot, the process logs the error and exits non-zero instead of silently continuing (and the bot never logging in).

Currently the `.catch()` in `app.ts` logs and swallows the error, so a misconfigured bot silently never logs in. We change it to log then exit with code 1.

- [ ] **Step 1: No unit test (entry point side-effectful). Document the behavior in the diff.**

`app.ts` is a side-effectful entry point not covered by Jest. We rely on manual verification + typecheck + lint. Do not add a test file for `app.ts` — it instantiates real Discord clients and is not unit-testable without heavy refactoring out of scope here.

- [ ] **Step 2: Change the catch to exit non-zero**

In `src/app.ts`, replace:

```typescript
    featureService.loadFeatures().then(() => {
      client.login();
    }).catch((error) => {
      logger.error(`Failed to load supported features for bot ${botConfig.botId}.`
        + ` Check your workflows/workflow permissions and restart ${settings.applicationName}:`, error);
    });
```

with:

```typescript
    featureService.loadFeatures().then(() => {
      client.login();
    }).catch((error) => {
      logger.error(`Failed to load supported features for bot ${botConfig.botId}.`
        + ` Check your workflows/workflow permissions and restart ${settings.applicationName}:`, error);
      process.exitCode = 1;
    });
```

Using `process.exitCode = 1` (not `process.exit(1)`) so the process exits after any pending I/O flushes — this is the Node-recommended pattern for graceful exit from async contexts, and it preserves the existing top-level-await-incompatible constraint noted in the file's comment.

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint`; `npm run build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app.ts
git commit -m "fix(app): set exitCode on feature-load failure so misconfigured bots fail visibly"
```

---

## Task 6: Replace `const self = this` event-binding with arrow functions

**Files:**
- Modify: `src/services/clients/chat/discord/GenerativeChatClient.ts` (lines 62-70)
- Modify: `src/services/clients/chat/discord/GenerativeMediaChatClient.ts` (lines 41-48)

**Interfaces:**
- Consumes: nothing new
- Produces: No behavior change. Event handlers are bound via arrow wrappers instead of `const self = this; fn.call(self, ...)`. Removes two `eslint-disable-next-line @typescript-eslint/no-this-alias` comments.

- [ ] **Step 1: Refactor `GenerativeChatClient.#registerEvents`**

In `src/services/clients/chat/discord/GenerativeChatClient.ts`, replace:

```typescript
  #registerEvents(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady.call(self, event));
    this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate.call(self, message));
    this.#discordClient.on(Events.InteractionCreate, (interaction) => void  this.#onInteractionCreate.call(self, interaction));
    this.#discordClient.on(Events.MessageReactionAdd, (reaction, user) => void this.#onMessageReactionAdd.call(self, reaction, user));
  }
```

with:

```typescript
  #registerEvents(): void {
    this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady(event));
    this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate(message));
    this.#discordClient.on(Events.InteractionCreate, (interaction) => void this.#onInteractionCreate(interaction));
    this.#discordClient.on(Events.MessageReactionAdd, (reaction, user) => void this.#onMessageReactionAdd(reaction, user));
  }
```

Arrow functions lexically bind `this`, so the `self` alias and `.call(self, ...)` are unnecessary.

- [ ] **Step 2: Refactor `GenerativeMediaChatClient.#registerEvents`**

In `src/services/clients/chat/discord/GenerativeMediaChatClient.ts`, replace:

```typescript
  #registerEvents(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady.call(self, event));
    this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate.call(self, message));
    this.#discordClient.on(Events.InteractionCreate, (interaction) => void this.#onInteraction.call(self, interaction));
  }
```

with:

```typescript
  #registerEvents(): void {
    this.#discordClient.once(Events.ClientReady, (event) => void this.onClientReady(event));
    this.#discordClient.on(Events.MessageCreate, (message) => void this.#onMessageCreate(message));
    this.#discordClient.on(Events.InteractionCreate, (interaction) => void this.#onInteraction(interaction));
  }
```

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint`; `npm run build`
Expected: No errors. The two `no-this-alias` disable comments are gone, and no new lint warnings appear.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All green (no tests directly cover `#registerEvents`, but nothing should break — arrow binding is semantically equivalent to `.call(self, ...)` here since `self` was always `this`).

- [ ] **Step 5: Commit**

```bash
git add src/services/clients/chat/discord/GenerativeChatClient.ts src/services/clients/chat/discord/GenerativeMediaChatClient.ts
git commit -m "refactor(discord): bind event handlers via arrow functions instead of self-alias"
```

---

## Task 7: Sync `AGENTS.md` version with `package.json`

**Files:**
- Modify: `AGENTS.md` (line 14)

**Interfaces:**
- None. Documentation-only.

- [ ] **Step 1: Update the version line**

In `AGENTS.md`, change:

```markdown
- **Version:** 8.5.0
```
to:
```markdown
- **Version:** 9.4.0
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync AGENTS.md version with package.json (8.5.0 -> 9.4.0)"
```

---

## Self-Review

**1. Spec coverage** — Mapping each review issue to a task:
- (1) lossy `throw new Error(error as string)` → Task 1 ✓
- (2) no-op `onSuccess`/`onFailure` contract → Task 2 ✓
- (3) `TaskQueue.#getTaskServices` reflection → Task 3 ✓
- (4) random mutator selection → Task 4 ✓
- (5) silent feature-load failure in `app.ts` → Task 5 ✓
- (6) stale `AGENTS.md` version → Task 7 ✓
- (7) `const self = this` event binding → Task 6 ✓

Two review notes (memory DB path under `workflows/`, thin Discord-client test coverage) are intentionally NOT in this plan — they are larger structural changes out of scope for a focused fixes pass. They are candidates for a follow-up plan.

**2. Placeholder scan** — No "TBD", "TODO", "implement later", "add error handling", "similar to Task N" found. Every code step shows the actual code. Task 4 Step 1's test helper `createMockBotConfig` has a deliberately loose type for `overrides` because `IBotConfig` is the config shape, not `IConfigurationService` — the cast to `never` at the call site is intentional and matches the existing pattern in `OllamaClient.test.ts`'s `createMockConfigurationService`.

**3. Type consistency** — `invokeOnSuccess(payload: T)` / `invokeOnFailure(error: Error)` defined in Task 2 Step 3 are called in Task 2 Steps 4-5 as `this.invokeOnSuccess(this.#ollamaExchange)` / `this.invokeOnFailure(this.lastError ?? ...)`. Names match. `task.services` promoted to public readonly in Task 3 is read in Task 3 Step 4 as `task.services` — matches. `getWorkflowMutator` signature unchanged in Task 4 — callers unaffected.

**4. Execution ordering** — Tasks 2 and 3 both modify `BaseTask.ts`. Task 2 runs first (adds the callback registry), Task 3 promotes `services` to public. They touch different lines of the same file and do not conflict. Task 3's test (`TaskQueue.test.ts`) depends on Task 2's `BaseTask` having the registry only if `createMockTask` in the existing test file builds a subclass that calls `invokeOnSuccess` — but the existing `TaskQueue.test.ts` uses a simpler mock that does not. Verified by the fact that Task 3's new test only reads `task.services`, not callbacks.