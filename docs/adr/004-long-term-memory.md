# ADR 004: Long-Term Memory via Vector Embeddings

## Status

Accepted

## Context

Musebot's chat mode currently maintains only a rolling in-memory conversation
context (`ContextService`) that is lost when the bot restarts and is scoped to a
single Discord channel. There is no persistent memory across sessions, channels,
or servers. The bot cannot recall facts learned about a user or prior
conversations.

The existing chat message filter system (`IChatMessageFilter`) operates
exclusively on **outgoing** LLM responses — transforming content for Discord
display (code block extraction, markdown table formatting, message splitting,
attachment capping). There is no filter mechanism for **incoming** messages
before they reach the LLM. The input side uses different abstractions entirely
(`IContextMessageFactory.formatChatMessage`, `fromChatMessage`, `fromLlmMessage`).

A new `LlmChatMessage` interface was recently introduced
(`src/services/clients/llm/ollama/models/LlmChatMessage.ts`) to replace the
plain-string `"displayName: message"` format with a structured JSON payload sent
to the LLM. This interface captures username, displayName, userId, isBot,
message text, datetime, roles, channel info, thread info, server info, and
mentions — providing rich metadata that can be embedded and retrieved.

No embedding, database, or vector store infrastructure exists in the codebase.
The `ollama` npm package (`^0.6.0`) already supports `client.embed({ model,
input })` but `OllamaClient` does not wrap it. No slash command infrastructure
exists — only button interactions are handled.

## Decision

Add optional long-term memory (LTM) to chat-mode bots using SQLite + sqlite-vec
+ Drizzle ORM. When `ollama.embeddingModel` is configured, Musebot embeds both
user messages and bot responses into a vector store, retrieves semantically
related memories for new prompts, and injects them as system-role context before
the LLM call. Users opt in/out globally via `/memory remember` and `/memory
forget` slash commands.

### Design Decisions

1. **Slash commands**: `/memory remember` and `/memory forget` as subcommands of
   a `memory` parent command. Ephemeral replies (only the invoking user sees
   confirmation).

2. **Retrieval scope**: Retrieve memories from ALL opted-in users in the same
   server (guild), not just the current user. Memories are scoped by `serverId`
   at query time.

3. **Storage**: Store BOTH user messages AND bot responses in the vector store,
   both as `LlmChatMessage` objects (bot responses have `isBot: true`).

4. **Embedding model config**: `ollama.embeddingModel` inside the existing
   `ollama` config block. Presence of this field = LTM enabled. No separate
   `memory.enabled` flag.

5. **Consent scope**: Global per-user. Opt in once, applies across all servers.
   Opt-out deletes ALL that user's memories globally.

6. **DB path**: `workflows/{botId}/txt2txt/memory.db`. Musebot creates the
   directory if missing. Scoped per bot instance.

7. **topK config**: `ollama.topK` inside the existing `ollama` block. Defaults
   to 5 if omitted.

8. **Feature detection**: New `SupportedFeature.LongTermMemory` (`'ltm'`), active
   when `ollama.embeddingModel` is set AND `ollamaHosts` present. Config-based
   check (consistent with existing `FeatureService` pattern — no HTTP probe).

9. **sqlite-vec limitation**: Does not support parameterized queries for vector
   operations. Use raw SQL via `better-sqlite3` for vector insert/query; Drizzle
   ORM for relational tables (consent tracking, message metadata).

10. **Table naming**: Singular StartCase entity names. When serialized Musebot
    types are stored, use the type name (e.g. `LlmChatMessage`).

11. **Filter direction split**: Rename `IChatMessageFilter` →
    `IOutputChatMessageFilter` (and all 5 existing implementations). Create new
    `IInputChatMessageFilter` interface. Container exposes both
    `getOutputChatMessageFilters()` and `getInputChatMessageFilters()`.

12. **Input filter I/O**: `IInputChatMessageFilter.process(llmChatMessage:
    LlmChatMessage, context: OllamaMessage[]): Promise<OllamaMessage[]>`. Uses
    internal Musebot types (not Discord types) to avoid tight coupling and
    support future backends.

