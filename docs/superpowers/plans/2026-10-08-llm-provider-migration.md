# LLM Provider Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Musebot's chat/generate/structured/embedding traffic from the Ollama-only client to any OpenAI-compatible API platform (Ollama, llama.cpp, hosted clouds) with optional per-host auth tokens, while preserving local VRAM lifecycle choreography.

**Architecture:** Strategy pattern — a neutral `ILlmClient` interface with one fetch-based `/v1/*` protocol client (`LlmClient`), four per-host `ILlmLifecycleStrategy` implementations (Ollama, llama.cpp router, llama.cpp single-model, Null/no-op), and a startup `LlmHostFlavorRegistry` that probes each configured host for flavor + `isLocal` and caches results. Neutral DTOs replace all leaked ollama-js types across ~25 files. Breaking config rename `ollama:` → `llm:` with host objects `{ url, token?, isLocal? }`.

**Tech Stack:** TypeScript 5.8 (ES2022, ESM, `.js` import extensions), Node 24 global `fetch`, Jest 30 + ts-jest, ESLint 9 flat config (typescript-eslint + simple-import-sort).

**Spec:** `docs/superpowers/specs/2026-10-08-llm-provider-migration-design.md`

## Global Constraints

- Version target: **10.0.0** (breaking config change; bump `package.json` version in final task).
- Never rename or alter behavior of: `LlmChatMessage`, factory method names (`getLlmGenerateTask` etc.), `ContextMessage`, `ResourceType.LargeLanguageModel`, `SerialStrategy`/`GlobalServiceContainer` channel logic.
- No SDKs — direct `fetch` only. The `ollama` npm dependency stays installed until Task 5 removes it (`npm uninstall ollama`) once the last `from 'ollama'` import is deleted.
- `Authorization: Bearer <token>` header sent only when the host has a non-null token — applies to LlmClient requests, all lifecycle strategy fetches, and registry probes alike (Content-Type: application/json on every POST).
- Raw generate (`generate`, `interpretImages`) = single-user-message `POST /v1/chat/completions` (NOT `/v1/completions`).
- Structured output wire format: `response_format: { type: 'json_schema', json_schema: { name: 'result', schema } }`; `trimTrailingJsonContent` remains a safety net.
- Streaming: `stream_options: { include_usage: true }`; SSE `data:` line parse; usage only guaranteed on final chunk.
- All new named types live in dedicated files — **no anonymous types** in `IBotConfig.llm`, `IConfigurationService`, strategy response payloads, registry probe payloads, or LlmClient wire payloads (user constraint: every type in its own file).
- Imports use `.js` extensions; sorted imports (simple-import-sort) enforced by `npm run lint`.
- `services.llmClient` is TRANSIENT — every access constructs a new client with a new random host + model. Flavor/isLocal probing must therefore be cached by host URL in a singleton registry.
- Interface method surface preserved verbatim (old `OllamaClient` method names) so consumer mocks stay mechanical. Two deliberate deltas: dead `calculateTokensPerSecond` (zero callers) is dropped, and `getContextWindow(): Promise<number | null>` is added (delegates to the lifecycle strategy).
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
- Create: `src/services/clients/llm/lifecycle/models/OllamaPsResponse.ts`
- Create: `src/services/clients/llm/lifecycle/models/OllamaPsModel.ts`
- Create: `src/services/clients/llm/lifecycle/models/OllamaShowResponse.ts`
- Create: `src/services/clients/llm/lifecycle/models/LlamaCppModelsResponse.ts`
- Create: `src/services/clients/llm/lifecycle/models/LlamaCppModelStatus.ts`
- Create: `src/services/clients/llm/lifecycle/models/LlamaCppPropsResponse.ts`
- Test: `src/services/clients/llm/lifecycle/OllamaLifecycleStrategy.test.ts`
- Test: `src/services/clients/llm/lifecycle/LlamaCppRouterLifecycleStrategy.test.ts`
- Test: `src/services/clients/llm/lifecycle/LlamaCppSingleLifecycleStrategy.test.ts`
- Test: `src/services/clients/llm/lifecycle/NullLifecycleStrategy.test.ts`

**Interfaces:**
- Consumes: `ILlmHost` (Task 1), `LlmConstants` not needed here.
- Produces: `ILlmLifecycleStrategy` interface — all later lifecycle consumers depend on this exact shape. Constructors (all strategies take `(host: ILlmHost, model: string, logger: ILogger, ...)` so `LlmClient` can construct them uniformly):

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

