# Changelog

All notable changes to Musebot are documented in this file.

## [9.3.0] — 2026-06-30

### Added

- Optional long-term memory (LTM) for chat-mode bots via SQLite + sqlite-vec vector embeddings — memories are stored as `LlmChatMessage` objects with embeddings from a configurable `ollama.embeddingModel`, retrieved as the top-K most similar server-scoped memories and injected as system messages before each response
- Opt-in per-user consent for LTM with `/memory remember` (opts in and backfills message history from all accessible text channels across all servers) and `/memory forget` (permanently deletes all stored memories globally) slash commands, gated on `LongTermMemory` feature detection
- Passive listening stores messages from opted-in users across all channels (even where the bot does not respond), with bot responses attributed to the triggering user for consent and deletion
- Backfill resume, startup catch-up, and message deduplication — interrupted backfills resume on restart, missed messages are caught up by timestamp, and a unique `discordMessageId` index prevents duplicate storage
- Embedding model tracked per memory with automatic re-embedding on model change to prevent cross-model vector space mismatch
- Embedding calls routed through the task queue via `OllamaEmbedTask` to avoid VRAM contention with Ollama LLM tasks on the same host
- Vision capability auto-detected from configured models; image attachments passed to vision-capable models during chat, and image interpretations stored in long-term memory
- Web link content extraction — URLs in messages are fetched via Readability and injected as context before replying; extracted text stored as `web` attachments in LTM
- Long-term memory section in the in-bot chat help article, describing LTM and the `/memory` slash commands
- Long-Term Memory documentation page (`docs/chat/02-long-term-memory.md`) wired into the VuePress sidebar
- ADR 004: Long-Term Memory via Vector Embeddings
- GitHub repo link, vision, and web link features highlighted in README; model examples updated to `gemma4:12b`

### Changed

- LLM context now sends structured `LlmChatMessage` JSON (username, display name, user ID, bot flag, message, datetime, roles, channel/thread/server info, mentions) instead of a plain `displayName: message` string; `ContextMessage.timestamp` uses the Discord message `createdAt` rather than processing time
- `guidanceScaleInterval` moved from top-level `IBotConfig` to `comfyUi.guidanceScaleInterval` (optional, defaults to `0.5`)
- `WebContentService` replaced jsdom with linkedom for pkg binary compatibility, removing 45 transitive packages
- `IChatMessageFilter` split into `IOutputChatMessageFilter` and new `IInputChatMessageFilter` for pre-LLM prompt augmentation

### Fixed

- sqlite-vec extension loading in pkg binary — the `vec0` native library is extracted to a temp file and loaded with an explicit `sqlite3_vec_init` entry point since SQLite's `loadExtension` cannot read from pkg's virtual snapshot filesystem
- Per-process singleton temp path for the sqlite-vec extension to avoid multi-instance collisions
- sqlite-vec KNN query: removed `LIMIT` clause conflicting with the `k=?` constraint; relational `rowid` captured before `vec` insert to avoid `last_insert_rowid` returning the `vec0` table's rowid
- Memory database path scoped per bot instance (`workflows/{botId}/txt2txt/memory.db`)
- Vision interpretation skipped for already-stored messages to prevent backfill stalls
- pkg snapshot missing `drizzle-orm` submodules; `allowScripts` added for native addon packages

## [9.2.1] — 2026-06-27

### Added

- Configurable ComfyUI render timeout (`comfyUi.timeoutMinutes`) aborts and interrupts the workflow when a render exceeds the time limit (default 30 minutes)

## [9.2.0] — 2026-06-27

### Added

- Message filter pipeline for chat processing (`IChatMessageFilter`) with streaming-aware filters that skip processing until the final chunk
- `DiscordCodeBlockSplitFilter` closes and re-opens code fences split across multiple Discord messages
- `DiscordMessageSplitFilter` splits content at Discord's 2000-char limit, preserving attachments on the last message
- `DiscordCodeBlockExtractFilter` extracts code blocks into file attachments with LLM-generated filenames
- `DiscordAttachmentFilter` caps attachments at Discord's 10-file limit
- `DiscordMarkdownTableFilter` wraps markdown tables in preformatted text blocks with word-wrapped, consistent-width columns

### Changed

- `ShowSource` button render request length gate removed now that prompts are stored in a sidecar `.dat` file
- `OllamaMessageTask` inline image-prompt generation extracted into a dependent child `OllamaGenerateTask` with `onSuccess`/`onFailure` callbacks
- Full message context passed to code block filename generation prompt
- `Prompt.dat` state file attachment skipped in chat mode
- `ComfyUiAttachmentTask` preserves existing attachments on edit and skips when at the attachment limit

### Fixed

- `splitText` infinite loop on newline at buffer start; code fence constant made private
- Duplicate `ComfyUiAttachmentTask` execution caused by concurrent `TaskQueue.#processQueue()` calls picking up the same `Idle` task — tasks are now marked `Busy` before `preProcess()`, closing the race window