13. **LlmChatMessage factory**: New `ILlmChatMessageFactory<ChatMessageType>`
    interface with `create(chatMessage): LlmChatMessage` and
    `createFromLlmResponse(response, context): LlmChatMessage`. Discord-specific
    implementation extracted from existing `formatChatMessage` logic. Future
    backends (Telegram, etc.) implement their own factory.

14. **Memory injection format**: Retrieved memories are injected as
    `OllamaRole.System` messages prepended to the context array, before the
    rolling context. A single concatenated system message wraps all retrieved
    memories to avoid context bloat. Memories are NOT added to
    `contextService.addContext` (would bloat rolling context — they are
    ephemeral per-request).

15. **Passive listening**: Store user messages in `GenerativeChatClient
    .#onMessageCreate` for opted-in users, regardless of whether the bot
    replies. Runs after the `shouldReply` channel/allowlist filter. Bot
    responses are stored in `OllamaMessageTask` after the LLM responds.

16. **Embedding input**: Embeddings are generated from just the `message` field
    (text content), not the full JSON-serialized `LlmChatMessage`. Metadata
    (channel, roles, etc.) is not semantically meaningful for similarity search.

17. **Bot response identity**: When storing bot responses as `LlmChatMessage`,
    use the Discord client's user (`discordClient.user`) for
    `username`/`displayName`/`userId`, with `isBot: true`.

18. **Embedding model tracking & auto-migration**: Each stored memory records
    the `embeddingModel` used to generate its vector. Queries filter by the
    currently configured model, preventing cross-model vector space mismatch.
    On startup, if the database contains memories embedded with a different
    model (or untagged memories from before this feature), `MemoryService`
    automatically re-embeds them using the current model — deleting old vectors
    and inserting new ones while preserving the relational row and its rowid.
    Old embeddings are deleted during migration (not retained).

19. **Backfill resume & catch-up**: The `UserConsent` table tracks a
    `backfillCompleted` flag. On first opt-in, `backfillCompleted` is set to
    `false`; it is set to `true` after the backfill completes. If a user runs
    `/memory remember` again with an incomplete backfill, the backfill resumes
    (skipping already-stored messages via `discordMessageId` deduplication). On
    startup, `BaseDiscordClient.onClientReady` calls
    `MemoryCommandHandler.resumeBackfills` which (a) resumes any incomplete
    backfills and (b) catches up completed users by fetching messages newer
    than the most recently stored memory timestamp (`getLatestMemoryTimestamp`)
    per channel — handling messages sent while the bot was offline. Each
    `LlmChatMessageRecord` stores a `discordMessageId` (null for bot responses)
    with a unique partial index to prevent duplicate storage.

## Rationale

**Persistent context**: Rolling context is lost on restart and scoped to a
channel. LTM gives the bot recall across sessions, channels, and servers.

**Vector similarity**: Embedding-based retrieval finds semantically related past
messages regardless of keyword overlap — more robust than text search for
conversational context.

**SQLite + sqlite-vec**: Lightweight, serverless, file-based. No external DB
process to manage. sqlite-vec adds vector operations without a separate service.
Consistent with Musebot's single-process deployment model.

**Drizzle + raw SQL hybrid**: Drizzle provides typed relational queries for
consent tracking and message metadata. sqlite-vec's lack of parameterized vector
queries necessitates raw SQL for vector ops — a pragmatic hybrid.

**Opt-in consent**: Memory storage requires explicit user consent. Global
per-user scope means one opt-in applies everywhere; opt-out deletes everything.
Respects user privacy.

**Input/output filter split**: The existing filter interface is implicitly
output-only. Adding input filters (memory retrieval before LLM call) with a
fundamentally different I/O shape (`LlmChatMessage` + `OllamaMessage[]` vs
`IChatMessage[]`) warrants explicit type-level separation. The rename makes the
direction clear and prevents future confusion.

