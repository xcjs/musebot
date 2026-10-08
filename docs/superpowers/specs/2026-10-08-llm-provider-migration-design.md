# LLM Provider Migration Design

**Date:** 2026-10-08
**Status:** Approved (user-reviewed section by section)
**Version target:** 10.0.0

## Problem Statement

Musebot's chat capabilities are hard-wired to Ollama via the `ollama` npm
package: the client class, ~25 files of leaked ollama-js types, config schema
(`ollama.hosts` as plain strings), and startup probes (`/api/show` for vision
and context length). The user wants the bot to talk to _any_ OpenAI-compatible
API platform — self-hosted Ollama, llama.cpp (llama-server), or hosted clouds
(OpenAI, etc.) — with optional per-host auth tokens, while preserving the
VRAM-freeing choreography that matters when LLM and ComfyUI share a GPU.

## Goals

1. Chat/generate/structured/embedding traffic speaks the OpenAI-compatible
   protocol (`/v1/*`) against every provider.
2. Optional `Authorization: Bearer <token>` per host.
3. Preserve local-VRAM lifecycle: free, is-loaded, wait-for-unload — real
   semantics for Ollama and llama.cpp; no-op only for non-local hosts.
4. Kill the `ollama` npm dependency (direct `fetch`, no SDKs — matches the
   ComfyUI client approach).
5. Neutral naming throughout: `llm` vocabulary (matches existing
   `LlmChatMessage`, `getLlmGenerateTask`).
6. Long-term memory keeps working on all providers via OpenAI-compatible
   `POST /v1/embeddings`.

## Non-Goals

- ComfyUI/media side changes (beyond re-typing `waitForModelUnload` call
  sites — behavior identical). No `isLocal` for ComfyUI hosts.
- Docker, deployment, or web-content fetching changes.
- Backward compatibility for old `ollama:` config sections — breaking
  change, documented in a migration guide.
- Env-var token side-channels (ADR 003 stands: config.jsonc only).

## Decisions (user-confirmed)

1. **OpenAI-compatible protocol** for all chat traffic; provider-flavor
   lifecycle handled by a strategy layer.
2. **Flavor auto-probe at startup** — no config-declared flavor field.
3. **Host config objects only** — `hosts: [{ url, token?, isLocal? }]`.
   Breaking change; bare strings rejected.
4. **Embeddings via `POST /v1/embeddings`**; `embeddingModel` stays a single
   global field (vector-DB dimensional consistency).
5. **Direct fetch, no SDK** — Vercel AI SDK and openai SDK rejected (dep
   weight, churn, HTTP-layer conflict with flavor lifecycle fetches, test
   mocking friction). SSE parsing is ~30 lines.
6. **Vision detection:** Ollama hosts keep `/api/show` auto-detect; all other
   hosts use config `visionModels: string[]`.
7. **Naming: `llm`** — config section `llm:`, classes `LlmClient`,
   `LlmMessageTask`, etc.
8. **Client architecture: Strategy pattern** — `ILlmClient` interface, one
   concrete protocol client, four lifecycle strategies.
9. **`isLocal`:** optional per-host flag with IP-based auto-detect default;
   non-local hosts always resolve to the Null lifecycle strategy.
10. **Serial mode must wait for real unload** — every local strategy blocks
    until the model is genuinely out of memory.

## Architecture

New structure under `src/services/clients/llm/` (the `ollama/` folder is
flattened away):

```
src/services/clients/llm/
  ILlmClient.ts                        # client interface (old OllamaClient surface)
  LlmClient.ts                         # protocol implementation (fetch, /v1/*)
  LlmHostFlavorRegistry.ts             # startup probe: flavor + isLocal per host
  constants/LlmConstants.ts           # temperature defaults (0.8/0/2)
  enums/LlmRole.ts                     # user/system/assistant string enum
  models/                              # neutral DTOs (replace ollama-js types)
  lifecycle/
    ILlmLifecycleStrategy.ts
    OllamaLifecycleStrategy.ts
    LlamaCppRouterLifecycleStrategy.ts
    LlamaCppSingleLifecycleStrategy.ts
    NullLifecycleStrategy.ts
  tasks/
    LlmBaseTask.ts
    LlmGenerateTask.ts
    LlmGenerateStructuredTask.ts
    LlmMessageTask.ts
    LlmEmojiReactionTask.ts
    LlmEmbedTask.ts
    LlmTaskChannelPostProcessor.ts
```

