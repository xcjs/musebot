# Changelog

All notable changes to Musebot are documented in this file.

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