**Internal type abstraction**: Using `LlmChatMessage` (a Musebot-internal type)
in the input filter interface, rather than `DiscordMessage`, decouples the
filter from Discord. Integration-specific factories map external types to
`LlmChatMessage`. This supports future backends (Telegram, Slack, etc.) without
changing the filter interface.

**Config-gated feature**: Presence of `ollama.embeddingModel` enables LTM. No
separate toggle — follows the pattern of existing features (Txt2Txt is enabled
by presence of hosts + models). The `SupportedFeature.LongTermMemory` enum value
allows other services to check LTM availability via `featureService.hasFeature`.

## Consequences

### Positive

- **Persistent recall**: Bot remembers user facts and past conversations across
  restarts, channels, and servers.
- **Semantic retrieval**: Vector similarity finds relevant context regardless of
  exact wording.
- **User-controlled**: Explicit opt-in/opt-out via slash commands. Users own
  their data.
- **Non-intrusive**: LTM is entirely optional. Bots without `embeddingModel`
  behave exactly as before.
- **Clean filter architecture**: Input/output split makes the filter pipeline
  direction explicit and extensible.
- **Backend-agnostic filter interface**: `IInputChatMessageFilter` operates on
  `LlmChatMessage`, not Discord types — ready for future integrations.
- **Feature detection integration**: `SupportedFeature.LongTermMemory` lets
  other services conditionally use memory capabilities.

### Negative

- **Native dependency**: `better-sqlite3` is a native addon. The `@yao-pkg/pkg`
  binary packaging path may require additional asset configuration. Docker
  (Node 24 direct) works without issue.
- **Storage growth**: The SQLite database grows with usage. No automatic
  pruning strategy is defined yet (see Future Considerations).
- **Embedding latency**: Each stored message and each retrieval query requires
  an Ollama embedding call, adding latency to message processing.
- **Breaking rename**: `IChatMessageFilter` → `IOutputChatMessageFilter` touches
  5 implementations, 2 reply services, the container interface, and the
  container implementation. Mechanical but wide-reaching.
- **New dependency surface**: drizzle-orm, better-sqlite3, sqlite-vec added to
  the dependency tree, increasing install/build complexity.

### Neutral

- **No performance impact when disabled**: Bots without `embeddingModel` incur
  zero overhead — `getInputChatMessageFilters()` returns an empty array and
  `MemoryService.isEnabled` is false.
- **Per-server retrieval scope**: Memories are retrieved within the same server.
  Cross-server retrieval is not supported (by design — users may want different
  personas in different servers).

## Implementation Plan

### Phase 1: Dependencies & Configuration

1. Install dependencies: `drizzle-orm`, `better-sqlite3`, `sqlite-vec`,
   `@types/better-sqlite3` (dev).
2. Add optional `embeddingModel?: string` and `topK?: number` to `IBotConfig
   .ollama`.
3. Add `ollamaEmbeddingModel: string | null` and `ollamaTopK: number` getters to
   `IConfigurationService` and `ConfigurationService` (default topK = 5).
4. Update `config.jsonc` with example `embeddingModel` and `topK` fields.
5. Add both new config values to `ConfigurationService.#logConfiguration()`.

**Files modified:**
- `package.json`
- `src/services/environment-settings/IBotConfig.ts`
- `src/services/environment-settings/IConfigurationService.ts`
- `src/services/environment-settings/ConfigurationService.ts`
- `config.jsonc`

### Phase 2: Feature Detection

1. Add `LongTermMemory = 'ltm'` to `SupportedFeature` enum.
2. In `FeatureService.loadFeatures()`, after the existing `Txt2Txt` check, add:
   if `ollamaHosts.length > 0` AND `ollamaEmbeddingModel !== null`, push
   `SupportedFeature.LongTermMemory`.

**Files modified:**
- `src/services/features/enum/SupportedFeature.ts`
- `src/services/features/FeatureService.ts`

### Phase 3: Embedding Support in OllamaClient

1. Add `async embed(input: string): Promise<number[]>` method to `OllamaClient`,
   wrapping `this.#client.embed({ model: embeddingModel, input })` and returning
   `response.embeddings[0]`.

