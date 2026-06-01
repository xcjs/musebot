# ADR 001: Multi-Instance Support via Container Hierarchy

## Status

Accepted

## Progress Log (Session: 2026-05-20)

### Import Fix (Corrupted Import Statements)

**Problem:** 60+ files had corrupted import statements using curly braces and
single quotes (e.g.,
`import { IBotServiceContainer } from {'../IServiceContainer.js'}`), causing
`TS1005` parse errors across the entire codebase.

**Fix:** Replaced all curly-brace + single-quote imports with standard
double-quoted strings. Also corrected import paths from
`IBotServiceContainer.js` to `IServiceContainer.js` (the module is defined in
`IServiceContainer.ts`).

**Justification:** These were likely introduced by an automated tool. Standard
ES module syntax is required for TypeScript to parse correctly.

### MockContainer Interface Conflict

**Problem:** `MockContainer` was extending both `IServiceContainer` and
`IBotServiceContainer`, but their `getTaskChannelPostProcessor` and
`getWorkflowMutator` signatures were incompatible (`IServiceContainer` takes 3
arguments including a `services` parameter; `IBotServiceContainer` takes 2).

**Fix:** Changed `MockContainer` to extend only `IBotServiceContainer` and
explicitly add `globalSettings: IGlobalSettings`. This aligns with how it is
actually consumed (primarily by `IBotServiceContainer`-consuming services).

**Justification:** A test mock does not need to satisfy both interfaces if the
system is designed so that consumers pick one. The `IBotServiceContainer` is the
superset of services needed for task execution, and `globalSettings` is added
for the few places that need global configuration.

### TaskChannel Simplification

**Problem:** `TaskChannel` constructor took two containers (`IServiceContainer`
and `IBotServiceContainer`), which was redundant since `IBotServiceContainer`
already provides `getLogger()` and `getTaskChannelPostProcessor()`.

**Fix:** Simplified `TaskChannel` constructor to accept only
`IBotServiceContainer`. Removed the `IServiceContainer` parameter entirely.

**Justification:** Reduces parameter count, eliminates ambiguity about which
container to use for logging, and aligns with the principle that task channels
are bot-specific entities.

### SerialStrategy Simplification

**Problem:** `SerialStrategy` constructor accepted `IServiceContainer` only to
read `globalSettings.taskQueueForceSerialAcrossHosts`.

**Fix:** Changed the constructor to accept a boolean `includeHostname` directly.
Updated `ServiceContainer` to pass
`!this.#globalSettings.taskQueueForceSerialAcrossHosts`.

**Justification:** Reduces coupling between `SerialStrategy` and the container
hierarchy. The strategy only needs a configuration flag, not a full service
container.

### Test File Updates

**Problem:** Test files were still calling the old constructor signatures.

**Fix:** Updated `TaskChannel.test.ts`, `TaskQueue.test.ts`,
`SerialStrategy.test.ts`, and `mockServiceContainer.ts` to match the new
signatures.

### Bot Workflow Directory Support

**Problem:** Multiple bot instances need to read workflow templates from isolated directories to support different workflows per bot, while allowing sharing when bots have the same identifier.

**Requirements:**
- Each bot must have a unique `botId` identifier
- Workflow directory path: `./workflows/{botId}/`
- Directory creation: Create bot directory if it doesn't exist
- Validation: Throw `Error('No workflows found in bot workflow directory.')` if directory exists but contains no workflows
- Conditional validation: Only apply workflow validation when `stableDiffusionHosts.length > 0`
- Sharing: Multiple bots with the same `botId` share the same workflow directory
- Backward compatibility: .env-based configuration (no botId) falls back to `./workflows/` without bot prefix

**Implementation:**
1. Add `botId: string` field to `IBotConfig` interface
2. Add `botId: string | null` to `IGlobalSettings` interface
3. Add `botId: string | null` property to `IEnvironmentSettings`
4. Update `EnvironmentSettings` constructor to accept `botId` parameter
5. Update `IBotServiceContainer` interface
6. Update `BotServiceContainer` to pass `botId` from config to `EnvironmentSettings`
7. Update `WorkflowService` constructor to accept `botId` parameter
8. Update `WorkflowService.loadWorkflows()` to:
   - Use `./workflows/` as base path
   - Append `/{botId}/` if botId provided
   - Create directory recursively if missing
   - Validate workflow count (throw if 0 and ComfyUI hosts configured)
9. Update `ServiceContainer` to expose `getBotId()` method
10. Update `app.ts` to pass `botId` from config to `BotServiceContainer`
11. Add `botId` field to `config.json` entries

**Justification:** Provides isolated workflow environments for multiple bots while allowing shared workflows when needed. Clear error messages prevent silent failures. Backward compatibility ensures existing deployments continue to work.

## Consequences

- **Positive:**
  - Ability to host multiple bots in one process.
  - Centralized resource management (e.g., a single `TaskQueue` for all bots).
  - Clear separation between global and instance-level concerns.
  - Isolated workflow directories per bot while allowing shared workflows when needed.
  - Full backward compatibility with .env-based configuration.
- **Negative:**
  - Significant refactoring of the DI chain across almost all services.
  - Increased complexity in the bootstrapping process.

## TODO List

### Phase 1: Configuration Refactor

- [x] Define `IBotConfig` interface that matches the structure of
  `IEnvironmentSettings`.
- [x] Create a `ConfigLoader` utility to handle reading `config.json` or falling
  back to `process.env`.
- [x] Refactor `EnvironmentSettings` to accept a config source in its
  constructor.
- [x] Update `EnvironmentSettings.test.ts`.

### Phase 2: Container Restructuring

- [x] Create `ServiceContainer`.
- [x] Create `BotServiceContainer`.
- [x] Move shared services to `GlobalServiceContainer`.
- [x] Move bot-specific services to `BotServiceContainer`.
- [x] Update all services' DI to use the new container hierarchy.

### Phase 3: Bootstrapping & Lifecycle

- [x] Refactor `app.ts` to initialize `GlobalServiceContainer` and multiple
  `BotServiceContainer` instances.

### Phase 4: Verification & Cleanup

- [x] Verify backward compatibility (env vars) — `EnvironmentSettings` falls
  back to `process.env` when config is absent.
- [x] Verify multi-instance support (`config.json`) — `app.ts` iterates over
  all bot configs via `forEach` loop.
- [x] Add workflow directory support for multiple bots
- [x] Verify that the build still works (`npm run build`) — Build succeeds
  with no errors.
- [x] Run `npm run lint` — All linting checks pass.
- [x] Run and update tests — All 269 tests passing.
