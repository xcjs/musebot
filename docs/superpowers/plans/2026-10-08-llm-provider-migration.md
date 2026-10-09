# LLM Provider Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Musebot's chat/generate/structured/embedding traffic from the Ollama-only client to any OpenAI-compatible API platform (Ollama, llama.cpp, hosted clouds) with optional per-host auth tokens, while preserving local VRAM lifecycle choreography.

**Architecture:** Strategy pattern — a neutral `ILlmClient` interface with one fetch-based `/v1/*` protocol client (`LlmClient`), four per-host `ILlmLifecycleStrategy` implementations (Ollama, llama.cpp router, llama.cpp single-model, Null/no-op), and a startup `LlmHostFlavorRegistry` that probes each configured host for flavor + `isLocal` and caches results. Neutral DTOs replace all leaked ollama-js types across ~25 files. Breaking config rename `ollama:` → `llm:` with host objects `{ url, token?, isLocal? }`.

**Tech Stack:** TypeScript 5.8 (ES2022, ESM, `.js` import extensions), Node 24 global `fetch`, Jest 30 + ts-jest, ESLint 9 flat config (typescript-eslint + simple-import-sort).

**Spec:** `docs/superpowers/specs/2026-10-08-llm-provider-migration-design.md`

## Global Constraints

- Version target: **10.0.0** (breaking config change; bump `package.json` version in final task).
- Never rename or alter behavior of: `LlmChatMessage`, factory method names (`getLlmGenerateTask` etc.), `ContextMessage`, `ResourceType.LargeLanguageModel`, `SerialStrategy`/`GlobalServiceContainer` channel logic.
- No SDKs — direct `fetch` only; the `ollama` npm dependency is REMOVED (`npm uninstall ollama` in Task 1; it stays usable until the last import is deleted in Task 5 — deletion from `package.json` happens in Task 5 when imports are gone. Task 1 stops installing it for new work).
- `Authorization: Bearer <token>` header sent only when the host has a non-null token.
- Raw generate (`generate`, `interpretImages`) = single-user-message `POST /v1/chat/completions` (NOT `/v1/completions`).
- Structured output wire format: `response_format: { type: 'json_schema', json_schema: { name: 'result', schema } }`; `trimTrailingJsonContent` remains a safety net.
- Streaming: `stream_options: { include_usage: true }`; SSE `data:` line parse; usage only guaranteed on final chunk.
- All new named types live in dedicated files — **no anonymous types** in `IBotConfig.llm` or `IConfigurationService` (user constraint: every type in its own file).
- Imports use `.js` extensions; sorted imports (simple-import-sort) enforced by `npm run lint`.
- `services.llmClient` is TRANSIENT — every access constructs a new client with a new random host + model. Flavor/isLocal probing must therefore be cached by host URL in a singleton registry.
- Interface method surface preserved verbatim (old `OllamaClient` method names) so consumer mocks stay mechanical.
- Explicit return types required on all functions (`explicit-function-return-type: error`); no floating promises.
- Tests co-located `*.test.ts`, excluded from tsc build, run with `npx jest <path>` or `npm test`.
- Commits: conventional style (`feat:`, `refactor:`, `test:`, `docs:`, `chore:`), never commit `config.jsonc` (contains real Discord token).
- Repo is local-only — never push.

---

### Task 1: Neutral DTOs, enums, constants under `src/services/clients/llm/models/`, `enums/`, `constants/`

**Files:**
- Create: `src/services/clients/llm/constants/LlmConstants.ts`
- Create: `src/services/clients/llm/enums/LlmRole.ts`
- Create: `src/services/clients/llm/enums/LlmHostFlavor.ts`
- Create: `src/services/clients/llm/models/ILlmHost.ts`
- Create: `src/services/clients/llm/models/LlmMessage.ts`
- Create: `src/services/clients/llm/models/LlmGenerateResult.ts`
- Create: `src/services/clients/llm/models/LlmChatResult.ts`
- Create: `src/services/clients/llm/models/LlmStreamChunk.ts`
- Create: `src/services/clients/llm/models/LlmEmbeddingResult.ts`
- Create: `src/services/clients/llm/models/IStructuredRequestData.ts` (moved + renamed from `clients/llm/ollama/models/IStructuredRequestData.ts`, content unchanged)
- Create: `src/services/clients/llm/models/LlmChatMessage.ts` and `src/services/clients/llm/models/LlmChatMessageAttachment.ts` (moved from `ollama/models/`, content unchanged)
- Create: `src/services/clients/llm/models/ContextMessage.ts` (moved from `ollama/models/`, content unchanged)
- Test: `src/services/clients/llm/enums/LlmRole.test.ts`
- Test: `src/services/clients/llm/models/LlmMessage.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces (used by all later tasks): `LlmRole` enum (`User='user'`, `System='system'`, `Assistant='assistant'`); `LlmHostFlavor` enum (`Ollama='ollama'`, `LlamaCppRouter='llamacpp-router'`, `LlamaCppSingle='llamacpp-single'`, `Generic='generic'`); `ILlmHost` interface `{ url: URL, token: string | null, isLocal: boolean | null }`; `LlmMessage` `{ role: LlmRole, content: string, images?: string[] }`; `LlmGenerateResult` `{ content: string, totalTokens?: number, promptTokens?: number, completionTokens?: number, tokensPerSecond?: number }`; `LlmChatResult` `{ message: LlmMessage, totalTokens?: number, promptTokens?: number, completionTokens?: number }`; `LlmStreamChunk` `{ content: string, done: boolean, promptTokens?: number, completionTokens?: number }`; `LlmEmbeddingResult` `{ embeddings: number[][] }` (internal wire DTO; public embed/embedBatch keep plain arrays); `IStructuredRequestData` `{ systemPrompt: string, schema: object }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/clients/llm/enums/LlmRole.test.ts
import { describe, expect, it } from '@jest/globals';

import { LlmRole } from './LlmRole.js';

describe('LlmRole', () => {
  it('matches OpenAI role strings', (): void => {
    expect(LlmRole.User).toBe('user');
    expect(LlmRole.System).toBe('system');
    expect(LlmRole.Assistant).toBe('assistant');
  });
});
```

```typescript
// src/services/clients/llm/models/LlmMessage.test.ts
import { describe, expect, it } from '@jest/globals';

import { LlmRole } from '../enums/LlmRole.js';
import { LlmMessage } from './LlmMessage.js';