import { ILlmHost } from '../models/ILlmHost.js';
import { OllamaLifecycleStrategy } from './OllamaLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function makeHost(url: string, token: string | null = null): ILlmHost {
  return { url: new URL(url), token, isLocal: null };
}

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('OllamaLifecycleStrategy', () => {
  let strategy: OllamaLifecycleStrategy;

  beforeEach((): void => {
    global.fetch = jest.fn();
    strategy = new OllamaLifecycleStrategy(
      makeHost('http://localhost:11434'),
      'test-model',
      mockLogger as never,
      10);
  });

  it('free() posts keep_alive: 0 to /api/generate', async (): Promise<void> => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, {}));

    const result = await strategy.free();

    expect(result).toBe(true);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe('http://localhost:11434/api/generate');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'test-model', keep_alive: 0 });
  });

  it('sends Authorization header only when token present', async (): Promise<void> => {
    const authed = new OllamaLifecycleStrategy(
      makeHost('http://localhost:11434', 'secret-token'),
      'test-model',
      mockLogger as never,
      10);
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, {}));

    await authed.free();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
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
    expect((global.fetch as jest.Mock).toHaveBeenCalledTimes(3));
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

import { ILlmHost } from '../models/ILlmHost.js';
import { LlamaCppRouterLifecycleStrategy } from './LlamaCppRouterLifecycleStrategy.js';

const mockLogger = {
  debug: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn()
};