## [9.1.0] — 2026-06-25

### Added

- Child tasks now support an `onFailure` callback so parent tasks can react to child task failures, replacing the dead `isChild` parameter on `IGlobalServiceContainer.getTaskChannelPostProcessor`
- `CHILD_TASK_CHANNEL_SUFFIX` constant extracted for child task channel naming
- `ShowSource` (`{ }`) button now appears on audio (txt2music/txt2audio) action rows, not just image/video
- JSDoc on `trimTrailingJsonContent`

### Changed

- VRAM reclamation now polls Ollama model unload status (using `taskRetryDelayMilliseconds`) instead of gating on a `minVramFreeRatio` ratio, removing the abort iteration limit
- VRAM config consolidated to a single `minVramFreeRatio` key (removed from docs, example config, and mock container after the polling approach replaced it)
- Structured JSON parsing prefers `response.response` over `response.thinking`, then restores original reasoning-content preference as a fallback
- State file attachment renamed from `SerializableRenderRequest.json` to `Prompt.dat` — the `.dat` extension hides Discord's built-in code-block preview while keeping the content as parseable JSON
- `SerializableRenderRequest` is now stored in a dedicated JSON attachment on media responses
- `ShowSource` button only renders when the JSON render request fits within a single Discord message (2000 chars)
- `ActionRowBuilderFactory` simplified to use nullish coalescing (`??=`) and `Array.includes`

### Fixed

- Structured LLM responses now have trailing non-JSON content trimmed, and raw control characters in JSON string values are escaped before parsing
- `TaskChannel` sort moved to a separate statement, removing the `@typescript-eslint/unbound-method` eslint-disable directive
- Stale eslint-disable directives removed from workflow mutators
- VRAM reclamation hardened to prevent ACE-Step hang in serial mode
- Successful VRAM reclamation now logged in Ollama and ComfyUI `free()`

## [9.0.12] — 2026-06-19

### Changed

- Media channel thread title simplified from "Musebot {version} Release" to "Musebot {version}".

## [9.0.11] — 2026-06-19

### Changed

- Release CI job no longer attaches zip archives to the Discord media channel post (they exceeded webhook upload limits). The post now includes only the changelog embed and `logo.jpg`. Release archives can be attached manually as a comment. Removed the `zip` dependency and `before_script` install step.

## [9.0.10] — 2026-06-19

### Fixed

- Changelog extraction now uses line-by-line parsing instead of a single multiline regex, resolving an issue where the changelog entry could not be found for the current release version in CI.

## [9.0.9] — 2026-06-19

### Fixed

- Release CI job now sets `thread_name` when posting to the Discord media channel (required for forum channels).

## [9.0.8] — 2026-06-19

### Fixed

- Release CI job now reads `logo.jpg` from the project root for the Discord media channel embed image, instead of looking for it inside the extracted artifact directory.

## [9.0.6] — 2026-06-19

### Changed

- Release CI job now creates zip archives matching GitLab artifact path layout (`build/dist/linux/...`, `build/dist/windows/...`) using `zip`, replacing the GitLab API download approach.

## [9.0.5] — 2026-06-19

### Changed

- Release CI job now downloads GitLab artifact zips directly via the API instead of re-zipping extracted directories. Removes the `zip` dependency and `before_script` install step.

## [9.0.4] — 2026-06-19

### Fixed

- Release CI job now installs `zip` via `before_script` — the `node:24` Docker image does not include `zip` by default, causing the release script to fail when creating archives

## [9.0.3] — 2026-06-19

### Added

- GitLab CI release pipeline — tagging a release now automatically publishes to a Discord media channel (with Windows and Linux release archives, `logo.jpg` preview, and changelog embed) and a Discord release news channel (with a "Musebot {version} Released!" embed). Requires `DISCORD_MEDIA_WEBHOOK` and `DISCORD_NEWS_WEBHOOK` CI/CD variables.
- `CHANGELOG.md` is now included in both Windows and Linux release archives.

## [9.0.2] — 2026-06-17

### Added

- `getMediaAttachments` method to `IAttachmentService`, `IReplyService`, `DiscordAttachmentService`, and `DiscordReplyService` — returns attachments matching image, audio, and video content types (`jpeg`, `jpg`, `png`, `webp`, `mp3`, `mp4`)

### Fixed

- "Show Source" (`{ }`) button no longer loops indefinitely with a typing indicator when used on a video response. `ShowDescriptionTask` now retrieves all media attachments instead of image-only attachments, so video responses (`video/mp4`) are included and their JSON render request is extracted and sent successfully

## [9.0.1] — 2025-06-13

### Changed