### Components

| Component                       | Responsibility                                                                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ILlmClient`                    | Same method surface as today's `OllamaClient`: `host`, `model`, `generate`, `generateStructured`, `sendMessage`, `sendMessageAndGetStream`, `embed`, `embedBatch`, `interpretImages`, `free`, `isModelLoaded`, `waitForModelUnload`, `hasVisionCapability`. Consumers switch from `OllamaClient` to `ILlmClient`. |
| `LlmClient`                     | Concrete implementation. Constructor picks one random host + one random model (as today). All protocol methods use direct `fetch` against `{url}/v1/*` with `Authorization: Bearer <token>` when a token is present. All lifecycle methods delegate to the host's strategy. |
| `LlmHostFlavorRegistry`         | Singleton per bot container. Probes each configured host once at startup. Classification is **priority-ordered** to handle overlapping endpoints (llama.cpp router also answers `/props`): 1. `GET /api/ps` → 200 ⇒ `ollama`; 2. `GET /models` (non-`/v1`) → 200 ⇒ `llamacpp-router`; 3. `GET /props` → 200 ⇒ `llamacpp-single`; 4. else ⇒ `generic`. Also resolves `isLocal` (see below). Caches `host → {flavor, isLocal}`. Needed because `llmClient` is transient — each access constructs a new instance with a new random host, so probing must happen once, up front. |
| `ILlmLifecycleStrategy`         | `free()`, `isModelLoaded()`, `waitForModelUnload(intervalMs?)`, `getContextWindow()`, `hasVisionCapability(model?)` — all per-host.                                                                                                                                                  |
| Four strategy classes           | See Lifecycle Strategies section.                                                                                                                                                                                                     |

### Why a registry is needed

`services.llmClient` is a transient property — every access constructs a new
client with a new random host. Flavor and locality probing must therefore
happen once at startup per configured host, with results cached by URL, so
each transient client construction is cheap and deterministic.

## Config Format

`IBotConfig.ollama` → `IBotConfig.llm`:

```jsonc
"llm": {
  "hosts": [
    { "url": "http://ai.tailscale.xcjs.com:11434/" },
    { "url": "https://api.openai.com", "token": "sk-...", "isLocal": false }
  ],
  "models": ["gemma4:12b-it-qat"],
  "systemPrompt": "You are Musebot...",
  "streamsResponse": true,
  "embeddingModel": "embeddinggemma",    // optional; gates LongTermMemory
  "visionModels": ["gemma4:12b-it-qat"], // optional; vision for non-Ollama hosts
  "topK": 15,                             // optional
  "contextWindow": 100000,                // optional
  "contextCompressionThreshold": 0.75     // optional
}
```

- **Host objects only.** Bare strings are rejected at load with an
  error message pointing at the migration guide. `token?` and `isLocal?`
  optional per host.
- **`IConfigurationService` renames:** `ollamaHosts: URL[]` →
  `llmHosts: ILlmHost[]` where `ILlmHost = { url: URL, token: string | null,
  isLocal: boolean | null }` (registry fills `isLocal`); `ollamaModels` →
  `llmModels`; `ollamaSystemPrompt` → `llmSystemPrompt`; `ollamaStreamsResponse`
  → `llmStreamsResponse`; `ollamaEmbeddingModel` → `llmEmbeddingModel`;
  `ollamaTopK` → `llmTopK`; `ollamaContextWindow` → `llmContextWindow`;
  `ollamaContextCompressionThreshold` → `llmContextCompressionThreshold`;
  new `llmVisionModels: string[]` (default `[]`).
- **Validation** (`ConfigurationService.#validateMode()`): chat mode requires
  `llm.hosts` non-empty and all-objects; warn when `llm.models` empty. New
  info-level note when serial strategy + any non-local host: mixed fleets are
  legal, but the non-local host will never block on VRAM.
- **Token security:** tokens live in config.jsonc only (ADR 003). Docs remind
  users config.jsonc must never be committed; `config.example.jsonc` uses
  placeholder tokens.
- **Migration docs:** new `docs/musebot/04-migration-v10.md` upgrade guide;
  `config.example.jsonc` fully rewritten.

## Protocol & DTOs

### Neutral DTOs (new, under `models/`)

| New type                  | Replaces                | Shape & notes                                                                                                                                                                        |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LlmRole`                 | `OllamaRole`            | string enum: `user` / `system` / `assistant`. Value-compatible.                                                                                                                         |
| `LlmMessage`              | `Message`               | `{ role: LlmRole, content: string, images?: string[] (base64) }` — internal canonical form. Converted to OpenAI content parts only at the wire layer inside `LlmClient`.                |
| `LlmGenerateResult`       | `GenerateResponse`      | `{ content: string, totalTokens?, promptTokens?, completionTokens?, tokensPerSecond? }` — populated from OpenAI `usage` when present.                                                    |
| `LlmChatResult`           | `ChatResponse`          | `{ message: LlmMessage, totalTokens?, promptTokens?, completionTokens? }` — `.message.content` preserved so reply-service logic translates nearly unchanged.                              |
| `LlmStreamChunk`          | streamed `ChatResponse` | `{ content: string, done: boolean, promptTokens?, completionTokens? }` — usage only guaranteed on the final chunk (`stream_options: { include_usage: true }`).                          |
| `LlmEmbeddingResult`      | embed response          | Internal wire DTO for `POST /v1/embeddings` (`data[].embedding` in input order). The public `embed`/`embedBatch` API keeps plain `number[]` / `number[][]` returns.                                    |
| `LlmStructuredRequestData` | `IStructuredRequestData`| `{ systemPrompt: string, schema: object }`; wire format: `response_format: { type: 'json_schema', json_schema: { name: 'result', schema } }`.                                          |

All consumers keep receiving `IHttpExchange<Req, Resp>` envelopes with the
neutral types — `IHttpExchange` itself is untouched.

### Wire behavior in `LlmClient`

- **Chat:** `POST {url}/v1/chat/completions` — messages `[{role, content}]`,
  images as `image_url` content parts (`data:image/jpeg;base64,...`),
  `stream: false|true`, `stream_options: { include_usage: true }` when
  streaming, `temperature` pass-through.
- **Raw generate:** `POST /v1/chat/completions` with the prompt as a single
  user message — serves `interpretImages` and the mutator tasks. (The legacy
  `/v1/completions` endpoint is deliberately avoided: OpenAI restricts it to
  legacy models and it cannot carry image content parts, so a
  chat-completions round-trip is the only universally supported — and
  vision-capable — shape.)
- **Structured:** chat completions + `response_format` json_schema.
  `trimTrailingJsonContent` stays as a safety net for servers with weak
  json_schema support.
- **Streaming:** manual SSE parse of `data:` lines from the response body
  reader (~30 lines, no SDK). Usage numbers on the final chunk feed context
  compression calibration (replacing `prompt_eval_count` / `eval_count`).
  If a provider omits streaming `usage`, compression falls back to the
  existing char-based token estimation.
- **Token counting:** response `usage` is the primary source (no tokenize
  endpoint); char-based estimation remains the fallback when a provider
  does not report usage. `calculateTokensPerSecond` re-typed to the neutral
  results.
- **Embeddings:** `POST /v1/embeddings` with `{ model, input }`.

## Lifecycle Strategies

`ILlmLifecycleStrategy` (per-host, resolved at client construction):

```ts
interface ILlmLifecycleStrategy {
  free(): Promise<boolean>;
  isModelLoaded(): Promise<boolean>;
  waitForModelUnload(intervalMs?: number): Promise<boolean>;
  getContextWindow(): Promise<number | null>;
  hasVisionCapability(model?: string): Promise<boolean>;
}
```

| Strategy                          | `free()`                              | `isModelLoaded()` / wait                                            | Context window                                      | Vision                                            |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------- |
| `OllamaLifecycleStrategy`         | `POST /api/generate` `keep_alive: 0` | `GET /api/ps` poll until model absent                               | `POST /api/show` → `model_info['*.context_length']` | `/api/show` capabilities `includes('vision')`      |
| `LlamaCppRouterLifecycleStrategy` | `POST /models/unload` `{"model": n}`  | `GET /models` poll until `status.value === 'unloaded'`                | `null`                                              | config `llmVisionModels` contains model            |
| `LlamaCppSingleLifecycleStrategy`  | no-op (`true`; nothing can force it)  | `GET /props` poll until `is_sleeping === true`                        | `null`                                              | config `llmVisionModels` contains model            |
| `NullLifecycleStrategy`           | no-op `true`                          | `false` — wait returns immediately (nothing local to wait out)     | `null`                                              | config `llmVisionModels` contains model            |

**Selection logic** (in `LlmClient` constructor, from registry results):

```
isLocal === false            → NullLifecycleStrategy
flavor === 'ollama'            → OllamaLifecycleStrategy
flavor === 'llamacpp-router'   → LlamaCppRouterLifecycleStrategy
flavor === 'llamacpp-single'   → LlamaCppSingleLifecycleStrategy
else                           → NullLifecycleStrategy
```

**Behavioral contracts:**

- **Serial mode waits for real unload.** Ollama polls until absent from
  `/api/ps`; router polls until `status: unloaded`; llama.cpp single-model
  polls `GET /props` until `is_sleeping: true`. Only the Null strategy
  returns instantly, because non-local hosts have nothing on local hardware
  to wait out. This is the floor the user demanded: in serial mode with a
  local host, media tasks will not start until the LLM model is genuinely
  out of memory.
- **Ollama vision via `/api/show` stays primary** for Ollama hosts even
  though chat moves to `/v1/*` — it is the most reliable signal and the
  user's current fleet is Ollama.
- **Null `isModelLoaded()` returns `false`** so `ComfyUiBaseTask` never
  thinks a cloud LLM occupies VRAM.
- **Context window resolution order** (`ContextCompressionService`):
  config `llm.contextWindow` → strategy result → fallback 4096.
- **Vision routing:** `ILlmClient.hasVisionCapability` delegates to the
  strategy — Ollama hosts keep auto-detect; all others use the
  `visionModels` config list.
- **Docs must state:** llama.cpp single-model mode requires
  `--sleep-idle-seconds N` on llama-server for the wait-unload choreography
  to terminate; router mode requires launching llama-server without `-m`
  with `--models-dir`.

### `isLocal` resolution (registry)

1. Explicit `isLocal` flag always wins.
2. Else auto-detect: `localhost` / `127.*` / `::1` hostnames → local.
3. Else resolve hostname via `dns.lookup`; result in RFC1918 (`10/8`,
   `172.16/12`, `192.168/16`), Tailscale CGNAT (`100.64/10`), link-local
   (`169.254/16`), IPv6 ULA (`fc00::/7`), or `fe80::/10` → local.
4. Anything else → not local.
5. Unresolvable/unreachable → local (conservative fallback; worst case is a
   harmless no-op strategy).

Detection results are logged at startup.

## Feature Detection

- `Txt2Txt`: `llmHosts && llmModels` non-empty (unchanged logic).
- `LongTermMemory`: chat mode + hosts + `llmEmbeddingModel !== null`
  (unchanged logic).
- `Vision`: probe via `ILlmClient.hasVisionCapability(model)` per configured
  model — routes to strategy, so Ollama hosts keep auto-detect and others
  consult `visionModels`.

## Renames & Blast Radius

### Client layer

| Today                                              | After                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `ollama/OllamaClient`                              | `ILlmClient` + `LlmClient`                                              |
| `ollama/constants/OllamaConstants`                 | `LlmConstants` (temperature defaults unchanged)                      |
| `ollama/enums/OllamaRole`                          | `LlmRole`                                                             |
| ollama-js DTO imports (~25 files)                  | `models/` neutral DTOs                                                |
| —                                                  | `lifecycle/` (interface + 4 strategies) + `LlmHostFlavorRegistry`      |
| `ollama/tasks/OllamaBaseTask`                      | `LlmBaseTask` (channel prefix `ResourceType.LargeLanguageModel` unchanged) |
| `.../OllamaMessageTask`                            | `LlmMessageTask`                                                     |
| `.../OllamaGenerateTask`                           | `LlmGenerateTask`                                                    |
| `.../OllamaGenerateStructuredTask`                 | `LlmGenerateStructuredTask`                                          |
| `.../OllamaEmojiReactionTask`                      | `LlmEmojiReactionTask`                                                |
| `.../OllamaEmbedTask`                              | `LlmEmbedTask`                                                       |
| `.../OllamaTaskChannelPostProcessor`               | `LlmTaskChannelPostProcessor`                                         |
| `chat/discord/ollama/OllamaReplyService`          | `LlmReplyService`                                                     |
| `chat/discord/ollama/OllamaStreamingReplyService`  | `LlmStreamingReplyService`                                            |
| `DiscordOllamaContextMessageFactory`              | `DiscordLlmContextMessageFactory`                                     |
| `services.ollamaClient` (transient)               | `services.llmClient` (transient)                                     |

**Not renamed:** `LlmChatMessage`, factory method names
(`getLlmGenerateTask` etc. — already neutral), `ContextMessage`,
`ResourceType.LargeLanguageModel`, `SerialStrategy` /
`GlobalServiceContainer` channel logic (only the post-processor class
changes).

**Removed:** the `ollama` npm dependency.

### Config surface

- `IBotConfig.ollama` → `IBotConfig.llm`; host objects; new
  `visionModels` field; `IConfigurationService` accessors renamed
  (`ollama*` → `llm*`) with new `llmHosts: ILlmHost[]` shape and
  `llmVisionModels`.
- Validation messages updated to reference `llm.hosts`.

### Other consumers (re-typed, behavior preserved)

- `ContextCompressionService` — `sendMessage` summaries (neutral DTOs),
  context window via strategy chain (config → strategy → 4096).
- `MemoryService` — `embed`/`embedBatch` via `ILlmClient`.
- `ComfyUiBaseTask` / `ComfyUiAttachmentTask` / `ComfyUiMessageTask` —
  `waitForModelUnload()` / `interpretImages()` call sites re-typed.
- `FeatureService` — probes via `ILlmClient.hasVisionCapability`.
- `GenerativeAiChannelPostProcessor` — frees via `ILlmClient.free`.
- `GenerativeChatClient` — `IContextMessageFactory<DiscordMessage,
  LlmMessage>`; system prompt via renamed config accessors.
- Filters (`DiscordMemoryInputFilter`, `DiscordCodeBlockExtractFilter`) and
  `IMemoryService` — re-typed to `LlmMessage`.

### Docs

- `docs/chat/01-ollama.md` → `docs/chat/01-llm.md`: rewritten with a
  provider matrix (Ollama / llama.cpp router / llama.cpp single +
  `--sleep-idle-seconds` / cloud) and vision/context-window notes.
- `docs/musebot/02-configuration.md`: `llm.*` reference.
- New `docs/musebot/04-migration-v10.md`: upgrade guide (rename section,
  wrap hosts, tokens, isLocal, visionModels).
- `config.example.jsonc`: fully rewritten.
- `AGENTS.md`: updated structure map, config table, vocabulary.
- `docs/musebot/03-migration-from-env-to-jsonc.md` and
  `docs/adr/003-drop-env-support.md`: update stale references where they
  mention `ollama.hosts`.

## Testing

- **`LlmClient.test.ts`** (replaces `OllamaClient.test.ts`): mock
  `global.fetch`. Asserts `/v1/chat/completions` bodies, `Authorization:
  Bearer` header injection, SSE stream parsing (mock `ReadableStream` of
  `data:` lines), embeddings mapping, structured `response_format`,
  `interpretImages` single-user-message chat completions. No module mock
  needed — the `ollama` package is gone.
- **Strategy tests** (one per strategy): mock fetch — Ollama keep_alive-0
  body + `/api/ps` poll; router unload + `/models` poll; single-model
  `/props` `is_sleeping` poll; null no-ops.
- **`LlmHostFlavorRegistry.test.ts`**: probe matrix (ollama vs router vs
  single vs generic), DNS-based `isLocal` with mocked `dns` module,
  explicit-flag override, unresolvable → local fallback.
- **Existing ~10 test files:** `jest.Mocked<OllamaClient>` literals →
  `jest.Mocked<ILlmClient>` with identical method names (surface preserved);
  config key swaps (`ollamaHosts` → `llmHosts` etc.). Mechanical.
- **`src/test-utils/mockBotServiceContainer.ts`:** `ollamaClient` →
  `llmClient`; config literal keys renamed.

## Rollout

- Single PR — local-only repo, sole operator, breaking config change is
  documented in the migration guide.
- Version bump to **10.0.0** (breaking config change).
- Implementation order: DTOs → `ILlmClient`/`LlmClient` protocol layer →
  strategies → registry → task/rename sweep → container/config → docs →
  tests throughout (TDD per repo norms).