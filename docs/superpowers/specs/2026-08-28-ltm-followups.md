# Long-Term Memory Follow-up Improvements

**Date:** 2026-08-28
**Status:** Implemented
**Scope:** Round-two LTM work: fix review items #9–#14 from the follow-up triage, the user-requested full-JSON embedding source with migration of existing databases, and the two approved low-priority cleanups. Item #8 (backfill not restricted to the `discordChannels` allow-list) was ruled **by design** and is not addressed. Builds on `2026-08-28-ltm-bugfixes.md`.

## Goals

- Never block a slash-command ack on a potentially multi-hour backfill (interaction tokens expire at 15 minutes).
- Make every answer above reflect "did the user mean *this* conversation?" with "I'll remember you." — the backfill covers more than this conversation.
- Store message timestamps (not insertion timestamps) so catch-up resumes from the right point.
- Deduplicate bot messages per user so unrelated users' memories aren't attributed to whichever user happened to be backfilled first.
- Existing databases gain the full-JSON embedding via a batched, paged migration.
- No database-handle leaks: concurrent opens race-free, closed on shutdown.

## Changes

### #9 — Ack-first `/memory remember` (`MemoryCommandHandler`)

**Before:** The handler awaited the entire backfill before `editReply`, holding the interaction >15 minutes on large histories and throwing an unhandled rejection on the final reply.

**Fix:** After consent is set (or found already-set-but-backfill-incomplete), the handler replies immediately with **"I'll remember you. Backfilling your earlier messages in the background..."** (resume variant: "I'll remember you. Resuming backfill of your earlier messages in the background..."). The backfill then runs via `void this.#runBackfillInBackground(...)` — an internal try/catch logs failure and calls `markBackfillComplete` when it succeeds; no interaction methods are touched after the ack.

**Tests:** Ack text asserted via `stringContaining("I'll remember you.")`; ordering test proves `editReply` fires before `markBackfillComplete` and that backfill completion happens afterward (inclusive final event assertion).

### #10 — Race-free database open (`MemoryService`)

**Before:** `#getDatabase()` cached the *instance*, so two concurrent first-callers could both see `null` and each construct a `MemoryDatabase` during the `await` gap of the dims probe.

**Fix:** `#getDatabase()` now caches the **promise** (`#databasePromise`), so every caller awaits the same in-flight construction. Exposed as `waitForInitialMigration()` for tests/shutdown.

**Test:** With a manually-resolvable embed stub, two concurrent service calls result in exactly one embed call (single construction).

### #11 — `createdAt` from message datetime

**Before:** Rows stored `Date.now()`-style insertion timestamps; catch-up (`getLatestMemoryTimestamp`) therefore restarted from the wrong position after a migration or gap.

**Fix:** `storeMemory(..., { createdAt: llmChatMessage.datetime })` — the Discord message's ISO timestamp — and migration repairs legacy rows' `createdAt` from the stored `llmChatMessageJson.datetime` while re-embedding.

**Tests:** `getLatestMemoryTimestamp` returns the message's own datetime after `store`; migration test asserts the repaired value replaces a seeded 1999 sentinel.

### #12 — Per-user message dedupe (`MemoryDatabase` migration)

**Before:** A global unique index on `discordMessageId` made the first backfiller claim every bot reply globally, so user B's history could attribute the bot's replies to user A's account boundary.

**Fix:** The legacy global index is dropped and replaced with `idx_LlmChatMessage_userId_discordMessageId ON LlmChatMessage(userId, discordMessageId) WHERE discordMessageId IS NOT NULL`; the store-time dedupe check is now `WHERE userId = ? AND discordMessageId = ?`. The same Discord message may be stored once per interested user.

**Tests:** Same user re-storing the same Discord message is still deduped; two different users storing the same Discord message both succeed; a legacy sentinel-named global index is dropped and the per-user index takes over.

### #13 + existing-DB repair — Full-JSON embeddings with batched migration

**Before (user report):** Rows written before the first fix round had embeddings of raw `message` text only; switching to JSON embeddings silently left them unsearchable (model/source mismatch excluded them from `queryMemories`).

**Fix (three layers):**
1. **Schema:** new `embeddingSource TEXT NOT NULL DEFAULT 'message'` column on `LlmChatMessage` (legacy rows default to `'message'`; new rows are `'json'`). Added via `#migrateExistingDb` with a sentinel-guaranteed `PRAGMA table_info` check so re-opening a migrated DB is a no-op.
2. **Paged re-embed queue:** `getMemoriesNeedingReembed(embeddingModel, afterId, limit)` selects rows where `embeddingModel != current OR embeddingSource != 'json'`, ordered by `id`, batched (`BATCH = 32`). `#migrateEmbeddingModel` loops pages, calls `embedBatch` once per page, and `updateMemoryEmbedding(id, model, embedding, createdAt)` (transactional, inline rowid) commits model + source + repaired datetime together. A row that fails stays in the query and is retried on the next startup.
3. **Batch API:** `OllamaClient.embedBatch(inputs: string[])` sends all inputs in a single `embed({ model, input: [...] })` request; empty input short-circuits without an HTTP call.

**Tests:** DB-level paging test (25 rows → pages of 10/10/5/0); service-level tests for raw-source repair (ending `getMemoriesNeedingReembed` empty, `embeddingSource = 'json'`, `createdAt` repaired, embed input = full JSON) and batching (one `embedBatch` call with all 5 inputs, zero non-probe `embed` calls); OllamaClient-level tests for `embedBatch` happy path, empty-input short circuit, and unconfigured-model throw.

### #14 — Database close on shutdown (`MemoryService`, `app.ts`)

**Before:** `MemoryDatabase.close()` was never called; Windows file handles and WAL state lingered.

**Fix:** `closeDatabase()` on `MemoryService` (awaits the cached promise, closes, resets to `null`; no-op when never opened — including media-mode bots). `app.ts` registers `process.once('SIGINT'|'SIGTERM'|'exit')` → `void memoryService.closeDatabase()`. `closeDatabase` added to `IMemoryService`.

**Test:** After `setConsent` + `closeDatabase`, a fresh raw connection sees the persisted consent (proves the handle was released, not just cached).

### Low-priority cleanups

- **Dead null check:** `MemoryService.hasMessage` had `discordMessageId === null` on a `string` parameter — removed.
- **Duplicated backfill logic:** channel collection (guild/channel/type/disallowed/viewable filtering, duplicated in `#catchUpCompletedUsers` and `#backfillMessages`) and the message eligibility checks (`#isStorable` + author tests, duplicated in `#catchUpChannel` and `#backfillChannel`) extracted to `src/services/clients/chat/discord/commands/backfillUtilities.ts` (`collectBackfillChannels`, `isBackfillParticipant`, `isStorableMessage`). Handler delegates via `#shouldStore`. No behavior change (existing pagination tests still pass unchanged).

## Deliberately unchanged

- **#8 — backfill allow-list skip:** by design (user ruling).
- **ollamaTopK as LTM retrieval count:** by design (user ruling).

## Verification

- Test count: 432 passing / 32 suites (375 before this round's additions).
- All new behavior followed RED → GREEN (each test observed failing for its documented reason before its fix).
- `npm run lint` clean.