**Files modified:**
- `src/services/clients/llm/ollama/OllamaClient.ts`

### Phase 4: LlmChatMessage Factory Refactor

1. Create `ILlmChatMessageFactory<ChatMessageType>` interface with:
   - `create(chatMessage: ChatMessageType): LlmChatMessage`
   - `createFromLlmResponse(response: string, context: BotResponseContext):
     LlmChatMessage`
2. Create `DiscordLlmChatMessageFactory` — moves object-building logic from
   `DiscordOllamaContextMessageFactory.formatChatMessage` into `create()`.
   `createFromLlmResponse` builds an `LlmChatMessage` with `isBot: true` for bot
   responses, using the Discord client's user identity.
3. Add `getLlmChatMessageFactory<ChatMessageType>():
   ILlmChatMessageFactory<ChatMessageType>` to `IBotServiceContainer` as a lazy
   singleton.
4. Update `DiscordOllamaContextMessageFactory.formatChatMessage` to delegate:
   `JSON.stringify(llmChatMessageFactory.create(chatMessage))`.

**Files created:**
- `src/services/clients/llm/services/ILlmChatMessageFactory.ts`
- `src/services/clients/chat/discord/ollama/DiscordLlmChatMessageFactory.ts`

**Files modified:**
- `src/services/IBotServiceContainer.ts`
- `src/services/BotServiceContainer.ts`
- `src/services/clients/chat/discord/ollama/DiscordOllamaContextMessageFactory.ts`

### Phase 5: Input/Output Filter Split

1. Rename `IChatMessageFilter` → `IOutputChatMessageFilter` (file rename + interface
   rename).
2. Update all 5 existing filter implementations' `implements` clauses:
   - `DiscordCodeBlockExtractFilter`
   - `DiscordMarkdownTableFilter`
   - `DiscordMessageSplitFilter`
   - `DiscordCodeBlockSplitFilter`
   - `DiscordAttachmentFilter`
3. Rename `IBotServiceContainer.getChatMessageFilters()` →
   `getOutputChatMessageFilters()`.
4. Rename `BotServiceContainer.getChatMessageFilters()` →
   `getOutputChatMessageFilters()`.
5. Update `OllamaReplyService` and `OllamaStreamingReplyService` field types and
   constructor calls.
6. Create `IInputChatMessageFilter` interface:
   ```typescript
   export interface IInputChatMessageFilter {
       process(llmChatMessage: LlmChatMessage, context: OllamaMessage[]):
           Promise<OllamaMessage[]>;
   }
   ```
7. Add `getInputChatMessageFilters(): IInputChatMessageFilter[]` to
   `IBotServiceContainer`.

**Files created:**
- `src/services/clients/chat/IInputChatMessageFilter.ts`

**Files modified:**
- `src/services/clients/chat/IChatMessageFilter.ts` →
  `IOutputChatMessageFilter.ts` (rename)
- All 5 filter implementation files
- `src/services/IBotServiceContainer.ts`
- `src/services/BotServiceContainer.ts`
- `src/services/clients/chat/discord/ollama/OllamaReplyService.ts`
- `src/services/clients/chat/discord/ollama/OllamaStreamingReplyService.ts`

### Phase 6: Database Layer

1. Create Drizzle schema (`schema.ts`) with relational tables:
   - `UserConsent` — `userId` (PK), `consentedAt` (timestamp),
     `backfillCompleted` (boolean, default false)
   - `LlmChatMessage` — `id` (auto-increment PK), `userId`, `serverId`,
     `content` (JSON-serialized LlmChatMessage), `messageText` (just the message
     field), `isBot`, `embeddingModel` (model name used to generate the vector),
     `discordMessageId` (nullable, unique partial index for deduplication),
     `createdAt`
