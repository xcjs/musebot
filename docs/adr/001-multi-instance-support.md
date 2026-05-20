# ADR 001: Multi-Instance Support via Container Hierarchy

## Status

In Progress

## Progress Log (Session: 2026-05-20)

### Import Fix (Corrupted Import Statements)

**Problem:** 60+ files had corrupted import statements using curly braces and
single quotes (e.g., `import { IBotServiceContainer } from
{'../IServiceContainer.js'}`), causing `TS1005` parse errors across the entire
codebase.

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
Updated `GlobalServiceContainer` to pass
`!this.#globalSettings.taskQueueForceSerialAcrossHosts`.

**Justification:** Reduces coupling between `SerialStrategy` and the container
hierarchy. The strategy only needs a configuration flag, not a full service
container.

### Test File Updates

**Problem:** Test files were still calling the old constructor signatures.

**Fix:** Updated `TaskChannel.test.ts`, `TaskQueue.test.ts`,
`SerialStrategy.test.ts`, and `mockServiceContainer.ts` to match the new
signatures.

## Consequences

- **Positive:**
  - Ability to host multiple bots in one process.
  - Centralized resource management (e.g., a single `TaskQueue` for all bots).
  - Clear separation between global and instance-level concerns.
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

- [x] Create `GlobalServiceContainer`.
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
- [ ] Verify multi-instance support (`config.json`) — `app.ts` currently loads
  only `bots[0]`, not multiple instances.
- [ ] Verify that the build still works (`npm run build`) — `MockContainer` in
  test files has signature mismatches.
- [ ] Run `npm run lint` — `SerialStrategy.test.ts` has unused variables;
  `mockServiceContainer.ts` has import sort / unused import issues.
- [ ] Run and update tests — 3 test suites failing due to `MockContainer`
  signature mismatches.
