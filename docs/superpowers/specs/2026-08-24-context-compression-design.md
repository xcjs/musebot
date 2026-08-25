# Context Compression for Chat Mode

**Date:** 2026-08-24
**Status:** Approved (pending spec review)
**Scope:** Chat mode only (`BotFunction.chat`)

## Problem

`ContextService` holds an unbounded in-memory array of conversation messages per
channel. As a conversation grows, the token count sent to Ollama eventually exceeds
the model's context window, causing truncated prompts, degraded output, or request
errors. There is no mechanism to shrink the context while preserving conversational
continuity.

## Solution

Add an LLM-summarization-based context compression service that, when the estimated
token count of a channel's context exceeds a configurable threshold of the model's
context window, replaces the conversation messages with a single summary message.
System prompt and channel-topic messages (`isReadOnly`) are preserved. A manual
"Compress Context" Discord button lets users trigger compression on demand.

## Architecture

### New service: `ContextCompressionService`

Registered as a **lazy singleton** in `BotServiceContainer` (same pattern as
`ContextService`, `MemoryService`). Depends on `IContextService`, `OllamaClient`,
`IContextMessageFactory`, `IConfigurationService` — all accessed via
`IBotServiceContainer`.

**Interface** (`IContextCompressionService`):

```ts
export interface IContextCompressionService {
  compressIfNeeded(channelId: string): Promise<void>;
  compressNow(channelId: string): Promise<void>;
}
```

- `compressIfNeeded` — automatic path: tokenizes, compares to threshold, only
  summarizes if over threshold. Called by `OllamaMessageTask` after `addContext`.
- `compressNow` — manual path: always summarizes + replaces (bypasses threshold).
  Called by `GenerativeChatClient` when user clicks the Compress Context button.

Both share internal `#summarizeAndReplace(channelId)` logic.

### Data flow

```
OllamaMessageTask.process()
  → existing addContext (user msg + LLM msg)
  → contextCompressionService.compressIfNeeded(channelId)
      → tokenize all conversation messages (POST /api/tokenize, direct fetch)
      → if tokens <= window * threshold → no-op
      → else summarizeAndReplace:
           1. getConversationMessages(channelId)  // non-isReadOnly
           2. partition: conversation msgs + old summary (if any)
           3. summarize via OllamaClient.sendMessage (old summary folded in as context)
           4. contextMessageFactory.fromSummary(summaryText, channelId)
           5. contextService.replaceChannelContext(channelId, [summaryMessage])
```

Manual path (`compressNow`) skips the tokenize/threshold check and goes straight to
`summarizeAndReplace`.

### Tokenization

Direct `fetch` to the first `ollamaHosts` entry + `/api/tokenize` (the `ollama` npm
package does not expose this endpoint):

```
POST /api/tokenize  { model: string, text: string }
→ { tokens: string[] }   // length = token count
```

All conversation messages are serialized to text and concatenated with newlines into
a single tokenize request to minimize round-trips. The model name comes from
`OllamaClient`'s selected model.

### Context window resolution

1. If `ollamaContextWindow` config is set → use it.
2. Else call `OllamaClient.show()` and find the `*.context_length` key in
   `model_info` (key name varies by architecture: `gemma4.context_length`,
   `qwen35.context_length`, `llama.context_length`, `glm4moelite.context_length`,
   etc. — match on suffix `.context_length`).