describe('LlmMessage', () => {
  it('accepts role, content, and optional base64 images', (): void => {
    const message: LlmMessage = { role: LlmRole.User, content: 'hi', images: ['aGk='] };
    expect(message.role).toBe('user');
    expect(message.content).toBe('hi');
    expect(message.images).toEqual(['aGk=']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/clients/llm/enums/LlmRole.test.ts`
Expected: FAIL — cannot resolve `./LlmRole.js`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/clients/llm/enums/LlmRole.ts
export enum LlmRole {
  User = 'user',
  System = 'system',
  Assistant = 'assistant'
}
```

```typescript
// src/services/clients/llm/enums/LlmHostFlavor.ts
export enum LlmHostFlavor {
  Ollama = 'ollama',
  LlamaCppRouter = 'llamacpp-router',
  LlamaCppSingle = 'llamacpp-single',
  Generic = 'generic'
}
```

```typescript
// src/services/clients/llm/models/ILlmHost.ts
import { LlmHostFlavor } from '../enums/LlmHostFlavor.js';

export interface ILlmHost {
  url: URL;
  token: string | null;
  isLocal: boolean | null;
}
```

```typescript
// src/services/clients/llm/models/LlmMessage.ts
import { LlmRole } from '../enums/LlmRole.js';

export interface LlmMessage {
  role: LlmRole;
  content: string;
  images?: string[];
}
```

```typescript
// src/services/clients/llm/models/LlmGenerateResult.ts
export interface LlmGenerateResult {
  content: string;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokensPerSecond?: number;
}
```

```typescript
// src/services/clients/llm/models/LlmChatResult.ts
import { LlmMessage } from './LlmMessage.js';

export interface LlmChatResult {
  message: LlmMessage;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}
```

```typescript
// src/services/clients/llm/models/LlmStreamChunk.ts
export interface LlmStreamChunk {
  content: string;
  done: boolean;
  promptTokens?: number;
  completionTokens?: number;
}
```

```typescript
// src/services/clients/llm/models/LlmEmbeddingResult.ts
export interface LlmEmbeddingResult {
  embeddings: number[][];
}
```

```typescript
// src/services/clients/llm/models/IStructuredRequestData.ts
export interface IStructuredRequestData {
  systemPrompt: string,
  schema: object
}
```

```typescript
// src/services/clients/llm/constants/LlmConstants.ts
export const LLM_TEMPERATURE_DEFAULT = 0.8;
export const LLM_TEMPERATURE_MIN = 0;
export const LLM_TEMPERATURE_MAX = 2;
```

For `LlmChatMessage.ts`, `LlmChatMessageAttachment.ts`, `ContextMessage.ts`: copy file content verbatim from `src/services/clients/llm/ollama/models/` (only fix import paths if any cross-folder imports exist; `LlmChatMessage.ts` imports `LlmChatMessageAttachment.js` — keep sibling relative import). Do NOT delete the old `ollama/` files yet (Task 5 deletes them).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/clients/llm/enums src/services/clients/llm/models`
Expected: PASS (2 suites)

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`
Expected: 0 errors
```bash
git add src/services/clients/llm
git commit -m "feat: add neutral LLM DTOs, enums, and constants"
```

---

### Task 2: `ILlmLifecycleStrategy` + four strategy implementations

**Files:**
- Create: `src/services/clients/llm/lifecycle/ILlmLifecycleStrategy.ts`
- Create: `src/services/clients/llm/lifecycle/OllamaLifecycleStrategy.ts`
- Create: `src/services/clients/llm/lifecycle/LlamaCppRouterLifecycleStrategy.ts`
- Create: `src/services/clients/llm/lifecycle/LlamaCppSingleLifecycleStrategy.ts`
- Create: `src/services/clients/llm/lifecycle/NullLifecycleStrategy.ts`
- Test: `src/services/clients/llm/lifecycle/OllamaLifecycleStrategy.test.ts`
- Test: `src/services/clients/llm/lifecycle/LlamaCppRouterLifecycleStrategy.test.ts`
- Test: `src/services/clients/llm/lifecycle/LlamaCppSingleLifecycleStrategy.test.ts`
- Test: `src/services/clients/llm/lifecycle/NullLifecycleStrategy.test.ts`

**Interfaces:**
- Consumes: `ILlmHost` (Task 1), `LlmConstants` not needed here.
- Produces: `ILlmLifecycleStrategy` interface — all later lifecycle consumers depend on this exact shape:

```typescript
export interface ILlmLifecycleStrategy {
  free(): Promise<boolean>;
  isModelLoaded(): Promise<boolean>;
  waitForModelUnload(intervalMs?: number): Promise<boolean>;
  getContextWindow(): Promise<number | null>;
  hasVisionCapability(model?: string): Promise<boolean>;
}
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/services/clients/llm/lifecycle/OllamaLifecycleStrategy.test.ts
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { OllamaLifecycleStrategy } from './OllamaLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('OllamaLifecycleStrategy', () => {
  let strategy: OllamaLifecycleStrategy;

  beforeEach((): void => {
    global.fetch = jest.fn();
    strategy = new OllamaLifecycleStrategy(
      new URL('http://localhost:11434'),
      null,
      mockLogger as never);
  });

  it('free() posts keep_alive: 0 to /api/generate', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, {}));

    const result = await strategy.free();

    expect(result).toBe(true);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe('http://localhost:11434/api/generate');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'test-model', keep_alive: 0 });
  });

  it('isModelLoaded() returns true when model present in /api/ps', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, { models: [{ name: 'test-model' }] }));

    expect(await strategy.isModelLoaded()).toBe(true);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toBe('http://localhost:11434/api/ps');
  });

  it('waitForModelUnload() polls /api/ps until model absent, then true', async (): Promise<void> => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200, {}))                            // free
      .mockResolvedValueOnce(mockResponse(200, { models: [{ name: 'test-model' }] })) // still loaded
      .mockResolvedValueOnce(mockResponse(200, { models: [] }));               // gone

    const result = await strategy.waitForModelUnload(10);

    expect(result).toBe(true);
    expect((global.fetch as jest.Mock).toHaveBeenCalledTimes(3);
  });

  it('getContextWindow() reads *.context_length from /api/show model_info', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, {
      model_info: { 'gemma.context_length': 100000 }
    }));

    expect(await strategy.getContextWindow()).toBe(100000);
  });

  it('hasVisionCapability() true when capabilities includes vision', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, { capabilities: ['vision'] }));

    expect(await strategy.hasVisionCapability('test-model')).toBe(true);
  });
});
```

```typescript
// src/services/clients/llm/lifecycle/LlamaCppRouterLifecycleStrategy.test.ts
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { LlamaCppRouterLifecycleStrategy } from './LlamaCppRouterLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('LlamaCppRouterLifecycleStrategy', () => {
  let strategy: LlamaCppRouterLifecycleStrategy;

  beforeEach((): void => {
    global.fetch = jest.fn();
    strategy = new LlamaCppRouterLifecycleStrategy(
      new URL('http://localhost:8080'),
      null,
      mockLogger as never);
  });

  it('free() posts model to /models/unload', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, { success: true }));

    expect(await strategy.free()).toBe(true);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe('http://localhost:8080/models/unload');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'test-model' });
  });

  it('isModelLoaded() true when /models lists status loaded', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, {
      models: [{ model: 'test-model', status: { value: 'loaded' } }]
    }));

    expect(await strategy.isModelLoaded()).toBe(true);
  });

  it('waitForModelUnload() polls /models until status unloaded', async (): Promise<void> {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200, { success: true }))  // free
      .mockResolvedValueOnce(mockResponse(200, {
        models: [{ model: 'test-model', status: { value: 'loaded' } }]
      }))
      .mockResolvedValueOnce(mockResponse(200, {
        models: [{ model: 'test-model', status: { value: 'unloaded' } }]
      }));

    expect(await strategy.waitForModelUnload(10)).toBe(true);
  });

  it('getContextWindow() always null', async (): Promise<void> => {
    expect(await strategy.getContextWindow()).toBeNull();
  });
});
```

```typescript
// src/services/clients/llm/lifecycle/LlamaCppSingleLifecycleStrategy.test.ts
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { LlamaCppSingleLifecycleStrategy } from './LlamaCppSingleLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('LlamaCppSingleLifecycleStrategy', () => methods here
);
```

*(complete the LlamaCppSingle test body per pattern above: free() resolves true without any fetch call; waitForModelUnload polls GET /props until `is_sleeping === true` — mock sequence: `is_sleeping: false`, then `is_sleeping: true`, expect 2 calls, returns true; getContextWindow() null; hasVisionCapability() false without fetch unless visionModels arg contains model — constructor takes `(url, token, logger, visionModels?: string[])`)*

*(complete NullLifecycleStrategy.test.ts: all methods no-op — free() true, isModelLoaded() false, waitForModelUnload() true with zero fetch calls, getContextWindow() null, hasVisionCapability() only true if model in visionModels arg)*

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/services/clients/llm/lifecycle`
Expected: FAIL — cannot resolve strategy modules

- [ ] **Step 3: Write minimal implementations**

```typescript
// src/services/clients/llm/lifecycle/ILlmLifecycleStrategy.ts
export interface ILlmLifecycleStrategy {
  free(): Promise<boolean>;
  isModelLoaded(): Promise<boolean>;
  waitForModelUnload(intervalMs?: number): Promise<boolean>;
  getContextWindow(): Promise<number | null>;
  hasVisionCapability(model?: string): Promise<boolean>;
}
```

```typescript
// src/services/clients/llm/lifecycle/OllamaLifecycleStrategy.ts
import { ILogger } from '../../../ILogger.js';
import { ILlmHost } from '../models/ILlmHost.js';
import { ILlmLifecycleStrategy } from './ILlmLifecycleStrategy.js';

export class OllamaLifecycleStrategy implements ILlmLifecycleStrategy {
  readonly #host: ILlmHost;
  readonly #model: string;
  readonly #logger: ILogger;
  readonly #intervalMs: number;

  constructor(host: ILlmHost, model: string, logger: ILogger, intervalMs: number) {
    this.#host = host;
    this.#model = model;
    this.#logger = logger;
    this.#intervalMs = intervalMs;
  }

  async free(): Promise<boolean> {
    try {
      const response = await fetch(new URL('/api/generate', this.#host.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.#model, keep_alive: 0 })
      });

      return response.ok;
    } catch (error) {
      this.#logger.error('Failed to free Ollama resources:', error);
      return false;
    }
  }

  async isModelLoaded(): Promise<boolean> {
    try {
      const response = await fetch(new URL('/api/ps', this.#host.url));
      if (!response.ok) {
        return false;
      }

      const payload = await response.json() as { models?: Array<{ name?: string; model?: string }> };
      return payload.models?.some(m => m.name === this.#model || m.model === this.#model) ?? false;
    } catch {
      return false;
    }
  }

  async waitForModelUnload(intervalMs = this.#intervalMs): Promise<boolean> {
    const freed = await this.free();
    if (!freed) {
      return false;
    }

    let attempt = 0;
    while (true) {
      const loaded = await this.isModelLoaded();
      if (!loaded) {
        this.#logger.info(`Model ${this.#model} unloaded after ${attempt + 1} check(s).`);
        return true;
      }

      attempt++;
      this.#logger.info(`Model ${this.#model} still loaded; waiting ${intervalMs}ms (attempt ${attempt}).`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  async getContextWindow(): Promise<number | null> {
    try {
      const response = await fetch(new URL('/api/show', this.#host.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.#model })
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json() as { model_info?: Record<string, unknown> };

      for (const [key, value] of Object.entries(payload.model_info ?? {})) {
        if (key.endsWith('.context_length')) {
          return value as number;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async hasVisionCapability(model: string = this.#model): Promise<boolean> {
    try {
      const response = await fetch(new URL('/api/show', this.#host.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json() as { capabilities?: string[] };
      return payload.capabilities?.includes('vision') ?? false;
    } catch {
      return false;
    }
  }
}
```

*(LlamaCppRouterLifecycleStrategy: same structure — free() POST /models/unload body `{ model }`; isModelLoaded() GET /models, match `models[].model === model && status.value === 'loaded'`; waitForModelUnload() poll until status.value !== 'loaded' AND !== 'loading'; getContextWindow() → null; hasVisionCapability(model) → `this.#visionModels.includes(model)` where visionModels: string[] is a constructor arg.)*

*(LlamaCppSingleLifecycleStrategy: free() resolves true with no fetch; waitForModelUnload() polls GET /props until `is_sleeping === true`; isModelLoaded() → true when a free was requested but props shows not sleeping? NO — per spec: single-mode has no load-status endpoint; isModelLoaded() returns false always (model assumed resident, nothing to gate on); getContextWindow() null; hasVisionCapability(model) via visionModels arg.)*

*(NullLifecycleStrategy: free() true; isModelLoaded() false; waitForModelUnload() true immediately; getContextWindow() null; hasVisionCapability(model) via visionModels arg.)*

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/clients/llm/lifecycle`
Expected: PASS (4 suites)

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`
```bash
git add src/services/clients/llm/lifecycle
git commit -m "feat: add ILlmLifecycleStrategy with Ollama, llama.cpp router/single, and Null strategies"
```

---

### Task 3: `LlmHostFlavorRegistry`

**Files:**
- Create: `src/services/clients/llm/LlmHostFlavorRegistry.ts`
- Test: `src/services/clients/llm/LlmHostFlavorRegistry.test.ts`

**Interfaces:**
- Consumes: `ILlmHost`, `LlmHostFlavor` (Task 1); `dns.lookup` from `node:dns`; `dns.lookup` from `node:dns/promises`.
- Produces: `LlmHostFlavorRegistry` class:
  - `constructor(logger: ILogger)`
  - `probeHost(host: ILlmHost, probeTimeoutMs: number): Promise<void>` — fetch probe calls, priority-ordered, with AbortController timeout; caches result internally keyed by `host.url.toString()`.
  - `resolve(host: ILlmHost): { flavor: LlmHostFlavor, isLocal: boolean }` — cache-first; if probe not yet run for that URL, returns `{ flavor: Generic, isLocal: true }` (conservative default). Registry filled externally by `FeatureService` at startup — wait, no. Per spec: "Singleton per bot container. Probes each configured host once at startup." — so probe happens in `loadFeatures()`. `resolve()` is pure cache lookup with conservative default.
  - `clear(): void` — test isolation.

Probe priority (from spec, must match exactly): 1. `GET {url}/api/ps` → 200 ⇒ ollama; 2. `GET {url}/models` (non-/v1) → 200 ⇒ llamacpp-router; 3. `GET {url}/props` → 200 ⇒ llamacpp-single; 4. else ⇒ generic.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/clients/llm/LlmHostFlavorRegistry.test.ts
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { LlmHostFlavor } from './enums/LlmHostFlavor.js';
import { ILlmHost } from './models/ILlmHost.js';
import { LlmHostFlavorRegistry } from './LlmHostFlavorRegistry.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function host(url: string, isLocal: boolean | null = null): ILlmHost {
  return { url: new URL(url), token: null, isLocal };
}

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('LlmHostFlavorRegistry', () => {
  let registry: LlmHostFlavorRegistry;

  beforeEach((): void => {
    registry = new LlmHostFlavorRegistry(mockLogger as never);
    global.fetch = jest.fn();
  });

  it('classifies ollama when /api/ps responds 200', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, { models: [] }));

    await registry.probeHost(host('http://localhost:11434'));

    expect(registry.resolve(host('http://localhost:11434')).flavor).toBe(LlmHostFlavor.Ollama);
  });

  it('classifies llamacpp-router when /models (non-/v1) responds 200 and /api/ps did not', async (): Promise<void> => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))  // /api/ps
      .mockResolvedValueOnce(mockResponse(200, { models: [] }));           // /models

    await registry.probeHost(host('http://localhost:8080'));

    expect(registry.resolve(host('http://localhost:8080')).flavor).toBe(LlmHostFlavor.LlamaCppRouter);
  });

  it('classifies llamacpp-single when only /props responds 200', async (): Promise<void> => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response('nf', { status: 404 }))   // /api/ps
      .mockResolvedValueOnce(new Response('nf', { status: 404 }))    // /models
      .mockResolvedValueOnce(mockResponse(200, { is_sleeping: false })); // /props

    await registry.probeHost(host('http://localhost:8081'));

    expect(registry.resolve(host('http://localhost:8081')).flavor).toBe(LlmHostFlavor.LlamaCppSingle);
  });

  it('classifies generic when nothing responds 200', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response('nf', { status: 404 }));

    await registry.probeHost(host('https://api.openai.com'));

    expect(registry.resolve(host('https://api.openai.com')).flavor).toBe(LlmHostFlavor.Generic);
  });

  it('returns conservative generic+local default for unprobed host', (): void => {
    const resolved = registry.resolve(host('https://api.openai.com'));

    expect(resolved.flavor).toBe(LlmHostFlavor.Generic);
    expect(resolved.isLocal).toBe(true);
  });

  it('explicit isLocal flag wins over auto-detect', async (): Promise<void> => {
    registry.probeHost; // no-op reference
    const resolved = registry.resolve(host('https://api.openai.com', false));

    expect(resolved.isLocal).toBe(false);
  });

  it('auto-detects localhost hostname as local', (): void => {
    expect(registry.resolve(host('http://localhost:11434')).isLocal).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/clients/llm/LlmHostFlavorRegistry.test.ts`
Expected: FAIL — cannot resolve `./LlmHostFlavorRegistry.js`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/clients/llm/LlmHostFlavorRegistry.ts
import { lookup } from 'node:dns/promises';

import { ILogger } from '../../ILogger.js';
import { LlmHostFlavor } from './enums/LlmHostFlavor.js';
import { ILlmHost } from './models/ILlmHost.js';

interface IHostClassification {
  flavor: LlmHostFlavor;
  isLocal: boolean;
}

export class LlmHostFlavorRegistry {
  readonly #logger: ILogger;
  readonly #classifications = new Map<string, IHostClassification>();

  constructor(logger: ILogger) {
    this.#logger = logger;
  }

  async probeHost(host: ILlmHost, probeTimeoutMs: number = 2000): Promise<void> {
    const flavor = await this.#probeFlavor(host, probeTimeoutMs);
    const isLocal = await this.#resolveIsLocal(host);
    this.#classifications.set(host.url.toString(), { flavor, isLocal });
    this.#logger.info(`LLM host ${host.url} classified as '${flavor}' (isLocal: ${isLocal}).`);
  }

  resolve(host: ILlmHost): IHostClassification {
    const cached = this.#classifications.get(host.url.toString());

    if (cached !== undefined) {
      return cached;
    }

    // Conservative default: assume generic/local until probed.
    return { flavor: LlmHostFlavor.Generic, isLocal: true };
  }

  clear(): void {
    this.#classifications.clear();
  }

  async #probeFlavor(host: ILlmHost, probeTimeoutMs: number): Promise<LlmHostFlavor> {
    const probes: Array<{ path: string, flavor: LlmHostFlavor }> = [
      { path: '/api/ps', flavor: LlmHostFlavor.Ollama },
      { path: '/models', flavor: LlmHostFlavor.LlamaCppRouter },
      { path: '/props', flavor: LlmHostFlavor.LlamaCppSingle }
    ];

    for (const probe of probes) {
      try {
        const response = await fetch(new URL(probe.path, host.url), {
          signal: AbortSignal.timeout(probeTimeoutMs)
        });

        if (response.ok) {
          return probe.flavor;
        }
      } catch {
        // Continue to next probe.
      }
    }

    return LlmHostFlavor.Generic;
  }

  async #resolveIsLocal(host: ILlmHost): Promise<boolean> {
    if (host.isLocal !== null) {
      return host.isLocal;
    }

    const hostname = host.url.hostname;

    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1') {
      return true;
    }

    try {
      const result = await lookup(hostname);
      return this.#isPrivateAddress(result.address);
    } catch {
      // Unresolvable → conservatively local.
      return true;
    }
  }

  #isPrivateAddress(address: string): boolean {
    if (address.includes(':')) {
      // IPv6 ULA fc00::/7 or link-local fe80::/10
      const lower = address.toLowerCase();
      return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
    }

    const octets = address.split('.').map(Number);

    if (octets.length !== 4 || octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) {
      return false;
    }

    return octets[0] === 10
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)   // Tailscale CGNAT
      || (octets[0] === 169 && octets[1] === 254);                     // link-local
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/clients/llm/LlmHostFlavorRegistry.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`
```bash
git add src/services/clients/llm/LlmHostFlavorRegistry.ts src/services/clients/llm/LlmHostFlavorRegistry.test.ts
git commit -m "feat: add LlmHostFlavorRegistry startup probe and isLocal resolution"
```

---

### Task 4: `ILlmClient` + `LlmClient` (fetch-based OpenAI-compatible protocol layer)

**Files:**
- Create: `src/services/clients/llm/ILlmClient.ts`
- Create: `src/services/clients/llm/LlmClient.ts`
- Test: `src/services/clients/llm/LlmClient.test.ts`

**Interfaces:**
- Consumes: all Task 1 DTOs; `ILlmLifecycleStrategy` (Task 2); `LlmHostFlavorRegistry` (Task 3); `IHttpExchange`, `IHttpExchangeWithAttachedData` (existing); `trimTrailingJsonContent`, `getRandomArrayEntry`, `getRandomInt` (existing utils).
- Produces: `ILlmClient` interface — exact surface (consumers + tests depend on these names):

```typescript
export interface ILlmClient {
  readonly host: URL;
  readonly model: string;
  generate(prompt: string, temperature?: number): Promise<IHttpExchange<ILlmRequest, LlmGenerateResult>>;
  generateStructured<TOutput>(prompt: string, requestData: IStructuredRequestData): Promise<IHttpExchangeWithAttachedData<ILlmRequest, LlmGenerateResult, TOutput>>;
  sendMessage(prompt: string, context: LlmMessage[], images?: string[]): Promise<IHttpExchangeWithAttachedData<ILlmRequest, LlmChatResult, LlmMessage[]>>;
  sendMessageAndGetStream(prompt: string, context: LlmMessage[], images?: string[]): Promise<IHttpExchangeWithAttachedData<ILlmRequest, AsyncIterable<LlmStreamChunk>, LlmMessage[]> | null>;
  embed(input: string): Promise<number[]>;
  embedBatch(inputs: string[]): Promise<number[][]>;
  interpretImages(images: string[], contextPrompt?: string): Promise<string>;
  free(): Promise<boolean>;
  isModelLoaded(): Promise<boolean>;
  waitForModelUnload(intervalMs?: number): Promise<boolean>;
  hasVisionCapability(model?: string): Promise<boolean>;
  show(model?: string): Promise<ShowResponse>;  // kept on ILlmClient for FeatureService/ContextCompression until re-typed in Task 6
}
```

Define `ILlmRequest` in `src/services/clients/llm/models/ILlmRequest.ts`:
```typescript
export interface ILlmRequest {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  response_format?: { type: string; json_schema?: { name: string; schema: object } };
  stream?: boolean;
}
```

`ShowResponse` stays the ollama-js import until Task 6 — NO. Global Constraints: no ollama-js types anywhere. Instead define `LlmShowResponse` in `src/services/clients/llm/models/LlmShowResponse.ts`:
```typescript
export interface LlmShowResponse {
  model_info?: Record<string, unknown>;
  capabilities?: string[];
}
```
`ILlmClient.show` returns `Promise<LlmShowResponse>`.

`LlmClient` constructor: `(services: IBotServiceContainer)` — picks random host from `configurationService.llmHosts` (Task 6 renames it — this task codes against `llmHosts` and the registry property added in Task 6; until then the config service still exposes `ollamaHosts` — **resolution: this task consumes `services.llmHostFlavorRegistry` (new property added in Task 6) and `configurationService.llmHosts` (renamed in Task 6). To keep the branch compiling between Task 4 and Task 6, this task creates `LlmClient` with a constructor-local shim: it reads `(this.#configurationService as { llmHosts?: ILlmHost[] }).llmHosts ?? (this.#configurationService as { ollamaHosts?: URL[] }).ollamaHosts?.map(...)` — NO, that's messy.** Cleaner: Task 4 only defines the interface + LlmClient consuming `IConfigurationService.llmHosts: ILlmHost[]` — the config rename happens FIRST in the same commit as Task 4, so the config service must be updated in Task 4's commit too. **REVISED Task 4 scope: config rename (`ollamaHosts`→`llmHosts: ILlmHost[]`, all `ollama*`→`llm*` accessors, `IBotConfig.ollama`→`IBotConfig.llm` with host objects + `visionModels`, `#validateMode` update, `#logConfiguration` update) happens in Task 4, together with the client.** This keeps every commit compiling.

- [ ] **Step 1: Write the failing test**

*(Write `LlmClient.test.ts` mocking `global.fetch` — tests for: host/model random selection logging; generate() posts single-user-message chat completion body `{ model, messages: [{role:'user',content:prompt}], temperature }` to `{url}/v1/chat/completions`, returns `LlmGenerateResult` mapped from `choices[0].message.content` + usage; sendMessage() appends user message, returns message + pushes response into context; sendMessageAndGetStream() returns AsyncIterable of LlmStreamChunk parsed from SSE `data:` lines, final chunk carries usage; Bearer header only when token present; structured output sends response_format json_schema + parses trimmed JSON; embeddings POST /v1/embeddings `{ model, input }` returning data[0].embedding; embedBatch maps data[].embedding in input order; interpretImages builds the hardcoded vision prompt + single user message with image_url content parts `data:image/jpeg;base64,...`; error wrapping preserves `.cause`; calculateTokensPerSecond static re-typed to `LlmGenerateResult` using completionTokens/completionTokensPerSecond — see Step 3 for exact mapping code. Assert `Authorization` header absent when token null.)*

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/clients/llm/LlmClient.test.ts`
Expected: FAIL — cannot resolve

- [ ] **Step 3: Write minimal implementation**

*(Key implementation code, abbreviated for plan — implementer writes full file; the wire shapes and behavior are normative):*

```typescript
// src/services/clients/llm/LlmClient.ts — core wire methods
async generate(prompt: string, temperature?: number): Promise<IHttpExchange<ILlmRequest, LlmGenerateResult>> {
  const request: ILlmRequest = this.#buildChatRequest([{ role: LlmRole.User, content: prompt }], temperature);
  const body = await this.#postJson('/v1/chat/completions', request);
  return { request, response: this.#toGenerateResult(body) };
}

async sendMessage(prompt: string, context: LlmMessage[], images: string[] = []): Promise<...> {
  const userMessage = { role: LlmRole.User, content: prompt, ...(images.length ? { images } : {}) } as LlmMessage;
  const messages = [...context, userMessage];
  const request = this.#buildChatRequest(messages);
  const body = await this.#postJson('/v1/chat/completions', { ...request, stream: false });
  const assistantMessage: LlmMessage = {
    role: body.choices?.[0]?.message?.role === 'assistant' ? LlmRole.Assistant : LlmRole.Assistant,
    content: body.choices?.[0]?.message?.content ?? ''
  };
  context.push(assistantMessage);
  return { exchange: { request, response: this.#toChatResult(body) }, data: context };
}

async *#streamChunks(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<LlmStreamChunk> {
  // SSE parse: buffer split on \n\n, lines starting 'data:', '[DONE]' terminates,
  // chunk.content += choices[0].delta.content ?? '', done flag on [DONE],
  // usage on final chunk when body.usage present (stream_options include_usage).
}
```

Strategy selection in constructor (from spec):
```
isLocal === false            → NullLifecycleStrategy
flavor === 'ollama'          → OllamaLifecycleStrategy
flavor === 'llamacpp-router' → LlamaCppRouterLifecycleStrategy
flavor === 'llamacpp-single' → LlamaCppSingleLifecycleStrategy
else                          → NullLifecycleStrategy
```

*(Config rename in this same task — modify `IBotConfig.ts` lines 28-37 to `llm: { hosts: ILlmHostConfig[]; models: string[]; systemPrompt: string | string[]; streamsResponse: boolean; embeddingModel?: string; visionModels?: string[]; topK?: number; contextWindow?: number; contextCompressionThreshold?: number }` where `ILlmHostConfig = { url: string; token?: string; isLocal?: boolean }` defined in its own file `src/services/environment-settings/ILlmHostConfig.ts` (no anonymous types — user constraint). `IConfigurationService.ts`: `ollamaHosts: URL[]` → `llmHosts: ILlmHost[]`; all `ollama*` → `llm*` (`llmModels`, `llmSystemPrompt`, `llmStreamsResponse`, `llmFeatureModels`, `llmEmbeddingModel`, `llmTopK`, `llmContextWindow`, `llmContextCompressionThreshold`, `llmVisionModels`). `ConfigurationService.ts`: implement new getters (parse host objects, reject bare strings with migration-pointer error `Bare-string hosts are no longer supported; wrap each host as { "url": "..." }. See docs/musebot/04-migration-v10.md.`), `#validateMode()` requires `llm.hosts` non-empty in chat mode + info note when serial strategy + any non-local host, `#logConfiguration` logs llm.* lines.)*

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/clients/llm/LlmClient.test.ts src/services/environment-settings`
Expected: PASS

- [ ] **Step 5: Lint + full-suite commit**

Run: `npm run lint`
Run: `npm test` — expected: some existing tests referencing `ollamaClient`/`ollamaHosts` fail; that is ACCEPTABLE at this commit boundary only if the task's own tests pass and the branch still compiles (`npm run build`). Record the failing list in the report; Task 5 fixes them in the rename sweep.

```bash
git add src/services/clients/llm src/services/environment-settings
git commit -m "feat: add ILlmClient/LlmClient with OpenAI-compatible wire protocol and llm config rename"
```

---

### Task 5: Rename sweep — tasks, reply services, filters, consumers, container

**Files:**
- Modify: `src/services/IBotServiceContainer.ts`, `src/services/BotServiceContainer.ts`, `src/services/GlobalServiceContainer.ts`
- Modify: all files under `src/services/clients/llm/ollama/` — renamed per table; delete old folder at the end
- Modify: `src/services/clients/chat/discord/ollama/` → files renamed `OllamaReplyService.ts`→`LlmReplyService.ts`, `OllamaStreamingReplyService.ts`→`LlmStreamingReplyService.ts`, `DiscordOllamaContextMessageFactory.ts`→`DiscordLlmContextMessageFactory.ts`; folder `ollama/` → rename files only, keep folder? **Decision: rename folder to `llm/`?** — No: keep `chat/discord/ollama/` folder renamed to `chat/discord/llm/` for neutrality; `DiscordChatMessageFactory.ts` + `DiscordLlmChatMessageFactory.ts` move unchanged (import paths only).
- Modify: `src/services/clients/chat/IInputChatMessageFilter.ts`, `GenerativeChatClient.ts`, `IMemoryService.ts`, `MemoryService.ts`, `DiscordMemoryInputFilter.ts`, `DiscordCodeBlockExtractFilter.ts`, `ContextCompressionService.ts`, `ContextService.ts` + `IContextService.ts` + `IContextMessageFactory.ts` (generic type param renames only), `GenerativeAiChannelPostProcessor.ts`, `FeatureService.ts`, `ComfyUiBaseTask.ts`, `ComfyUiAttachmentTask.ts`, `ComfyUiMessageTask.ts` (call-site re-types only)
- Modify: `src/test-utils/mockBotServiceContainer.ts`
- Modify: `src/services/clients/media/comfy-ui/services/workflow-mutators/ExpandPromptMutator.ts`, `RandomPromptMutator.ts`, `MessageToMusicMutator.ts` (+ their `.test.ts` files)
- Delete: `src/services/clients/llm/ollama/` (entire folder) after moves
- Modify: `package.json` — remove `"ollama": "^0.6.0"` from dependencies

**Interfaces:**
- Consumes: Task 4's `ILlmClient`, `llmClient` property, `llm*` config accessors.
- Produces: fully renamed consumer layer. `IBotServiceContainer` key changes: `ollamaClient: OllamaClient` → `llmClient: ILlmClient`; `ollamaReplyService` → `llmReplyService`; `ollamaStreamingReplyService` → `llmStreamingReplyService`; new singleton property `llmHostFlavorRegistry: LlmHostFlavorRegistry`; factory return types re-typed to neutral DTOs (`getLlmGenerateTask(...): BaseTask<IHttpExchange<ILlmRequest, LlmGenerateResult>>`, `getLlmGenerateStructuredTask<T>(...): BaseTask<IHttpExchangeWithAttachedData<ILlmRequest, LlmGenerateResult, T>>`).

Rename table (all Ollama* → Llm* classes): `OllamaBaseTask`→`LlmBaseTask`, `OllamaGenerateTask`→`LlmGenerateTask`, `OllamaGenerateStructuredTask`→`LlmGenerateStructuredTask`, `OllamaMessageTask`→`LlmMessageTask`, `OllamaEmojiReactionTask`→`LlmEmojiReactionTask`, `OllamaEmbedTask`→`LlmEmbedTask`, `OllamaTaskChannelPostProcessor`→`LlmTaskChannelPostProcessor`, `LlmReplyService`, `LlmStreamingReplyService`, `DiscordLlmContextMessageFactory`. Tasks move from `clients/llm/ollama/tasks/` → `clients/llm/tasks/`. Reply services move from `chat/discord/ollama/` → `chat/discord/llm/`.

- [ ] **Step 1: Update the interface first**

Modify `src/services/IBotServiceContainer.ts`:
- Remove `import { GenerateRequest, GenerateResponse } from 'ollama';`
- `ollamaClient: OllamaClient` → `llmClient: ILlmClient`
- `ollamaReplyService: OllamaReplyService` → `llmReplyService: LlmReplyService`
- `ollamaStreamingReplyService: OllamaStreamingReplyService` → `llmStreamingReplyService: LlmStreamingReplyService`
- Add `llmHostFlavorRegistry: LlmHostFlavorRegistry;` to singletons
- Re-type factory signatures per the Produces block

- [ ] **Step 2: Sweep consumers (mechanical, type-level only — no behavior changes)**

For every file listed in Files:
- Replace `import { Message as OllamaMessage } from 'ollama'` → `import { LlmMessage } from '.../models/LlmMessage.js'` (and `OllamaMessage`→`LlmMessage` everywhere in that file)
- Replace `GenerateRequest/GenerateResponse` imports → `ILlmRequest/LlmGenerateResult` from `.../clients/llm/models/...`
- Replace `ChatRequest/ChatResponse` → `ILlmRequest/LlmChatResult`
- `OllamaRole` → `LlmRole`; `OLLAMA_TEMPERATURE_*` → `LLM_TEMPERATURE_*` from `LlmConstants.js`
- `services.ollamaClient` → `services.llmClient`; local var names `ollamaClient` → `llmClient`
- Class renames per table; `getLogger('OllamaX')` → `getLogger('LlmX')`
- `OllamaMessageTask.ts:96-99` and `:186-187`: `response.prompt_eval_count`→`response.promptTokens`, `response.eval_count`→`response.completionTokens` (LlmChatResult/LlmStreamChunk fields)
- `ExpandPromptMutator.ts:75` and `RandomPromptMutator.ts:81,83`: `payload.response.response`→`payload.response.content`
- `OllamaMessageTask.ts:285`: `payload.response.response`→`payload.response.content`
- `ContextCompressionService.ts`: `show()` usage replaced by strategy chain: `#resolveContextWindow()` order = config `llmContextWindow` → `await this.#services.llmClient.getContextWindow()`… wait — `getContextWindow` is not on `ILlmClient`. Spec: "Context window resolution order (ContextCompressionService): config llm.contextWindow → strategy result → fallback 4096." So `ILlmClient` must also expose `getContextWindow(): Promise<number | null>` delegating to strategy. ADD to Task 4's `ILlmClient` interface: `getContextWindow(): Promise<number | null>;`. Task 5 wires `ContextCompressionService.#resolveContextWindow` to use config → `llmClient.getContextWindow()` → 4096.
- `ComfyUiBaseTask.ts:50` / `ComfyUiMessageTask.ts` / `ComfyUiInteractionTask.ts` / `ComfyUiAttachmentTask.ts:158`: re-type `#ollamaClient` field to `ILlmClient`, rename to `#llmClient`, `services.ollamaClient` → `services.llmClient`
- `FeatureService.ts`: `ollamaHosts`→`llmHosts`, `ollamaModels`→`llmModels`, `ollamaEmbeddingModel`→`llmEmbeddingModel`, `services.ollamaClient`→`services.llmClient`; ADD registry probing in `loadFeatures()` before vision probe:

```typescript
// insert at top of loadFeatures(), after loadWorkflows():
const registry = this.#services.llmHostFlavorRegistry;
for (const host of this.#configurationService.llmHosts) {
  await registry.probeHost(host);
}
```

- [ ] **Step 3: Move + rename task files**

Move each `clients/llm/ollama/tasks/Ollama*.ts` (+ `.test.ts`) to `clients/llm/tasks/Llm*.ts` with class renames, updated imports (DTOs, `LLM_TEMPERATURE_DEFAULT`, `LlmRole`, `LlmBaseTask`), and the response-field changes listed above. `LlmBaseTask` field renames: `ollamaClient`→`llmClient`, `ollamaReplyService`→`llmReplyService`, `ollamaStreamingReplyService`→`llmStreamingReplyService`. `LlmTaskChannelPostProcessor` frees via `services.llmClient.free()`.

- [ ] **Step 4: Update the shared mock + fix remaining test files**

`src/test-utils/mockBotServiceContainer.ts`: `ollamaClient: null as never` → `llmClient: null as never`; add `llmHostFlavorRegistry: null as never`; config literal `ollamaHosts: []` → `llmHosts: []`, `ollamaModels: []` → `llmModels: []`, `ollamaSystemPrompt` → `llmSystemPrompt: ''`, `ollamaStreamsResponse` → `llmStreamsResponse: false`, `ollamaEmbeddingModel` → `llmEmbeddingModel: null`, `ollamaTopK` → `llmTopK: 5`, `ollamaContextWindow` → `llmContextWindow: null`, `ollamaContextCompressionThreshold` → `llmContextCompressionThreshold: 0.75`, add `llmVisionModels: []`.

Then fix each consumer test file mechanically (jest.Mocked<OllamaClient> literals → jest.Mocked<ILlmClient> with identical method names; config keys swapped). List of affected test files: `OllamaGenerateTask.test.ts`, `OllamaGenerateStructuredTask.test.ts`, `OllamaMessageTask.test.ts`, `OllamaBaseTask.test.ts` (→ moved+renamed as `Llm*.test.ts`), `ContextCompressionService.test.ts`, `MemoryService.test.ts`, `GenerativeAiChannelPostProcessor.test.ts`, `FeatureService.test.ts`, `ComfyUiBaseTask.test.ts`, `ComfyUiMessageTask.test.ts`, `ComfyUiInteractionTask.test.ts`, `ContextService.test.ts`, `JsonMutator.test.ts`, `MessageToMusicMutator.test.ts`, `ComfyUiClient.test.ts`, `OllamaClient.test.ts` (DELETE — replaced by `LlmClient.test.ts` from Task 4).

- [ ] **Step 5: Full suite green + delete old folder + drop dependency**

Run: `npm run build` (must compile clean)
Run: `npm test` — ALL suites PASS
Run: `npm run lint`
```bash
git add -A
git commit -m "refactor: rename Ollama client layer to Llm with neutral DTOs across consumers"
git rm -r src/services/clients/llm/ollama
npm uninstall ollama
git commit -am "chore: remove ollama npm dependency and delete legacy ollama folder"
```

*(If `npm uninstall ollama` leaves `package-lock.json` and `node_modules` stale relative to tests, `npm install` first. Verify no file imports 'ollama': `grep -r "from 'ollama'" src/` must return nothing.)*

---

### Task 6: Feature detection + docs

**Files:**
- Modify: `src/services/features/FeatureService.ts` (registry probing added in Task 5 — verify placement)
- Modify: `docs/chat/01-ollama.md` → Create `docs/chat/01-llm.md` (delete old)
- Create: `docs/musebot/04-migration-v10.md`
- Modify: `docs/musebot/02-configuration.md`
- Modify: `config.example.jsonc`
- Modify: `AGENTS.md`
- Modify: `docs/musebot/03-migration-from-env-to-jsonc.md` (stale refs)
- Modify: `docs/adr/003-drop-env-support.md` (stale refs)

**Interfaces:**
- Consumes: final config surface from Tasks 4-5.
- Produces: docs describing the new `llm:` config, provider matrix, migration guide.

- [ ] **Step 1: Write `docs/chat/01-llm.md`**

Rewrite of the old Ollama doc structured as: intro (any OpenAI-compatible platform); provider matrix table (Ollama: full auto-detect + vision + context window + true unload via /api/ps; llama.cpp router mode: launch `llama-server` without `-m` + `--models-dir`, unload via POST /models/unload, vision via `visionModels` config, no context-window detection — set `llm.contextWindow` manually; llama.cpp single-model: requires `--sleep-idle-seconds N` for wait-unload to terminate, vision + contextWindow via config; hosted/cloud: no lifecycle, vision via `visionModels`, token per host); config sample (llm: block from spec); vision section (Ollama auto-detect via /api/show; `visionModels` for everything else); context compression (config llm.contextWindow → strategy probe → 4096 fallback); streaming (stream_options include_usage); auth section (token field, Bearer header, config.jsonc never committed).

- [ ] **Step 2: Write `docs/musebot/04-migration-v10.md`**

Structure: What changed (ollama: → llm:, hosts strings → objects, new visionModels, renamed accessors); before/after config diff block (exact samples: before `"ollama": { "hosts": ["http://localhost:11434"], ... }` → after `"llm": { "hosts": [{ "url": "http://localhost:11434" }], "visionModels": [], ... }`); tokens (per-host optional, config.jsonc only, ADR 003); isLocal (auto-detect rules: localhost/127./::1; RFC1918, Tailscale CGNAT 100.64/10, link-local, IPv6 ULA via dns lookup; explicit flag wins; unresolvable→local conservative); llama.cpp guidance (router vs single mode, --sleep-idle-seconds, --models-dir); breaking-change note (bare-string hosts rejected with error pointing at this doc).

- [ ] changes to 02-configuration.md: replace the `ollama.*` reference section with `llm.*` (hosts objects incl. token/isLocal, models, systemPrompt, streamsResponse, embeddingModel, visionModels, topK, contextWindow, contextCompressionThreshold) — mirror the old section's format.
- [ ] `config.example.jsonc`: rewrite the ollama section (lines ~138-202) as the llm: block with host objects, placeholder token `"sk-..."` commented, visionModels sample, all optional fields commented like today.
- [ ] `AGENTS.md`: update repository structure map (`ollama/` folders → `llm/`, new `lifecycle/`, `tasks/` under clients/llm; `chat/discord/ollama/` → `chat/discord/llm/`), config table (`bots[].llm.hosts` objects with token, `bots[].llm.visionModels`, llm.* fields), architecture notes (Strategy pattern, registry, transient client), vocabulary (OllamaClient → LlmClient everywhere).
- [ ] Stale refs in `03-migration-from-env-to-jsonc.md` + ADR 003: `ollama.hosts` → `llm.hosts` mentions updated with a note that v10+ uses llm:.
- [ ] **Step 3: Lint + commit**

```bash
git add docs config.example.jsonc AGENTS.md
git commit -m "docs: document llm provider configuration, migration guide, and provider matrix"
```

---

### Task 7: Version bump + changelog + final verification

**Files:**
- Modify: `package.json` (version 9.6.0 → 10.0.0)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: everything complete from Tasks 1-6.
- Produces: released version metadata.

- [ ] **Step 1: Bump version + changelog**

`package.json`: `"version": "10.0.0"`. `CHANGELOG.md`: prepend a 10.0.0 section following the existing entry format (date 2026-10-08, breaking-change summary: config `ollama:` → `llm:` with host objects; new `visionModels`; `ollama` npm dependency removed; any OpenAI-compatible provider now supported with per-host tokens; lifecycle strategies per provider flavor; migration guide pointer `docs/musebot/04-migration-v10.md`).

- [ ] **Step 2: Full verification**

Run: `npm run build` — compiles clean
Run: `npm test` — all green
Run: `npm run lint` — 0 errors
Run: `grep -r "from 'ollama'" src/` → no matches (or `rg "from 'ollama'" src/` if rg available)
Run: `npm run parcel` — bundles clean (final smoke that the entry point resolves)

- [ ] build:bin verification is optional (pkg packaging) — run only if quick: `npm run build:bin` (skip if slow; note in report)

- [ ] **Step 3: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 10.0.0 and update changelog"
```