2. Create `MemoryDatabase` class:
    - Opens `better-sqlite3` at `workflows/{botId}/txt2txt/memory.db` (creates
      dir via `fs.mkdirSync(dir, { recursive: true })`)
   - Loads `sqlite-vec` extension
   - Initializes Drizzle: `drizzle(db)`
   - Creates tables (`CREATE TABLE IF NOT EXISTS`)
   - Creates vec0 virtual table for vector ops
    - Methods: `hasConsent`, `setConsent`, `removeConsent` (also deletes all
      memories), `storeMemory`, `queryMemories` (raw SQL join between vec0
      results and relational table, filtered by `serverId` AND
      `embeddingModel`), `deleteMemoriesByUser`, `getMemoryCountByModel`,
      `getTotalMemoryCount`, `getMemoriesByModel`, `updateMemoryEmbeddingModel`
      (for migration), `close`

**Files created:**
- `src/services/clients/llm/memory/schema.ts`
- `src/services/clients/llm/memory/MemoryDatabase.ts`

### Phase 7: Memory Service

1. Create `IMemoryService` interface:
   ```typescript
   export interface IMemoryService {
       isEnabled: boolean;
       hasConsent(userId: string): Promise<boolean>;
       setConsent(userId: string): Promise<void>;
       removeConsent(userId: string): Promise<void>;
       store(llmChatMessage: LlmChatMessage, ownerUserId?: string): Promise<void>;
       retrieve(llmChatMessage: LlmChatMessage): Promise<OllamaMessage[]>;
   }
   ```
2. Create `MemoryService` implementation:
   - `isEnabled` — checks `featureService.hasFeature(LongTermMemory)`
   - `hasConsent/setConsent/removeConsent` — delegate to `MemoryDatabase`
   - `store` — check enabled + consent, generate embedding via `OllamaClient
     .embed(message)`, call `MemoryDatabase.storeMemory`
   - `retrieve` — check enabled, generate embedding, query
     `MemoryDatabase.queryMemories(embedding, serverId, topK)`, map results to
     `OllamaMessage[]` with `OllamaRole.System` (single concatenated system
     message wrapping all retrieved memories)
3. Wire into `BotServiceContainer` as a lazy singleton (chat mode only).
4. Add `getMemoryService(): IMemoryService` to `IBotServiceContainer`.

**Files created:**
- `src/services/clients/llm/services/IMemoryService.ts`
- `src/services/clients/llm/memory/MemoryService.ts`

**Files modified:**
- `src/services/IBotServiceContainer.ts`
- `src/services/BotServiceContainer.ts`

### Phase 8: Memory Input Filter

1. Create `DiscordMemoryInputFilter implements IInputChatMessageFilter`:
   - Constructor receives `IMemoryService` via `services.getMemoryService()`
   - `process(llmChatMessage, context)` — calls `memoryService.retrieve`,
     prepends memories (system role) to context, returns augmented array
2. Register in `BotServiceContainer.getInputChatMessageFilters()`:
   - Returns `[new DiscordMemoryInputFilter(this)]` when LTM feature is present
   - Returns `[]` when LTM is disabled

**Files created:**
- `src/services/clients/chat/discord/filters/DiscordMemoryInputFilter.ts`

**Files modified:**
- `src/services/BotServiceContainer.ts`

### Phase 9: OllamaMessageTask Integration

1. Add `#inputFilters` and `#llmChatMessageFactory` and `#memoryService` to
   `OllamaMessageTask` via `this.#services`.
2. In `process()`:
   - Replace `formatChatMessage` call with `llmChatMessageFactory.create()` +
     `JSON.stringify()`
   - After fetching rolling context, run input filters:
     `for (filter of inputFilters) { context = await filter.process(llmChatMessage,
     context); }`
   - After LLM response + `contextService.addContext`, store memories:
     `memoryService.store(llmChatMessage)` (user) and
     `memoryService.store(botResponseLlmChatMessage)` (bot response via
     `createFromLlmResponse`). Non-fatal on error (log + continue).
3. In `#processAsStream`: same pattern — input filters before
   `sendMessageAndGetStream`, memory storage after `response.done`.

**Files modified:**
- `src/services/clients/llm/ollama/tasks/OllamaMessageTask.ts`