function makeHost(url: string, token: string | null = null): ILlmHost {
  return { url: new URL(url), token, isLocal: null };
}

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('LlamaCppRouterLifecycleStrategy', () => {
  let strategy: LlamaCppRouterLifecycleStrategy;

  beforeEach((): void => {
    global.fetch = jest.fn();
    strategy = new LlamaCppRouterLifecycleStrategy(
      makeHost('http://localhost:8080'),
      'test-model',
      mockLogger as never,
      ['vision-model']);
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

  it('waitForModelUnload() polls /models until status unloaded', async (): Promise<void> => {
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

  it('hasVisionCapability() true when model in visionModels', async (): Promise<void> => {
    expect(await strategy.hasVisionCapability('vision-model')).toBe(true);
    expect(await strategy.hasVisionCapability('other-model')).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

*(complete the LlamaCppSingleLifecycleStrategy.test.ts per the Ollama/Router patterns above: constructor `(host, model, logger, visionModels?: string[])`; free() resolves true WITHOUT any fetch call; waitForModelUnload() polls GET /props until `is_sleeping === true` — mock sequence: `is_sleeping: false` then `is_sleeping: true`, expect 2 fetch calls, returns true; isModelLoaded() returns false always (no fetch); getContextWindow() null; hasVisionCapability() via visionModels arg only, no fetch. Also test that waitForModelUnload does NOT call free() first — single-mode has no unload endpoint, it just polls /props for the externally-configured `--sleep-idle-seconds` sleep.)*

*(complete NullLifecycleStrategy.test.ts: all methods no-op — free() true, isModelLoaded() false, waitForModelUnload() true with ZERO fetch calls, getContextWindow() null, hasVisionCapability(model) only true if model in visionModels arg; constructor `(host, model, logger, visionModels?: string[])`.)*

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/services/clients/llm/lifecycle`
Expected: FAIL — cannot resolve strategy modules

- [ ] **Step 3: Write minimal implementations**

First the named response DTOs (NO-ANONYMOUS-TYPES constraint — one interface per file):

```typescript
// src/services/clients/llm/lifecycle/models/OllamaPsModel.ts
export interface OllamaPsModel {
  name?: string;
  model?: string;
}
```

```typescript
// src/services/clients/llm/lifecycle/models/OllamaPsResponse.ts
import { OllamaPsModel } from './OllamaPsModel.js';

export interface OllamaPsResponse {
  models?: OllamaPsModel[];
}
```

```typescript
// src/services/clients/llm/lifecycle/models/OllamaShowResponse.ts
export interface OllamaShowResponse {
  model_info?: Record<string, unknown>;
  capabilities?: string[];
}
```

```typescript
// src/services/clients/llm/lifecycle/models/LlamaCppModelStatus.ts
export interface LlamaCppModelStatus {
  value?: string;
}
```

```typescript
// src/services/clients/llm/lifecycle/models/LlamaCppModelsResponse.ts
import { LlamaCppModelStatus } from './LlamaCppModelStatus.js';

export interface LlamaCppModelsResponse {
  models?: Array<{ model?: string; status?: LlamaCppModelStatus }>;
}
```

```typescript
// src/services/clients/llm/lifecycle/models/LlamaCppPropsResponse.ts
export interface LlamaCppPropsResponse {
  is_sleeping?: boolean;
}
```

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
import { OllamaPsResponse } from './models/OllamaPsResponse.js';
import { OllamaShowResponse } from './models/OllamaShowResponse.js';

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

  #headers(json: boolean): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.#host.token !== null) {
      headers['Authorization'] = `Bearer ${this.#host.token}`;
    }
    return headers;
  }

  async free(): Promise<boolean> {
    try {
      const response = await fetch(new URL('/api/generate', this.#host.url), {
        method: 'POST',
        headers: this.#headers(true),
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
      const response = await fetch(new URL('/api/ps', this.#host.url), {
        headers: this.#headers(false)
      });
      if (!response.ok) {
        return false;
      }

      const payload = await response.json() as OllamaPsResponse;
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
        headers: this.#headers(true),
        body: JSON.stringify({ model: this.#model })
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json() as OllamaShowResponse;

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
        headers: this.#headers(true),
        body: JSON.stringify({ model })
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json() as OllamaShowResponse;
      return payload.capabilities?.includes('vision') ?? false;
    } catch {
      return false;
    }
  }
}
```

*(LlamaCppRouterLifecycleStrategy: same structure and `#headers` helper — constructor `(host: ILlmHost, model: string, logger: ILogger, visionModels?: string[])`; free() POST /models/unload body `{ model }` expecting `{ success: true }`; isModelLoaded() GET /models typed as `LlamaCppModelsResponse`, match `models[].model === model && status.value === 'loaded' || 'loading'`; waitForModelUnload() free() then poll GET /models until the model's `status.value` is neither 'loaded' nor 'loading'; getContextWindow() → null; hasVisionCapability(model) → `this.#visionModels?.includes(model) ?? false`, no fetch.)*

*(LlamaCppSingleLifecycleStrategy: constructor `(host, model, logger, visionModels?: string[])`; free() resolves true with NO fetch (nothing to unload — sleep mode is externally configured via --sleep-idle-seconds); waitForModelUnload() polls GET /props typed as `LlamaCppPropsResponse` until `is_sleeping === true` — does NOT call free() first; isModelLoaded() → false always; getContextWindow() null; hasVisionCapability(model) via visionModels arg.)*

*(NullLifecycleStrategy: constructor `(host, model, logger, visionModels?: string[])`; free() true; isModelLoaded() false; waitForModelUnload() true immediately; getContextWindow() null; hasVisionCapability(model) via visionModels arg. All without fetch.)*

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
  - `resolve(host: ILlmHost): { flavor: LlmHostFlavor, isLocal: boolean }` — cache-first; for unprobed URLs returns `{ flavor: Generic, isLocal: <explicit host.isLocal flag, else true> }` (conservative default; an explicit `isLocal` flag governs even before probing). Per spec, probing happens once at startup in `FeatureService.loadFeatures()`; `resolve()` is otherwise a pure cache lookup.
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

  it('explicit isLocal flag wins over auto-detect even when unprobed', (): void => {
    const resolved = registry.resolve(host('https://api.openai.com', false));

    expect(resolved.flavor).toBe(LlmHostFlavor.Generic);
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

    // Unprobed: flavor unknown (generic), but an explicit isLocal flag still governs.
    if (host.isLocal !== null) {
      return { flavor: LlmHostFlavor.Generic, isLocal: host.isLocal };
    }

    // Conservative default: assume local until probed.
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
        const headers: Record<string, string> = {};
        if (host.token !== null) {
          headers['Authorization'] = `Bearer ${host.token}`;
        }

        const response = await fetch(new URL(probe.path, host.url), {
          headers,
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
  getContextWindow(): Promise<number | null>;
  hasVisionCapability(model?: string): Promise<boolean>;
  show(model?: string): Promise<LlmShowResponse>;
}
```

(Old `OllamaClient` surface deltas: dead `calculateTokensPerSecond` static is dropped — zero callers; `getContextWindow()` added, delegating to the lifecycle strategy; `show()` re-typed to `LlmShowResponse`.)

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

`ShowResponse` from ollama-js is replaced by `LlmShowResponse` in `src/services/clients/llm/models/LlmShowResponse.ts` (no ollama-js types anywhere):
```typescript
export interface LlmShowResponse {
  model_info?: Record<string, unknown>;
  capabilities?: string[];
}
```
`ILlmClient.show` returns `Promise<LlmShowResponse>`.

`LlmClient` constructor: `(services: IBotServiceContainer)` — picks a random host from `configurationService.llmHosts` and a random model from `configurationService.llmModels`, exactly as `OllamaClient` does today with `ollamaHosts`/`ollamaModels`. Because `llmClient` is transient (new instance per access), flavor/isLocal comes from the singleton `services.llmHostFlavorRegistry` (cached by host URL). To keep this task self-contained and the branch compiling, **Task 4's commit includes BOTH the client and the config rename**, plus a minimal container addition:

- `IBotServiceContainer` + `BotServiceContainer`: add singleton `llmHostFlavorRegistry: LlmHostFlavorRegistry` (lazily cached, `new LlmHostFlavorRegistry(services.getLogger('LlmHostFlavorRegistry'))`). Task 5 sweeps the remaining container members.
- Config rename (details in Step 3): `IBotConfig.ollama` → `IBotConfig.llm` with host objects + `visionModels`; `IConfigurationService`/`ConfigurationService` `ollama*` accessors → `llm*`. Non-test consumers of the old accessor names (`FeatureService.ts:37-47,67`, `MemoryService.ts:182,205`, `ContextCompressionService.ts:49,260`, `GenerativeChatClient.ts:56`) are renamed in THIS commit too — they are only a handful of property reads, and leaving them would break `npm run build` (tsc compiles src, not tests).

At this commit boundary, existing TEST files referencing `ollamaHosts`/`ollamaClient` may fail to compile under ts-jest — acceptable ONLY if `npm run build` passes and Task 4's own tests pass. Task 5 fixes the test files.

- [ ] **Step 1: Write the failing test**

*(Write `LlmClient.test.ts` mocking `global.fetch` — tests for: host/model random selection logging; generate() posts single-user-message chat completion body `{ model, messages: [{role:'user',content:prompt}], temperature }` to `{url}/v1/chat/completions`, returns `LlmGenerateResult` mapped from `choices[0].message.content` + usage; sendMessage() appends user message, returns message + pushes response into context; sendMessageAndGetStream() returns AsyncIterable of LlmStreamChunk parsed from SSE `data:` lines, final chunk carries usage; Bearer header only when token present; structured output sends response_format json_schema + parses trimmed JSON; embeddings POST /v1/embeddings `{ model, input }` returning data[0].embedding; embedBatch maps data[].embedding in input order; interpretImages builds the hardcoded vision prompt + single user message with image_url content parts `data:image/jpeg;base64,...`; error wrapping preserves `.cause`; strategy selection routes non-local hosts to NullLifecycleStrategy and ollama-flavor hosts to OllamaLifecycleStrategy (mock `services.llmHostFlavorRegistry.resolve`); `getContextWindow()` delegates to the strategy. Assert `Authorization` header absent when token null. Do NOT port any `calculateTokensPerSecond` test — the static is dead code and dropped.)*

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
- Modify: `src/services/clients/chat/discord/ollama/` → folder renamed to `chat/discord/llm/`; files renamed `OllamaReplyService.ts`→`LlmReplyService.ts`, `OllamaStreamingReplyService.ts`→`LlmStreamingReplyService.ts`, `DiscordOllamaContextMessageFactory.ts`→`DiscordLlmContextMessageFactory.ts`; `DiscordChatMessageFactory.ts` + `DiscordLlmChatMessageFactory.ts` move unchanged (import-path fixes only)
- Modify: `src/services/clients/chat/IInputChatMessageFilter.ts`, `GenerativeChatClient.ts`, `IMemoryService.ts`, `MemoryService.ts`, `DiscordMemoryInputFilter.ts`, `DiscordCodeBlockExtractFilter.ts`, `ContextCompressionService.ts`, `ContextService.ts` + `IContextService.ts` + `IContextMessageFactory.ts` + `ILlmChatMessageFactory.ts` (generic type param + import renames only), `GenerativeAiChannelPostProcessor.ts`, `FeatureService.ts`, `ComfyUiBaseTask.ts`, `ComfyUiAttachmentTask.ts`, `ComfyUiMessageTask.ts` (call-site re-types only), `SongPromptTypeRequestType.ts` + `SongPromptMetadataRequestType.ts` (import path fix: `llm/ollama/models/IStructuredRequestData.js` → `llm/models/IStructuredRequestData.js`)
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
- `ContextCompressionService.ts`: `show()` usage (line 267) replaced by the context window chain: `#resolveContextWindow()` order = config `llmContextWindow` → `await this.#services.llmClient.getContextWindow()` (already on `ILlmClient` from Task 4) → fallback 4096. `sendMessage` re-typed to neutral DTOs (`ILlmRequest`/`LlmChatResult`; `.response.message.content` shape preserved).
- `ComfyUiBaseTask.ts:50` / `ComfyUiMessageTask.ts` / `ComfyUiInteractionTask.ts` / `ComfyUiAttachmentTask.ts:158`: re-type `#ollamaClient` field to `ILlmClient`, rename to `#llmClient`, `services.ollamaClient` → `services.llmClient`
- `FeatureService.ts`: config keys renamed in Task 4 — in Task 5 add the registry probing in `loadFeatures()` before the vision probe (the `llmHostFlavorRegistry` container singleton added in Task 4 makes this possible):

```typescript
// insert at top of loadFeatures(), after loadWorkflows():
const registry = this.#services.llmHostFlavorRegistry;
for (const host of this.#configurationService.llmHosts) {
  await registry.probeHost(host);
}
```

- Also in `FeatureService.ts:71`: `this.#services.ollamaClient` → `this.#services.llmClient` (the vision probe `hasVisionCapability(model)` stays on the client interface and delegates to the strategy — for Ollama flavor it probes /api/show, for others it consults `llmVisionModels`).

- [ ] **Step 3: Move + rename task files**

Move each `clients/llm/ollama/tasks/Ollama*.ts` (+ `.test.ts`) to `clients/llm/tasks/Llm*.ts` with class renames, updated imports (DTOs, `LLM_TEMPERATURE_DEFAULT`, `LlmRole`, `LlmBaseTask`), and the response-field changes listed above. `LlmBaseTask` field renames: `ollamaClient`→`llmClient`, `ollamaReplyService`→`llmReplyService`, `ollamaStreamingReplyService`→`llmStreamingReplyService`. `LlmTaskChannelPostProcessor` frees via `services.llmClient.free()`.

- [ ] **Step 4: Update the shared mock + fix remaining test files**

`src/test-utils/mockBotServiceContainer.ts`: config literals exist TWICE (~lines 102-109 and ~lines 155-162) — update BOTH: `ollamaHosts: []` → `llmHosts: []`, `ollamaModels: []` → `llmModels: []`, `ollamaSystemPrompt` → `llmSystemPrompt: ''`, `ollamaStreamsResponse` → `llmStreamsResponse: false`, `ollamaEmbeddingModel` → `llmEmbeddingModel: null`, `ollamaTopK` → `llmTopK: 5`, `ollamaContextWindow` → `llmContextWindow: null`, `ollamaContextCompressionThreshold` → `llmContextCompressionThreshold: 0.75`, add `llmVisionModels: []` to each. Container properties: `ollamaClient: null as never` → `llmClient: null as never`; `ollamaReplyService` → `llmReplyService: null as never`; `ollamaStreamingReplyService` → `llmStreamingReplyService: null as never`; add `llmHostFlavorRegistry: null as never`.

Then fix each consumer test file mechanically (jest.Mocked<OllamaClient> literals → jest.Mocked<ILlmClient> with identical method names; config keys swapped; `import ... from '../ollama/...'` → `'../models/...'` / `'../../models/...'` per new layout). Complete affected list (verified by grep): the four moved task tests (`OllamaGenerateTask.test.ts`, `OllamaGenerateStructuredTask.test.ts`, `OllamaMessageTask.test.ts`, `OllamaBaseTask.test.ts` → renamed `Llm*.test.ts` in `clients/llm/tasks/`), `ContextCompressionService.test.ts` (mock client + `show()`→`getContextWindow()` + config keys), `ContextService.test.ts` (ContextMessage import path + `ollamaClient`/`ollamaReplyService`/`ollamaStreamingReplyService` container keys), `MemoryService.test.ts` (config keys `ollamaEmbeddingModel`/`ollamaTopK` + `ollamaClient` key + LlmChatMessage import path), `GenerativeAiChannelPostProcessor.test.ts` (OllamaClient type → ILlmClient), `FeatureService.test.ts` (config keys), `ComfyUiClient.test.ts` (config keys + container keys), `ComfyUiBaseTask.test.ts`, `ComfyUiMessageTask.test.ts`, `ComfyUiInteractionTask.test.ts` (waitForModelUnload mocks), `JsonMutator.test.ts` + `MessageToMusicMutator.test.ts` (if they reference ollama types — check), `ConfigurationService.test.ts` (config keys + error-message assertions updated to new validation text), `OllamaClient.test.ts` (DELETE — replaced by `LlmClient.test.ts` from Task 4).

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