- Marked `readonly` on private members in `ChatHelpService` that are only assigned in the constructor
- Removed unnecessary `as` typecasts in `mockBotServiceContainer` (`IGlobalConfiguration`, `IConfigurationService`, `IParallelizationStrategy`)
- Removed `isChild` parameter from `IGlobalServiceContainer.getTaskChannelPostProcessor` — it was declared in the interface but never passed or used by any caller
- `BotServiceContainer.getTaskChannelPostProcessor` now accepts `isChild` per the `IBotServiceContainer` interface signature (currently unused, marked with eslint-disable)
- Consolidated `comfyUiOllamaPrompts` config property into `multiModal.randomPrompts` — the old top-level `comfyUiOllamaPrompts` key on `IBotConfig` has been removed in favor of `multiModal.randomPrompts`
- Consolidated `discord` config property into `chatApis.discord` — the old top-level `discord` key on `IBotConfig` has been removed; `channelsDisallowed` is now under `chatApis.discord`; `chatApis` is now required (non-optional)

### Removed

- Duplicated `getWorkflowMutator` method from `GlobalServiceContainer` and `IGlobalServiceContainer` — the canonical implementation lives on `BotServiceContainer` / `IBotServiceContainer`
- Unused imports from `GlobalServiceContainer` (`BotInteraction`, `getRandomArrayEntry`, all workflow mutator imports, `IWorkflow`, `IWorkflowMutator`)

### Fixed

- Invalid docs link in `README.md` (`docs/Musebot.md` → `docs/introduction.md`)

## [9.0.0] — 2025-06-12

### Breaking Changes

- **Configuration format changed from `.env` to `config.jsonc`.** Environment variable support (`.env` / `dotenv`) has been removed entirely. All configuration is now done via `config.jsonc` (or `config.json`), which supports JSON with comments. See the [Migration Guide](docs/musebot/03-migration-from-env-to-jsonc.md) for details.
- **Multi-bot support.** The configuration now supports an array of bot instances, each with its own Discord token, channels, Ollama hosts, ComfyUI hosts, and system prompt. A single Musebot process can run multiple bots simultaneously.
- **License changed to AGPL-3.0.** The proprietary XCJS license has been replaced with the GNU Affero General Public License v3.0.

### Added

- `config.jsonc` / `config.json` based configuration system with `ConfigurationService` and `ConfigLoader`
- `IBotConfig`, `IGlobalConfiguration`, and `IConfigurationService` interfaces
- Multi-bot support via `BotServiceContainer` — each bot gets its own service container with isolated configuration
- `config.example.jsonc` with full schema documentation and comments
- ADR documents: [001-multi-instance-support](docs/adr/001-multi-instance-support.md), [002-config-format-compatibility](docs/adr/002-config-format-compatibility.md), [003-drop-env-support](docs/adr/003-drop-env-support.md)
- `FeatureService` unit tests
- `ConfigurationService` unit tests (401 lines)
- `mockBotServiceContainer` test utility
- System prompt now accepts either a `string` or `string[]` (multi-line arrays)
- `botId` included in logger output for multi-bot identification
- JSON config settings logged to console on startup
- `CHANGELOG.md`

### Changed

- **Configuration system overhauled:** `IEnvironmentSettings` / `EnvironmentSettings` replaced by `IConfigurationService` / `ConfigurationService`
- `ServiceContainer` renamed to `BotServiceContainer` (per-bot); new `GlobalServiceContainer` manages cross-bot concerns
- `WorkflowService` and task factories refactored to use `BotServiceContainer`
- `docker-compose.yml` now mounts `config.jsonc` instead of `.env`
- `.gitlab-ci.yml` simplified workflow copy to `cp -rf workflows/examples build/pkg/workflows` instead of per-file copies
- `.gitlab-ci.yml` now copies `config.example.jsonc` and `LICENSE` (instead of `config.jsonc` and `LICENSE.md`)
- Workflows directory reorganized: `workflows/production/` renamed to `workflows/examples/`
- Archived workflow files removed from `workflows/examples/`
- Root `README.md` rewritten with comprehensive documentation
- Documentation updated throughout to reference `config.jsonc` instead of `.env`
- ADR 002 status changed to "Superseded by ADR 003"
- ADR 003 status changed to "Accepted"

### Removed

- `.env.example` file
- `.env` / `dotenv` support (`EnvironmentSettings`, `EnvironmentKey`, related tests)
- `BotFunction` enum (replaced by `BotMode`)
- `mockServiceContainer` test utility (replaced by `mockBotServiceContainer`)
- Continue Dev configuration files (`.continue/`)
- Archived workflow files from `workflows/examples/`
- Deprecated video workflows
- `LICENSE.md` (proprietary XCJS license)

### Fixed

- JSON5/JSONC import corrected
- Type issues resolved across service layer
- Button labels restored
- Documentation syntax corrections
- ESLint and code quality issues resolved
- `WorkflowNotFoundError` when clicking Randomize (or other interaction buttons) on a result whose `SerializableRenderRequest.workflow` was `undefined`. The fallback path in `ComfyUiInteractionTask` now sets `workflow` on the new render request, and mutators (`RandomPromptMutator`, `ExpandPromptMutator`, `GuidanceScaleMutator`) now explicitly set `mutatedRequest.workflow` to guard against stale or missing values
