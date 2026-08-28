# Long-Term Memory Bugfixes and Test Coverage

**Date:** 2026-08-28
**Status:** Implemented
**Scope:** Fix the seven defects found in the LTM code review plus one user-reported embedding-source bug, with TDD coverage for each. Covers `MemoryCommandHandler`, `MemoryDatabase`, `MemoryService`, and `GenerativeChatClient`. No schema changes, no new features.

## Goals

- Fix every HIGH/CRITICAL defect so LTM behaves correctly at scale (multi-page history, cross-server isolation, large deletions) and honors privacy gating.
- Lock each fix in with a regression test written before the fix (RED → GREEN).
- Establish the first test suites for LTM files, which previously had none.

## Non-Goals

- The MEDIUM/LOW review items: backfill allow-list enforcement (#8), >15-min interaction expiry (#9), `#getDatabase()` race (#10), catch-up `afterDate` semantics (#11), bot-reply attribution (#12), `getMemoriesByModel` memory footprint (#13), explicit `close()` lifecycle (#14), prompt-injection hardening, dedup of helper logic. These remain open follow-ups.
- Schema migrations for the orphans left behind by pre-fix runs (rows stranded under an old embedding model are picked up by fix #7 on next startup; orphaned `LlmChatMessage_vec_<dim>` tables from dimension changes are not cleaned up).

## Bug Summary and Fixes

### 1. Backfill pagination O(n²) — `MemoryCommandHandler.#backfillChannel`

**Bug:** The loop set `beforeId = lastMessage.id` where `lastMessage` was the *newest* message of the sorted batch. Since Discord's `fetch({ before })` returns messages newest-to-oldest, every page re-fetched nearly the same window, sliding back only one message per page — a full 250-message backfill issued ~15,000 fetches.

**Fix:** Paginate with `beforeId = sortedMessages[0].id` (the *oldest* message of the page), so each page advances a full page size.

**Test:** Backfill of a 250-message channel must process all 250 messages with a bounded number of `fetch` calls (one per page + initial), not one per message.

### 2. Catch-up pagination skips messages — `MemoryCommandHandler.#catchUpChannel`

**Bug:** Catch-up used `after: afterId`, but Discord returns the *newest* 100 messages matching the filter. Setting `afterId = newest` each loop meant the 101st-from-newest and older pending messages were never fetched: catching up 250 messages processed only 100.

**Fix:** Rewrite catch-up to walk *backward* with `before:` from the newest message, stopping when a batch's oldest `createdTimestamp` falls at or below the catch-up date (`reachedLowerBound`). Eligibility filter: `createdTimestamp > afterDate.getTime()`. A `Set` of processed message IDs dedupes overlap.

**Test:** Catch-up of 250 messages newer than the latest stored memory must process all 250.

### 3. KNN `k` applied before JOIN filters — `MemoryDatabase.queryMemories`

**Bug:** sqlite-vec's `embedding MATCH ? AND k = ?` selects the k nearest neighbors across *all* servers/models first; the `serverId`/`embeddingModel` JOIN filters then discard rows. Other servers' memories consumed the top-K budget, so retrieval could return nothing despite a server having plenty of relevant memories.

**Fix:** Over-fetch with `k = topK * 4`, apply the real filters, then `LIMIT topK` on the ordered results.

**Test:** With memories spread across two servers, querying server B must return B's top matches rather than being starved by server A.

### 4. Non-atomic multi-statement writes — `MemoryDatabase`

**Bug:** `storeMemory` (relational insert + vec insert), `updateMemoryEmbeddingModel` (vec delete + vec insert + model update), and `removeConsent` (memories delete + consent delete) were non-atomic. A failed vec insert left a relational row without a vector; worse, the unique index on `discordMessageId` then permanently blocked re-storing that message.

**Fix:** Wrap all three operations in `this.#db.transaction(...)`, so any failure rolls back the whole write.

**Tests:**
- `storeMemory` with a dimension-mismatched embedding throws, leaves no relational row (`hasMessage` false, count 0), and a retry with a valid embedding succeeds.
- `updateMemoryEmbeddingModel` with a mismatched dimension rolls back: old vec row survives, no row is labeled with the new model.

### 5. Deletion explodes on large histories — `MemoryDatabase.`#deleteMemoriesByUser``

**Bug:** Vector deletion used `DELETE ... WHERE rowid IN (?, ?, ...)` with one placeholder per memory. SQLite's variable limit (32,766) is crossed by any sizeable history, throwing "too many SQL variables" and breaking `/memory forget` entirely for long-time users.

**Fix:** `DELETE FROM <vec> WHERE rowid IN (SELECT id FROM LlmChatMessage WHERE userId = ?)` — a single bound parameter. (Subselects are allowed for `DELETE` on vec0 even though bound *parameters* on `rowid` are not.)

**Test:** With 33,000 seeded rows, `removeConsent` deletes every row (vec + relational + consent) without error.

### 6. Passive storage bypassed channel gating — `GenerativeChatClient.#storeMessagePassively`

**Bug:** `#onMessageCreate` calls passive memory storage before reply logic, so memories were stored from channels the bot was not configured to participate in: channels outside the `discordChannels` allow-list, inside `discordChannelsDisallowed`, and from DMs (where `serverId` is `null`, making the stored memory permanently unretrievable).

**Fix:** After the bot-author check, mirror `DiscordReplyFilter` gating: skip DMs (`message.guild === null`), skip messages from disallowed channels, and when an allow-list is configured (`length > 0`), skip messages from channels not on it.

**Tests:** Three gating cases (unallowed channel, disallowed channel, DM) must enqueue zero embed tasks; two control cases (allowed channel, allow-list empty) must enqueue one.

### 7. Migration only handled the legacy empty model — `MemoryService.#migrateEmbeddingModel`

**Bug:** Migration re-embedded only rows with `embeddingModel = ''`, the legacy marker. Switching directly from model A to model B silently stranded every memory stored under A: it was excluded by both the old migration query and by `queryMemories`' model filter.

**Fix:** New `MemoryDatabase.getMemoriesNotUsingModel(currentModel)` (`WHERE embeddingModel != ?`) drives migration, so *any* outdated row (empty or a previous named model) gets re-embedded into the current model.

**Test:** Seed a memory under `model-a`, open a `MemoryService` for `model-b`, then `retrieve()` must find it.

### 8. Embedding source was message text only — `MemoryService.store` / `retrieve` / migration (user-reported)

**Bug:** Embeddings were computed from `llmChatMessage.message` (raw text), losing speaker/channel/timestamp context that distinguishes identical text in different situations. Retrieval embedded queries differently from storage would also degrade ranking.

**Fix:** Embed `JSON.stringify(llmChatMessage)` consistently at all three call sites: `store`, `retrieve` (query embedding), and `#migrateEmbeddingModel` (re-embedding reads `record.llmChatMessageJson`, the stored serialization). One vec0 quirk required `updateMemoryEmbeddingModel` to inline the integer rowid in the `INSERT` for the vec table (`LlmChatMessage_vec_*` table also updated for this) since vec0 rejects bound parameters on the `rowid` column; the value is an internal autoincrement integer.

**Tests:** `store` must receive an embedding of the full serialized `LlmChatMessage` (asserted via `JSON.parse` of the captured argument), and the migration re-embed path must use the stored JSON.

## Verification

- New suites (RED first, each failing for the documented reason before its fix):
  - `src/services/clients/chat/discord/commands/MemoryCommandHandler.test.ts` — pagination (#1, #2)
  - `src/services/clients/llm/memory/MemoryDatabase.test.ts` — KNN (#3), transactions (#4), 33k-row deletion (#5)
  - `src/services/clients/chat/discord/GenerativeChatClient.test.ts` — gating (#6)
  - `src/services/clients/llm/memory/MemoryService.test.ts` — migration (#7), embedding source (#8)
- Full suite: 414 tests / 32 suites passing; `npm run lint` clean.