### Phase 10: Slash Commands

1. Create `MemorySlashCommand.ts` with `SlashCommandBuilder` — `memory` parent,
   `remember` and `forget` subcommands.
2. In `BaseDiscordClient.onClientReady` — register slash commands globally via
   `REST.put(Routes.applicationCommands(clientId), ...)` when chat mode + LTM
   feature is active.
3. In `GenerativeChatClient.#onInteraction` — widen type to
   `ButtonInteraction | ChatInputCommandInteraction`, add type guard
   `interaction.isChatInputCommand()`, delegate to `#handleSlashCommand`.
4. `#handleSlashCommand` — `deferReply({ ephemeral: true })`, switch on
   subcommand, call `memoryService.setConsent/removeConsent`, `editReply` with
   confirmation.

**Files created:**
- `src/services/clients/chat/discord/commands/MemorySlashCommand.ts`

**Files modified:**
- `src/services/clients/chat/discord/BaseDiscordClient.ts`
- `src/services/clients/chat/discord/GenerativeChatClient.ts`

### Phase 11: Passive Listening

1. In `GenerativeChatClient.#onMessageCreate`, after the `shouldReply` filter:
   - If `featureService.hasFeature(LongTermMemory)` AND
     `memoryService.isEnabled` AND `memoryService.hasConsent(author.id)`:
   - Create `LlmChatMessage` via `llmChatMessageFactory.create(message)`
   - Fire-and-forget `memoryService.store(llmChatMessage)` (errors logged, not
     fatal)

**Files modified:**
- `src/services/clients/chat/discord/GenerativeChatClient.ts`

### Phase 12: Testing

Co-located `*.test.ts` files for each new module:
- `MemoryDatabase.test.ts` — consent CRUD, memory storage, vector query
- `MemoryService.test.ts` — enabled/disabled paths, consent gating, store/retrieve
- `DiscordLlmChatMessageFactory.test.ts` — message mapping, bot response mapping
- `DiscordMemoryInputFilter.test.ts` — context augmentation, empty memories
- `OllamaClient.test.ts` — add embed tests (mock `client.embed`)

Update existing tests for renamed filter interface.

### Execution Order

Each phase is independently testable. Lint + build after each phase:

1. Deps + config (Phase 1)
2. Feature detection (Phase 2)
3. OllamaClient.embed (Phase 3)
4. LlmChatMessage factory (Phase 4)
5. Filter rename + input filter interface (Phase 5)
6. Database layer (Phase 6)
7. Memory service (Phase 7)
8. Memory input filter (Phase 8)
9. OllamaMessageTask integration (Phase 9)
10. Slash commands (Phase 10)
11. Passive listening (Phase 11)
12. Tests (Phase 12)

## Risks

1. **Native module packaging**: `better-sqlite3` is a native addon that
   `@yao-pkg/pkg` may not bundle cleanly into standalone binaries.
   - **Mitigation**: Docker path (Node 24 direct) works without issue. Defer pkg
     binary compatibility to a follow-up if needed. Add `better-sqlite3` native
     assets to `pkg.assets` array.

2. **Database growth**: No automatic pruning strategy. The SQLite file grows
   unbounded with usage.
   - **Mitigation**: Document manual cleanup. Add pruning strategy in a future
     iteration (see Future Considerations).

3. **Embedding latency**: Each message storage and retrieval requires an Ollama
   embedding API call, adding network latency.
   - **Mitigation**: Passive storage is fire-and-forget (non-blocking).
     Retrieval latency is bounded by one embedding call + one SQLite query.

4. **Breaking filter rename**: `IChatMessageFilter` → `IOutputChatMessageFilter`
   touches many files.
   - **Mitigation**: Mechanical rename, easily verified by lint + build. No
     behavioral change.

5. **sqlite-vec extension loading**: The extension must be available at runtime.
   In Docker and direct-Node execution, this is straightforward. In pkg
   binaries, native extension loading may fail.
   - **Mitigation**: Same as Risk 1 — defer pkg compatibility.