3. If `show()` fails → fall back to hardcoded 4096 (Ollama's default) and log warning.

### Summarization prompt

A fixed system prompt instructs the LLM to summarize the conversation concisely. The
messages to summarize are passed as conversation context. If an old summary exists,
it is included as a leading system message so the new summary builds on it rather
than discarding older context. The summarization call uses the **same model** as
chat (no separate config — YAGNI).

If the total tokens of the summarization input (system prompt + old summary + all
conversation messages) exceeds the context window, the **oldest conversation
messages are truncated** until the input fits. The old summary (if any) is always
preserved — only conversation messages are dropped, from the front. This ensures
the summarization call itself never overflows the context window.

## Data Model Changes

### `ContextMessage` — add `isSummary`

```ts
isSummary: boolean  // true only for generated compression summaries
```

- Default `false` on all existing factory methods (`fromSystemPrompt`,
  `fromChatMessage`, `fromLlmMessage`, `fromChatPrompt`).
- New `fromSummary()` factory method sets it `true`.
- `isSummary` messages are **not** `isReadOnly` — they are conversation-scoped and
  are removed by `clearContext` (Clear Context button wipes summaries along with
  conversation; only the system prompt survives).

### `ContextService` new methods

```ts
getConversationMessages(channelId: string): ContextMessage[];
// Returns !isReadOnly && !isPrivate && channelId === id (includes summaries).
// !isPrivate matches getContextByChannelId's filter — private (DM) messages
// are never sent to the LLM, so they're excluded from compression too.

replaceChannelContext(channelId: string, newMessages: ContextMessage[]): void;
// Removes all !isReadOnly && !isPrivate messages for the channel, then pushes newMessages.
```

`clearContext` behavior unchanged (already keeps only `isReadOnly`; summaries are
`!isReadOnly` so they're removed).

## Config Changes

### `IBotConfig.ollama`

```ts
contextWindow?: number;                 // optional; unset → query show()
contextCompressionThreshold?: number;    // optional; default 0.75
```

### `IConfigurationService` getters

```ts
get ollamaContextWindow(): number | null;   // config value or null (→ query show())
get ollamaContextCompressionThreshold(): number;  // ?? 0.75
```

## Discord UI — Manual Compress Context Button

### `BotInteraction` enum additions

```ts
CompressContext = 'compressContext',
CompressContextCancel = 'compressContextCancel',
CompressContextConfirm = 'compressContextConfirm',
```

### New components

- `CompressContextButton` — label `🗜️`, title "Compress Context",
  `isSupported` gates on `SupportedFeature.Txt2Txt`. Added to `ChatActionRow`
  alongside `ClearContextButton` + `HelpButton`.
- `CompressContextConfirmButton` + `CompressContextCancelButton` → in a new
  `ChatConfirmCompressActionRow` (mirrors `ChatConfirmClearActionRow`).

### `GenerativeChatClient` handler

Three new cases in `#onButtonInteraction` switch:

- `CompressContext` → `#compressContextAskConfirmation(interaction)` — tokenizes
  current conversation, replies with confirmation message:
  `Compress N messages (~M tokens)?` plus the confirm/cancel action row.
- `CompressContextConfirm` → calls
  `contextCompressionService.compressNow(channelId)`, then edits reply
  ("Context compressed — N messages summarized into 1.") and deletes the
  confirmation message.
- `CompressContextCancel` → deletes reply (same as `#clearContextCancel`).

## Files to Create / Modify

### New files

| File | Purpose |
|------|---------|
| `src/services/clients/llm/services/IContextCompressionService.ts` | Interface |
| `src/services/clients/llm/services/ContextCompressionService.ts` | Implementation |
| `src/services/clients/llm/services/ContextCompressionService.test.ts` | Unit tests |
| `src/services/clients/chat/discord/components/buttons/text/CompressContextButton.ts` | Discord button |
| `src/services/clients/chat/discord/components/buttons/text/CompressContextConfirmButton.ts` | Confirm button |
| `src/services/clients/chat/discord/components/buttons/text/CompressContextCancelButton.ts` | Cancel button |
| `src/services/clients/chat/discord/components/buttonRows/ChatConfirmCompressActionRow.ts` | Confirm/cancel row |

### Modified files

| File | Change |
|------|--------|
| `src/enums/BotInteraction.ts` | Add `CompressContext`, `CompressContextCancel`, `CompressContextConfirm` |
| `src/services/clients/llm/ollama/models/ContextMessage.ts` | Add `isSummary: boolean` |
| `src/services/clients/llm/services/IContextService.ts` | Add `getConversationMessages`, `replaceChannelContext` |
| `src/services/clients/llm/services/ContextService.ts` | Implement new methods |
| `src/services/clients/llm/services/IContextMessageFactory.ts` | Add `fromSummary()` |
| `src/services/clients/chat/discord/components/.../DiscordOllamaContextMessageFactory.ts` | Implement `fromSummary()`; set `isSummary: false` on existing |
| `src/services/environment-settings/IConfigurationService.ts` | Add `ollamaContextWindow`, `ollamaContextCompressionThreshold` |
| `src/services/environment-settings/ConfigurationService.ts` | Implement getters |
| `src/models/IBotConfig.ts` | Add `contextWindow?`, `contextCompressionThreshold?` |
| `src/services/IBotServiceContainer.ts` | Add `contextCompressionService` getter |
| `src/services/BotServiceContainer.ts` | Register lazy singleton + factory |
| `src/services/clients/llm/ollama/tasks/OllamaMessageTask.ts` | Call `compressIfNeeded` after `addContext` |
| `src/services/clients/chat/discord/components/buttonRows/ChatActionRow.ts` | Add `CompressContextButton` |
| `src/services/clients/chat/discord/GenerativeChatClient.ts` | Handle `CompressContext*` interactions |

## Error Handling

| Failure                              | Behavior                                      |
| ------------------------------------ | --------------------------------------------- |
| Tokenize request fails               | Log error, no-op (chat continues unaffected)  |
| Summarize (LLM) call fails           | Log error, no-op, context left as-is          |
| `show()` fails & no config window    | Log warning, fall back to 4096                 |
| Manual compress with empty context  | Log info, reply "nothing to compress"          |

All compression is best-effort — it never breaks chat.

## Testing

- **`ContextCompressionService.test.ts`** — mock `IContextService`,
  `OllamaClient`, `IContextMessageFactory`. Cases: under threshold (no-op),
  over threshold (summarizes + replaces), `compressNow` (always summarizes),
  old summary folded in, tokenize failure (no-op + log), summarize failure
  (no-op + log), config window vs `show()` fallback.
- **`ContextService.test.ts`** — add tests for `getConversationMessages` and
  `replaceChannelContext`.
- Existing tests run via `npm test` to confirm no regressions.
- Lint via `npm run lint`.

No integration test for the Discord button flow (matches existing pattern — no
button interaction tests exist in the repo).