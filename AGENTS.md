# AGENTS.md — Musebot

## Project Overview

Musebot is a Discord bot that bridges multiple generative AI systems into
Discord. It connects to **any OpenAI-compatible LLM platform** (Ollama,
llama.cpp's `llama-server`, hosted APIs) for LLM chat and **ComfyUI** for media
generation (images, video, audio, music). The bot operates in one of two modes
configured via config: `chat` (LLM-powered conversation) or `media`
(generative media via ComfyUI workflows).

- **Language:** TypeScript (ES2022, ESNext modules)
- **Runtime:** Node.js
- **Package Manager:** npm
- **Version:** 10.0.0

## Repository Structure

```text
src/                          # TypeScript source
  app.ts                      # Entry point — bootstraps ServiceContainer, loads features, logs in
  polyfills.ts                # BigInt JSON serialization polyfill
  constants/                  # App-wide constants (Globals, FileConstants)
  enums/                      # Shared enums (BotFunction, BotInteraction, HttpMethod, etc.)
  models/                     # Shared interfaces (IHttpExchange, etc.)
  types/                      # Utility types (Dictionary)
  utilities/                  # Pure utility functions (string-utilities, random-utilities)
  services/
    ServiceContainer.ts       # IoC container — central DI; wires all singletons, transients, factories
    IServiceContainer.ts      # Interface for the service container
    Logger.ts / ILogger.ts    # Timestamped prefix logger with debug/info/warn/error levels
    environment-settings/     # Loads config.jsonc, exposes typed config (IConfigurationService)
    features/                 # FeatureService — probes LLM + ComfyUI hosts to detect supported features
    help/                     # Help text generation (BaseHelpService, IHelpService)
    parallelization/          # Task execution strategies (ParallelStrategy, SerialStrategy)
    tasks/                    # TaskQueue and BaseTask abstractions
    clients/
      chat/                   # Discord client layer
        discord/              # Discord-specific: GenerativeChatClient, GenerativeMediaChatClient,
                              #   reply services, typing service, components (action rows/buttons)
        llm/                  # Discord LLM glue: message factories, reply/streaming reply services
        IGenerativeChatClient.ts
        IReplyService.ts
        ITypingService.ts
      llm/
        ILlmClient.ts         # Client interface (OpenAI-compatible protocol)
        LlmClient.ts          # OpenAI-compatible client: appends /chat/completions, /embeddings to the configured host route (usually /v1)
        LlmHostFlavorRegistry.ts # Startup probe: classifies hosts (Ollama, llama.cpp, generic)
        constants/            # LLM constants
        enums/                # LlmHostFlavor, LlmRole enums
        lifecycle/            # ILlmLifecycleStrategy + Ollama / llama.cpp router / llama.cpp
                              #   single / null strategies, lifecycle DTOs
        memory/               # MemoryDatabase, MemoryService, schema (long-term memory)
        models/               # Neutral wire/DTO models (chat, embeddings, stream, show)
        services/             # ContextService, ContextCompressionService, ContextMessageFactory,
                              #   web content extraction
        tasks/                # LlmBaseTask, generate/message/structured/embed/emoji-reaction tasks
        help/                 # ChatHelpService
      media/
        comfy-ui/             # ComfyUiClient, workflow models, workflow mutators, media tasks
        help/                 # MediaHelpService
        stable-diffusion/     # (Legacy/auxiliary Stable Diffusion references)
      internal/
        tasks/                # ShowHelpTask and other internal-only tasks
workflows/                    # ComfyUI workflow JSON files organized by type
  txt2img/, txt2vid/, txt2music/, txt2audio/
  img2img/, img2vid/
  examples/                   # Example workflow presets
build/                        # Build outputs (tsc, parcel bundle, pkg binaries, SEA)
docs/                         # End-user documentation (Markdown, built with sitedown)
coverage/                     # Jest coverage reports
```

## Architecture & Key Patterns

### Dependency Injection

`ServiceContainer` is the composition root. It implements `IServiceContainer`
and manages:

- **Singletons:** `EnvironmentSettings`, `FeatureService`, `TaskQueue`,
  `TypingService`, `DiscordClient`, `GenerativeChatClient`, `HelpService`,
  `WorkflowService`, `ParallelizationStrategy`
- **Transients:** `ContentTypeService`, `ReplyService`, `ComfyUiClient`,
  `LlmClient`, reply services (new instance per access)
- **Factories:** `getLogger()`, `getMessageTask()`, `getInteractionTask()`,
  `getWorkflowMutator()`, etc.

All services receive the container via constructor injection and access
dependencies through its interface.

### Feature Detection

`FeatureService.loadFeatures()` probes configured hosts at startup (via the
`LlmHostFlavorRegistry`) to determine which `SupportedFeature` values are
available: `Txt2Txt`, `Txt2Img`, `Txt2Vid`, `Txt2Music`, `Txt2Audio`,
`Img2Img`, `Img2Vid`, `ContextualImg2Img`.

### LLM Host Lifecycle (Strategy Pattern)

At startup, `LlmHostFlavorRegistry` classifies each configured LLM host
(probing `/api/ps` → Ollama, `/models` → llama.cpp router, `/props` →
llama.cpp single-model, otherwise generic) and resolves whether it is local
(RFC 1918 / Tailscale CGNAT / link-local / IPv6 ULA, or explicit `isLocal`
config flag). Each transient `LlmClient` then selects an
`ILlmLifecycleStrategy` for its host:

- **Ollama** — unload via `/api/generate` with `keep_alive: 0`, verify via
  `/api/ps`; auto-detects vision (`/api/show` capabilities) and context
  window (`/api/show` `context_length`)
- **LlamaCppRouter** — unload via `POST /models/unload`, verify via
  `/models`; vision via the `llm.visionModels` config list
- **LlamaCppSingle** — no unload endpoint; waits for `is_sleeping` in
  `/props` (requires `--sleep-idle-seconds` server-side); vision via config
- **Null** — non-local and generic hosts: no lifecycle management; vision
  and context window via config only

### Task System

Work is modeled as `BaseTask<T>` instances dispatched through a `TaskQueue`.
The queue supports `Parallel` or `Serial` execution strategies. Tasks include
LLM generate/message tasks and ComfyUI media generation tasks.

### Workflow Mutators

ComfyUI workflows are modified at runtime by `IWorkflowMutator`
implementations. The correct mutator is selected based on `BotInteraction` type
and workflow `SupportedFeature` type. Mutators include: `RetryMutator`,
`ExpandPromptMutator`, `RandomPromptMutator`, `GuidanceScaleMutator`,
`MessageToMediaMutator`, `MessageToMusicMutator`, `ContextualMediaMutator`,
`JsonMutator`.

### Bot Modes

The `BotFunction` enum determines mode at startup:

- **`chat`** — Uses `GenerativeChatClient` + `LlmClient` for LLM
  conversation with context management and streaming support.
- **`media`** — Uses `GenerativeMediaChatClient` + `ComfyUiClient` for media
  generation with interactive Discord buttons (retry, randomize, expand prompt,
  guidance scale, etc.).

## Build System

### Build Pipeline

1. **`npm run build`** — Compiles TypeScript to `build/tsc/` via `tsc`
2. **`npm run parcel`** — Bundles `build/tsc/src/app.js` into
   `build/parcel/musebot.cjs` via Parcel
3. **`npm run build:bin`** — Packages into standalone binaries at `build/pkg/`
   via `@yao-pkg/pkg`

### Key Commands

| Command              | Description                                     |
| -------------------- | ----------------------------------------------- |
| `npm install`        | Install dependencies                            |
| `npm start`          | Build (parcel) and run                          |
| `npm run start:only` | Run without rebuilding                          |
| `npm run build`      | TypeScript compilation only                     |
| `npm run watch`      | TypeScript watch mode                           |
| `npm run parcel`     | Build + bundle                                  |
| `npm run build:bin`  | Build + bundle + package standalone binaries    |
| `npm run build:docs` | Build end-user documentation site               |
| `npm run lint`       | Run ESLint                                      |
| `npm run lint:fix`   | Run ESLint with auto-fix                        |
| `npm test`           | Run Jest tests (`--silent`)                     |

### Docker

- **`Dockerfile`** — Multi-stage: builds pkg binary on Node 24, copies to
  Debian slim for production
- **`Dockerfile.dist`** — Simpler distribution image for pre-built binaries
- **`docker-compose.yml`** — Runs container with `config.jsonc` file and
  `workflows/` volume mount

## Configuration

All configuration is via `config.jsonc` (or `config.json`) loaded at startup.
Key settings (from `IBotConfig`):

| Property                                   | Purpose                                         |
| ------------------------------------------ | ----------------------------------------------- |
| `bots[].botId`                             | Unique bot instance identifier                  |
| `bots[].mode`                              | `"chat"` or `"media"` — determines bot mode    |
| `bots[].nodeEnvironment`                   | `"development"` or `"production"`               |
| `bots[].chatApis.discord.token`            | Discord bot token                               |
| `bots[].chatApis.discord.channels`        | Array of allowed channel IDs                    |
| `bots[].chatApis.discord.channelsDisallowed` | Array of disallowed channel IDs               |
| `bots[].requiresMention`                  | Whether the bot requires an @mention to respond |
| `bots[].responseRate`                      | Response probability percentage                 |
| `bots[].llm.hosts`                         | Array of LLM host objects (`{ url, token?, isLocal? }`) — `url` must include the OpenAI base route (usually `/v1`) |
| `bots[].llm.models`                        | Array of model names or `{ name, inputModalities?, outputModalities? }` objects (modalities case-insensitive: text/image/video/audio, default `text`) |
| `bots[].llm.systemPrompt`                  | System prompt for LLM conversations            |
| `bots[].llm.streamsResponse`               | Whether the LLM streams responses              |
| `bots[].llm.embeddingModel`                | Embedding model name (enables long-term memory) |
| `bots[].llm.embeddingInputLimit`           | Max character length of embedding inputs (default 2000) |
| `bots[].llm.visionModels`                  | Vision-capable model names (non-Ollama hosts)  |
| `bots[].llm.topK`                          | Number of similar memories retrieved per prompt |
| `bots[].llm.contextWindow`                 | Max context window in tokens (optional override) |
| `bots[].llm.contextCompressionThreshold`   | Fraction of the window that triggers compression |
| `bots[].comfyUi.hosts`                     | Array of ComfyUI API URLs                       |
| `bots[].comfyUi.guidanceScaleInterval`    | Guidance scale adjustment step                  |
| `bots[].multiModal.randomPrompts`         | Random prompts for the randomize button         |
| `global.taskQueue.numAttempts`             | Max retry attempts for tasks                    |
| `global.taskQueue.retryDelayMs`            | Delay between task retries                      |
| `global.taskQueue.strategy`                | `"parallel"` or `"serial"`                      |

## Testing

- **Framework:** Jest 30 with `ts-jest` transformer
- **Test Files:** Co-located with source using `*.test.ts` pattern
- **Run:** `npm test`
- **Coverage:** Collected automatically to `coverage/`

Tests are excluded from the TypeScript compilation via `tsconfig.build.json`
(`"exclude": ["**/*.test.ts"]`), which `npm run build` uses; the root
`tsconfig.json` still includes tests for editor and Jest tooling.

## Linting

- **ESLint 9** with flat config (`eslint.config.ts`)
- **Plugins:** `typescript-eslint` (recommended + type-checked),
  `eslint-plugin-simple-import-sort`
- **Key Rules:**
  - `@typescript-eslint/explicit-function-return-type: error`
  - `@typescript-eslint/no-floating-promises: error`
  - `simple-import-sort/imports: error`
  - `simple-import-sort/exports: error`

## Coding Conventions

- TypeScript strict-ish: explicit return types required, no floating promises
- ES modules throughout (`"type": "module"` in package.json)
- Imports use `.js` extensions (TypeScript convention for ESM compatibility)
- Private class fields use `#` prefix (ES private fields)
- Interface-first design — most services have an `I*` interface counterpart
- Dependency injection via constructor with `IServiceContainer`
- Enums for all string-based identifiers (bot functions, interactions,
  HTTP methods, etc.)
- Sorted imports enforced by ESLint
- Logger instances are created via `services.getLogger('ClassName')`

## Workflow Files

ComfyUI workflow JSON files live under `workflows/` and are loaded at runtime
by `WorkflowService`. They are organized by generation type (`txt2img`,
`img2img`, `txt2vid`, etc.) with example presets under
`workflows/examples/`. The `workflows/` directory is volume-mounted in Docker
for runtime customization.