6. **sqlite-vec `rowid` parameter binding**: `better-sqlite3` binds JS numbers
   to sqlite-vec's `rowid` parameter in a way sqlite-vec rejects (`Only
   integers are allowed for primary key values`). Additionally, sqlite-vec
   errors when both `k = ?` and `LIMIT ?` are present in the same query.
   - **Mitigation**: Use `INSERT INTO ... VALUES ((SELECT last_insert_rowid()),
     ?)` (SQL subquery) instead of `?` parameter binding for rowid. Use only
     `k = ?` (not `LIMIT`) for KNN constraint.

7. **Cross-server consent vs. retrieval scope mismatch**: Consent is global but
   retrieval is per-server. A user opted in to one server has their messages
   stored globally but only retrieved within the same server.
   - **Mitigation**: This is by design. Document clearly. A user's messages in
     Server A are never retrieved in Server B.

## Future Considerations

- **Memory pruning**: Add a TTL or max-records-per-user limit. Implement a
  periodic cleanup or a `/memory purge` admin command.
- **Memory importance scoring**: Weight memories by recency, frequency of
  retrieval, or explicit user "remember this" commands.
- **Cross-server retrieval**: Optionally retrieve memories across servers for a
  user who consents to global recall.
- **Conversation summarization**: Compress older memories into summaries to
  reduce context token usage.
- **Embedding model hot-swap**: Support changing `embeddingModel` at runtime
  with automatic re-embedding of stored memories. *(Implemented: see Decision
  18 — auto-migration runs on startup when model mismatch is detected.)*
- **pkg binary support**: Add `better-sqlite3` and `sqlite-vec` native assets to
  `pkg.assets` for standalone binary distribution.
- **Memory export/import**: `/memory export` command to download stored memories
  as JSON; `/memory import` to restore.
- **Additional input filters**: The `IInputChatMessageFilter` interface opens the
  door for other pre-LLM filters (e.g., prompt safety filtering, context window
  management, topic detection).
- **Telegram/Slack backend support**: The `ILlmChatMessageFactory` abstraction
  enables future chat backends to integrate with the same memory and filter
  infrastructure.

## Success Criteria

- [ ] Bots without `ollama.embeddingModel` behave exactly as before (zero
      overhead, no memory storage or retrieval).
- [ ] Bots with `ollama.embeddingModel` store user messages (when opted in) and
      bot responses to the SQLite vector store.
- [ ] Retrieved memories are injected as system-role context before the LLM call.
- [ ] `/memory remember` opts a user in globally; `/memory forget` opts out and
      deletes all their memories.
- [ ] Memories are retrieved from all opted-in users within the same server.
- [ ] `IChatMessageFilter` is renamed to `IOutputChatMessageFilter`; existing
      output filters continue to function identically.
- [ ] `IInputChatMessageFilter` interface exists and the memory filter
      implements it.
- [ ] `ILlmChatMessageFactory` abstraction decouples `LlmChatMessage` creation
      from Discord-specific logic.
- [ ] `SupportedFeature.LongTermMemory` is detectable via `featureService
      .hasFeature`.
- [ ] Passive listening stores messages even when the bot doesn't reply.
- [ ] All existing tests pass; new tests cover memory service, database, factory,
      and input filter.
- [ ] `npm run lint` and `npm run build` pass clean.

## Related

- ADR 001: Multi-Instance Support via Container Hierarchy (DI architecture)
- ADR 003: Drop .env Support — Single Configuration Format (config system)
- `LlmChatMessage` interface
  (`src/services/clients/llm/ollama/models/LlmChatMessage.ts`)
- `IContextMessageFactory` interface
  (`src/services/clients/llm/services/IContextMessageFactory.ts`)
- `FeatureService` (`src/services/features/FeatureService.ts`)
- `OllamaClient` (`src/services/clients/llm/ollama/OllamaClient.ts`)
- `OllamaMessageTask`
  (`src/services/clients/llm/ollama/tasks/OllamaMessageTask.ts`)
- `BotServiceContainer` (`src/services/BotServiceContainer.ts`)