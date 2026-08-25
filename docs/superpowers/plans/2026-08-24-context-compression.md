# Context Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LLM-summarization-based context compression to chat mode so conversations don't exceed the model's context window.

**Architecture:** A new `ContextCompressionService` lazy singleton tokenizes channel context via Ollama's `/api/tokenize` endpoint, and when token count exceeds a configurable threshold of the context window, summarizes conversation messages into a single replacement message. A manual "Compress Context" Discord button triggers compression on demand. System prompt and channel-topic messages are preserved.

**Tech Stack:** TypeScript (ES2022, ESNext modules), Node.js, discord.js, ollama npm package, Jest 30, ESLint 9.

## Global Constraints

- Imports use `.js` extensions (ESM convention).
- Private class fields use `#` prefix.
- Explicit return types required on all functions (`@typescript-eslint/explicit-function-return-type: error`).
- No floating promises (`@typescript-eslint/no-floating-promises: error`).
- Imports sorted via `eslint-plugin-simple-import-sort`.
- Tests co-located as `*.test.ts`, run via `npm test`.
- Lint via `npm run lint`.
- All compression is best-effort — never breaks chat.
- `ContextMessage` is generic: `ContextMessage<ChatMessageType, LlmMessageType>`.
- `OllamaMessage` (from `ollama` npm package) has `role: string` and `content: string`.
- `OllamaRole` enum: `User='user'`, `System='system'`, `Assistant='assistant'`.

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `src/services/clients/llm/services/IContextCompressionService.ts` | Interface for the compression service |
| `src/services/clients/llm/services/ContextCompressionService.ts` | Implementation: tokenize, threshold check, summarize, replace |
| `src/services/clients/llm/services/ContextCompressionService.test.ts` | Unit tests |
| `src/services/clients/chat/discord/components/buttons/text/CompressContextButton.ts` | Discord button (🗜️) |
| `src/services/clients/chat/discord/components/buttons/text/CompressContextConfirmButton.ts` | Confirm button (✅) |
| `src/services/clients/chat/discord/components/buttons/text/CompressContextCancelButton.ts` | Cancel button (🔙) |
| `src/services/clients/chat/discord/components/buttonRows/ChatConfirmCompressActionRow.ts` | Confirm/cancel action row |

### Modified files

| File | Change |
|------|--------|
| `src/enums/BotInteraction.ts` | Add 3 enum values |
| `src/services/clients/llm/ollama/models/ContextMessage.ts` | Add `isSummary: boolean` field |
| `src/services/clients/llm/services/IContextService.ts` | Add 2 method signatures |
| `src/services/clients/llm/services/ContextService.ts` | Implement 2 new methods |
| `src/services/clients/llm/services/IContextMessageFactory.ts` | Add `fromSummary()` signature |
| `src/services/clients/chat/discord/ollama/DiscordOllamaContextMessageFactory.ts` | Implement `fromSummary()`; set `isSummary: false` on existing |
| `src/services/environment-settings/IConfigurationService.ts` | Add 2 getters |
| `src/services/environment-settings/ConfigurationService.ts` | Implement 2 getters |
| `src/services/environment-settings/IBotConfig.ts` | Add 2 optional fields |
| `src/services/IBotServiceContainer.ts` | Add `getContextCompressionService` factory |
| `src/services/BotServiceContainer.ts` | Register lazy singleton |
| `src/services/clients/llm/ollama/tasks/OllamaMessageTask.ts` | Call `compressIfNeeded` after `addContext` |
| `src/services/clients/chat/discord/components/buttonRows/ChatActionRow.ts` | Add `CompressContextButton` |
| `src/services/clients/chat/discord/GenerativeChatClient.ts` | Handle 3 new interaction cases |

---

## Task 1: Add `isSummary` to `ContextMessage`

**Files:**
- Modify: `src/services/clients/llm/ollama/models/ContextMessage.ts`

**Interfaces:**
- Produces: `ContextMessage<ChatMessageType, LlmMessageType>` now has `isSummary: boolean` field. All later tasks that create `ContextMessage` instances must set this field.

- [ ] **Step 1: Add the field to the interface**

Replace the entire file content:

```ts
export interface ContextMessage<ChatMessageType, LlmMessageType> {
  messageId: string | null;
  associatedMessageId: string | null;
  userId: string | null;
  associatedUserId: string | null;
  channelId: string | null;
  serverId: string | null;
  timestamp: Date;
  chatMessage: ChatMessageType | null;
  llmMessage: LlmMessageType;
  isReadOnly: boolean;
  isPrivate: boolean;
  isSummary: boolean;
}
```

- [ ] **Step 2: Verify build compiles (will fail — existing factories don't set `isSummary` yet)**

Run: `npx tsc --noEmit`
Expected: Errors in `DiscordOllamaContextMessageFactory.ts` — missing `isSummary` property. This is expected; Task 2 fixes it.

- [ ] **Step 3: Commit**

```bash
git add src/services/clients/llm/ollama/models/ContextMessage.ts
git commit -m "feat: add isSummary field to ContextMessage interface"
```

---

## Task 2: Update `IContextMessageFactory` and `DiscordOllamaContextMessageFactory` — set `isSummary: false` on existing methods, add `fromSummary()`

**Files:**
- Modify: `src/services/clients/llm/services/IContextMessageFactory.ts`
- Modify: `src/services/clients/chat/discord/ollama/DiscordOllamaContextMessageFactory.ts`

**Interfaces:**
- Consumes: `ContextMessage` with `isSummary: boolean` (from Task 1)
- Produces: `IContextMessageFactory` has `fromSummary(summary: string, channelId: string | null): ContextMessage<ChatMessageType, LlmMessageType>`. All existing factory methods now return objects with `isSummary: false`.

- [ ] **Step 1: Add `fromSummary` to the interface**

Open `src/services/clients/llm/services/IContextMessageFactory.ts` and add this method to the interface, after `fromLlmMessage`:

```ts
  fromSummary(summary: string, channelId: string | null): ContextMessage<ChatMessageType, LlmMessageType>;
```

`ContextMessage` is already imported in this file — no new import needed.

- [ ] **Step 2: Add `isSummary: false` to all existing factory return objects in `DiscordOllamaContextMessageFactory.ts`**

Open `src/services/clients/chat/discord/ollama/DiscordOllamaContextMessageFactory.ts`. In every method that returns a `ContextMessage` object literal (`fromSystemPrompt`, `formatChatMessage`, `fromChatMessage`, `fromChatPrompt`, `fromLlmMessage`), add `isSummary: false,` to the returned object. Place it after `isPrivate: ...`.

For example, in `fromSystemPrompt`, the return object should now include:

```ts
    isReadOnly: isReadOnly,
    isPrivate: false,
    isSummary: false
```

Apply the same `isSummary: false` addition to all five existing methods. Adjust the last property before `isSummary` to have a trailing comma if needed.

- [ ] **Step 3: Implement `fromSummary()` in `DiscordOllamaContextMessageFactory.ts`**

Add this method to the class (after `fromLlmMessage`):

```ts
  fromSummary(summary: string, channelId: string | null): ContextMessage<DiscordMessage, OllamaMessage> {
    const llmMessage: OllamaMessage = {
      role: OllamaRole.System,
      content: summary
    };

    return {
      messageId: null,
      associatedMessageId: null,
      userId: null,
      associatedUserId: null,
      channelId: channelId,
      serverId: null,
      timestamp: new Date(),
      chatMessage: null,
      llmMessage: llmMessage,
      isReadOnly: false,
      isPrivate: false,
      isSummary: true
    };
  }
```

Ensure `OllamaRole` is imported (it should already be imported in this file).

Note: `fromChatMessage` and `fromSystemPrompt` currently omit some `null` fields (`associatedMessageId`, `associatedUserId`) and use `as ContextMessage<...>` casts. Add `isSummary: false` to the object literals wherever they're constructed. For `fromChatMessage`, the cast `as ContextMessage<DiscordMessage, OllamaMessage>` at line 58 stays — just add `isSummary: false` before the closing brace of the object literal.

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
git add src/services/clients/llm/services/IContextMessageFactory.ts src/services/clients/chat/discord/components/context-message-factories/DiscordOllamaContextMessageFactory.ts
git commit -m "feat: add fromSummary factory method, set isSummary:false on existing"
```

---

## Task 3: Add config settings — `ollamaContextWindow` and `ollamaContextCompressionThreshold`

**Files:**
- Modify: `src/services/environment-settings/IBotConfig.ts`
- Modify: `src/services/environment-settings/IConfigurationService.ts`
- Modify: `src/services/environment-settings/ConfigurationService.ts`

**Interfaces:**
- Produces: `IConfigurationService.ollamaContextWindow: number | null` (null = query show()), `IConfigurationService.ollamaContextCompressionThreshold: number` (default 0.75).

- [ ] **Step 1: Add fields to `IBotConfig.ollama`**

Open `src/services/environment-settings/IBotConfig.ts`. Find the `ollama` property inside `IBotConfig` (line 28-35). Add two optional fields after `topK?: number;`:

```ts
    contextWindow?: number;
    contextCompressionThreshold?: number;
```

Add them after the existing `topK?: number;` field (or after whichever is the last field in the `ollama` object — match the existing indentation).

- [ ] **Step 2: Add getters to `IConfigurationService`**

Open `src/services/environment-settings/IConfigurationService.ts`. Add these two getters to the interface:

```ts
  get ollamaContextWindow(): number | null;
  get ollamaContextCompressionThreshold(): number;
```

- [ ] **Step 3: Implement getters in `ConfigurationService`**

Open `src/services/environment-settings/ConfigurationService.ts`. Add these two getters to the class (place them near the other `ollama*` getters):

```ts
  get ollamaContextWindow(): number | null {
    return this.#botConfig.ollama?.contextWindow ?? null;
  }

  get ollamaContextCompressionThreshold(): number {
    return this.#botConfig.ollama?.contextCompressionThreshold ?? 0.75;
  }
```

- [ ] **Step 4: Add logging to `#logConfiguration`**

In the same `ConfigurationService.ts` file, find the `#logConfiguration()` method (line 200). Add log lines for the new settings after the existing `ollama.topK` log line (line 230), matching the `this.#log.info(...)` pattern:

```ts
    this.#log.info(`bots[].ollama.contextWindow: ${this.ollamaContextWindow ?? '(not set)'}`);
    this.#log.info(`bots[].ollama.contextCompressionThreshold: ${this.ollamaContextCompressionThreshold}`);
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add src/models/IBotConfig.ts src/services/environment-settings/IConfigurationService.ts src/services/environment-settings/ConfigurationService.ts
git commit -m "feat: add ollamaContextWindow and ollamaContextCompressionThreshold config"
```

---

## Task 4: Add `getConversationMessages` and `replaceChannelContext` to `ContextService`

**Files:**
- Modify: `src/services/clients/llm/services/IContextService.ts`
- Modify: `src/services/clients/llm/services/ContextService.ts`

**Interfaces:**
- Consumes: `ContextMessage` with `isSummary` (from Task 1)
- Produces: `IContextService.getConversationMessages(channelId): ContextMessage<ChatMessageType, LlmMessageType>[]` and `IContextService.replaceChannelContext(channelId, newMessages): void`.

- [ ] **Step 1: Add method signatures to the interface**

Open `src/services/clients/llm/services/IContextService.ts`. `ContextMessage` is already imported in this file. Add these two methods to the interface:

```ts
  getConversationMessages(channelId: string): ContextMessage<ChatMessageType, LlmMessageType>[];
  replaceChannelContext(channelId: string, newMessages: ContextMessage<ChatMessageType, LlmMessageType>[]): void;
```

- [ ] **Step 2: Implement `getConversationMessages` in `ContextService.ts`**

Open `src/services/clients/llm/services/ContextService.ts`. Add this method to the class (after `clearContext`):

```ts
  getConversationMessages(channelId: string): ContextMessage<ChatMessageType, LlmMessageType>[] {
    return this.#context.filter(
      (message) => !message.isReadOnly && !message.isPrivate && message.channelId === channelId
    );
  }
```

- [ ] **Step 3: Implement `replaceChannelContext` in `ContextService.ts`**

Add this method to the class (after `getConversationMessages`):

```ts
  replaceChannelContext(channelId: string, newMessages: ContextMessage<ChatMessageType, LlmMessageType>[]): void {
    this.#context = this.#context.filter(
      (message) => message.isReadOnly || message.isPrivate || message.channelId !== channelId
    );

    for (const message of newMessages) {
      this.#context.push(message);
    }

    this.logger.info(`Replaced context for channel ${channelId} with ${newMessages.length} message(s).`);
  }
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
git add src/services/clients/llm/services/IContextService.ts src/services/clients/llm/services/ContextService.ts
git commit -m "feat: add getConversationMessages and replaceChannelContext to ContextService"
```

---

## Task 5: Create `IContextCompressionService` interface

**Files:**
- Create: `src/services/clients/llm/services/IContextCompressionService.ts`

**Interfaces:**
- Produces: `IContextCompressionService` with `compressIfNeeded(channelId): Promise<void>` and `compressNow(channelId): Promise<void>`.

- [ ] **Step 1: Create the interface file**

Create `src/services/clients/llm/services/IContextCompressionService.ts`:

```ts
export interface IContextCompressionService {
  compressIfNeeded(channelId: string): Promise<void>;
  compressNow(channelId: string): Promise<void>;
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/clients/llm/services/IContextCompressionService.ts
git commit -m "feat: add IContextCompressionService interface"
```

---

## Task 6: Create `ContextCompressionService` implementation

**Files:**
- Create: `src/services/clients/llm/services/ContextCompressionService.ts`

**Interfaces:**
- Consumes: `IBotServiceContainer` (for `getContextService`, `ollamaClient`, `getContextMessageFactory`, `configurationService`, `getLogger`), `IContextService.getConversationMessages` / `replaceChannelContext` (Task 4), `IContextMessageFactory.fromSummary` (Task 2), `IConfigurationService.ollamaContextWindow` / `ollamaContextCompressionThreshold` (Task 3), `OllamaClient.show()` / `sendMessage()`.
- Produces: `ContextCompressionService` class implementing `IContextCompressionService`.

- [ ] **Step 1: Create the implementation file**

Create `src/services/clients/llm/services/ContextCompressionService.ts`:

```ts
import { Message as OllamaMessage } from 'ollama';

import { IConfigurationService } from '../../../environment-settings/IConfigurationService.js';
import { ILogger } from '../../../ILogger.js';
import { IBotServiceContainer } from '../../../IBotServiceContainer.js';
import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { OllamaRole } from '../ollama/enums/OllamaRole.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { IContextMessageFactory } from './IContextMessageFactory.js';
import { IContextCompressionService } from './IContextCompressionService.js';
import { IContextService } from './IContextService.js';

const SUMMARIZATION_SYSTEM_PROMPT: string =
  'You are a conversation summarizer. Summarize the following conversation concisely, '
  + 'preserving key facts, decisions, context, and the flow of discussion. '
  + 'Write your summary as a coherent narrative that captures the essential information. '
  + 'Do not add any commentary — output only the summary.';

const FALLBACK_CONTEXT_WINDOW: number = 4096;

export class ContextCompressionService<ChatMessageType, LlmMessageType> implements IContextCompressionService {
  readonly #services: IBotServiceContainer;
  readonly #logger: ILogger;

  constructor(services: IBotServiceContainer) {
    this.#services = services;
    this.#logger = services.getLogger('ContextCompressionService');
  }

  async compressIfNeeded(channelId: string): Promise<void> {
    try {
      const contextWindow: number = await this.#resolveContextWindow();
      const threshold: number = this.#configurationService.ollamaContextCompressionThreshold;
      const limit: number = Math.floor(contextWindow * threshold);

      const messages: ContextMessage<ChatMessageType, LlmMessageType>[] =
        this.#contextService.getConversationMessages(channelId);

      if (messages.length === 0) {
        return;
      }

      const text: string = this.#serializeMessages(messages);
      const tokenCount: number = await this.#tokenize(text);

      this.#logger.info(`Channel ${channelId}: ${tokenCount} tokens / ${limit} limit (window ${contextWindow}, threshold ${threshold}).`);

      if (tokenCount <= limit) {
        return;
      }

      await this.#summarizeAndReplace(channelId);
    } catch (error) {
      this.#logger.error(`Failed to check/compress context for channel ${channelId}:`, error);
    }
  }

  async compressNow(channelId: string): Promise<void> {
    const messages: ContextMessage<ChatMessageType, LlmMessageType>[] =
      this.#contextService.getConversationMessages(channelId);

    if (messages.length === 0) {
      this.#logger.info(`No messages to compress for channel ${channelId}.`);
      return;
    }

    try {
      await this.#summarizeAndReplace(channelId);
    } catch (error) {
      this.#logger.error(`Failed to compress context for channel ${channelId}:`, error);
    }
  }

  async #summarizeAndReplace(channelId: string): Promise<void> {
    const messages: ContextMessage<ChatMessageType, LlmMessageType>[] =
      this.#contextService.getConversationMessages(channelId);

    if (messages.length === 0) {
      return;
    }

    const conversationMessages: ContextMessage<ChatMessageType, LlmMessageType>[] = [];
    const summaryMessages: ContextMessage<ChatMessageType, LlmMessageType>[] = [];

    for (const message of messages) {
      if (message.isSummary) {
        summaryMessages.push(message);
      } else {
        conversationMessages.push(message);
      }
    }

    const context: OllamaMessage[] = [];

    context.push({ role: OllamaRole.System, content: SUMMARIZATION_SYSTEM_PROMPT });

    for (const summary of summaryMessages) {
      context.push({
        role: OllamaRole.System,
        content: `Previous summary of earlier conversation:\n${summary.llmMessage.content}`
      });
    }

    for (const message of conversationMessages) {
      context.push({
        role: message.llmMessage.role as string,
        content: message.llmMessage.content
      });
    }

    const truncatedContext: OllamaMessage[] = await this.#truncateForContextWindow(context);

    const summaryText: string = await this.#generateSummary(truncatedContext);

    const summaryMessage: ContextMessage<ChatMessageType, LlmMessageType> =
      this.#contextMessageFactory.fromSummary(summaryText, channelId) as ContextMessage<ChatMessageType, LlmMessageType>;

    this.#contextService.replaceChannelContext(channelId, [summaryMessage]);

    this.#logger.info(`Compressed ${messages.length} message(s) into 1 summary for channel ${channelId}.`);
  }

  async #generateSummary(context: OllamaMessage[]): Promise<string> {
    const ollamaClient: OllamaClient = this.#services.ollamaClient;
    const exchange = await ollamaClient.sendMessage('Summarize the conversation above.', context);
    return exchange.exchange.response.message.content;
  }

  async #tokenize(text: string): Promise<number> {
    const configurationService: IConfigurationService = this.#configurationService;
    const host: URL = configurationService.ollamaHosts[0];
    const model: string = this.#services.ollamaClient.model;

    const response: Response = await fetch(`${host.origin}/api/tokenize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model, text: text })
    });

    if (!response.ok) {
      throw new Error(`Tokenize request failed: ${response.status} ${response.statusText}`);
    }

    const body: { tokens: string[] } = await response.json() as { tokens: string[] };
    return body.tokens.length;
  }

  #serializeMessages(messages: ContextMessage<ChatMessageType, LlmMessageType>[]): string {
    return messages
      .map((message) => `${message.llmMessage.role}: ${message.llmMessage.content}`)
      .join('\n');
  }

  async #truncateForContextWindow(context: OllamaMessage[]): Promise<OllamaMessage[]> {
    const contextWindow: number = await this.#resolveContextWindow();

    let truncated: OllamaMessage[] = [...context];
    let tokenCount: number = await this.#tokenize(this.#serializeOllamaMessages(truncated));

    while (tokenCount > contextWindow && truncated.length > 1) {
      const lastSystemIndex: number = truncated.reduce(
        (last, msg, idx) => msg.role === 'system' ? idx : last,
        -1
      );

      const oldestConversationIndex: number = truncated.findIndex(
        (_, idx) => idx > lastSystemIndex
      );

      if (oldestConversationIndex === -1) {
        break;
      }

      truncated = truncated.filter((_, idx) => idx !== oldestConversationIndex);
      tokenCount = await this.#tokenize(this.#serializeOllamaMessages(truncated));
    }

    if (truncated.length < context.length) {
      this.#logger.info(`Truncated ${context.length - truncated.length} message(s) from summarization input to fit context window (${contextWindow}).`);
    }

    return truncated;
  }

  #serializeOllamaMessages(messages: OllamaMessage[]): string {
    return messages
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n');
  }

  async #resolveContextWindow(): Promise<number> {
    const configWindow: number | null = this.#configurationService.ollamaContextWindow;

    if (configWindow !== null) {
      return configWindow;
    }

    try {
      const showResponse = await this.#services.ollamaClient.show();
      const modelInfo: Map<string, unknown> = showResponse.model_info;

      for (const [key, value] of modelInfo) {
        if (key.endsWith('.context_length')) {
          return value as number;
        }
      }

      this.#logger.warn(`No *.context_length key found in model_info; falling back to ${FALLBACK_CONTEXT_WINDOW}.`);
      return FALLBACK_CONTEXT_WINDOW;
    } catch (error) {
      this.#logger.warn(`Failed to query show() for context window; falling back to ${FALLBACK_CONTEXT_WINDOW}:`, error);
      return FALLBACK_CONTEXT_WINDOW;
    }
  }

  get #contextService(): IContextService<ChatMessageType, LlmMessageType> {
    return this.#services.getContextService<ChatMessageType, LlmMessageType>();
  }

  get #contextMessageFactory(): IContextMessageFactory<ChatMessageType, LlmMessageType> {
    return this.#services.getContextMessageFactory<ChatMessageType, LlmMessageType>();
  }

  get #configurationService(): IConfigurationService {
    return this.#services.configurationService;
  }
}
```

- [ ] **Step 2: Verify `OllamaClient` has a `model` getter**

Run this check. The `ContextCompressionService` references `this.#services.ollamaClient.model`. Verify `OllamaClient` exposes the selected model name. If it does not have a public `model` getter, add one:

Open `src/services/clients/llm/ollama/OllamaClient.ts`. If there is no `get model(): string` getter, add one near the `host` getter:

```ts
  get model(): string {
    return this.#model;
  }
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/clients/llm/services/ContextCompressionService.ts src/services/clients/llm/ollama/OllamaClient.ts
git commit -m "feat: add ContextCompressionService implementation"
```

---

## Task 7: Register `ContextCompressionService` in the DI container

**Files:**
- Modify: `src/services/IBotServiceContainer.ts`
- Modify: `src/services/BotServiceContainer.ts`

**Interfaces:**
- Consumes: `ContextCompressionService` class (Task 6), `IContextCompressionService` interface (Task 5)
- Produces: `IBotServiceContainer.getContextCompressionService<ChatMessageType, LlmMessageType>(): IContextCompressionService`

- [ ] **Step 1: Add factory signature to `IBotServiceContainer`**

Open `src/services/IBotServiceContainer.ts`. Add this method to the interface (near `getContextService`):

```ts
  getContextCompressionService<ChatMessageType, LlmMessageType>(): IContextCompressionService;
```

Add the import at the top:

```ts
import { IContextCompressionService } from '../clients/llm/services/IContextCompressionService.js';
```

- [ ] **Step 2: Add lazy singleton to `BotServiceContainer`**

Open `src/services/BotServiceContainer.ts`. Add the import at the top:

```ts
import { ContextCompressionService } from '../clients/llm/services/ContextCompressionService.js';
import { IContextCompressionService } from '../clients/llm/services/IContextCompressionService.js';
```

Add the private field (near the other `#contextService` / `#memoryService` fields):

```ts
  #contextCompressionService: IContextCompressionService | null = null;
```

Add the getter/factory method (near the other `getContextService` method):

```ts
  getContextCompressionService<ChatMessageType, LlmMessageType>(): IContextCompressionService {
    if (this.#contextCompressionService === null) {
      this.#contextCompressionService = new ContextCompressionService<ChatMessageType, LlmMessageType>(this);
    }
    return this.#contextCompressionService;
  }
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add src/services/IBotServiceContainer.ts src/services/BotServiceContainer.ts
git commit -m "feat: register ContextCompressionService in DI container"
```

---

## Task 8: Wire compression into `OllamaMessageTask`

**Files:**
- Modify: `src/services/clients/llm/ollama/tasks/OllamaMessageTask.ts`

**Interfaces:**
- Consumes: `IBotServiceContainer.getContextCompressionService` (Task 7)
- Produces: `OllamaMessageTask` calls `compressIfNeeded(channelId)` after adding context.

- [ ] **Step 1: Add the compression call to the non-stream path**

Open `src/services/clients/llm/ollama/tasks/OllamaMessageTask.ts`. In the non-stream path (around line 82-85), after the two `addContext` calls and before `#storeMemories`, add:

```ts
    await this.#services.getContextCompressionService<DiscordMessage, OllamaMessage>().compressIfNeeded(this.#message.channelId);
```

The code around lines 82-87 should look like:

```ts
    this.contextService.addContext([this.contextMessageFactory.fromChatMessage(this.#message)]);
    this.contextService.addContext([
      this.contextMessageFactory.fromLlmMessage(exchange.exchange.response.message,
        this.#message.id, this.#message.author.id, this.#message.channelId, this.#message.guildId)]);

    await this.#services.getContextCompressionService<DiscordMessage, OllamaMessage>().compressIfNeeded(this.#message.channelId);

    await this.#storeMemories(llmChatMessage, exchange.exchange.response.message.content);
```

- [ ] **Step 2: Add the compression call to the stream path**

In the stream path (around line 160-168), after the two `addContext` calls and before `#storeMemories`, add the same call:

```ts
        await this.#services.getContextCompressionService<DiscordMessage, OllamaMessage>().compressIfNeeded(this.#message.channelId);
```

The code around lines 160-170 should look like:

```ts
      if (response.done) {
        this.contextService.addContext([this.contextMessageFactory.fromChatMessage(this.#message)]);
        this.contextService.addContext([
          this.contextMessageFactory.fromLlmMessage(response.message,
            this.#message.author.id,
            this.#message.guildId,
            this.#message.channelId,
            this.#message.guildId
          )]);

        await this.#services.getContextCompressionService<DiscordMessage, OllamaMessage>().compressIfNeeded(this.#message.channelId);

        await this.#storeMemories(llmChatMessage, fullResponse);
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add src/services/clients/llm/ollama/tasks/OllamaMessageTask.ts
git commit -m "feat: wire context compression into OllamaMessageTask"
```

---

## Task 9: Add `BotInteraction` enum values

**Files:**
- Modify: `src/enums/BotInteraction.ts`

**Interfaces:**
- Produces: `BotInteraction.CompressContext`, `BotInteraction.CompressContextCancel`, `BotInteraction.CompressContextConfirm`.

- [ ] **Step 1: Add the enum values**

Open `src/enums/BotInteraction.ts`. Add three new values before the closing brace, after `ClearContextConfirm`:

```ts
  CompressContext = 'compressContext',
  CompressContextCancel = 'compressContextCancel',
  CompressContextConfirm = 'compressContextConfirm',
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/enums/BotInteraction.ts
git commit -m "feat: add CompressContext enum values to BotInteraction"
```

---

## Task 10: Create the three Compress Context buttons

**Files:**
- Create: `src/services/clients/chat/discord/components/buttons/text/CompressContextButton.ts`
- Create: `src/services/clients/chat/discord/components/buttons/text/CompressContextConfirmButton.ts`
- Create: `src/services/clients/chat/discord/components/buttons/text/CompressContextCancelButton.ts`

**Interfaces:**
- Consumes: `BotInteraction.CompressContext*` (Task 9), `BaseComponent<ButtonBuilder>`, `SupportedFeature.Txt2Txt`
- Produces: Three button component classes matching the `ClearContext*` pattern.

- [ ] **Step 1: Create `CompressContextButton.ts`**

Create `src/services/clients/chat/discord/components/buttons/text/CompressContextButton.ts`:

```ts
import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../../../../IBotServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class CompressContextButton extends BaseComponent<ButtonBuilder> {
  override get label(): string {
    return '🗜️';
  }

  override get isSupported(): boolean {
    return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
  }

  override get title(): string {
    return 'Compress Context';
  }

  override get helpText(): string {
    return 'Summarizes the conversational context into a compact summary to free up context window space.';
  }

  constructor(services: IBotServiceContainer) {
    super(services);
  }

  override build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(BotInteraction.CompressContext)
      .setLabel(this.label)
      .setStyle(ButtonStyle.Secondary);
  }

  override buildAsync(): Promise<ButtonBuilder> {
    throw new Error('Method not implemented.');
  }
}
```

- [ ] **Step 2: Create `CompressContextConfirmButton.ts`**

Create `src/services/clients/chat/discord/components/buttons/text/CompressContextConfirmButton.ts`:

```ts
import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../../../../IBotServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class CompressContextConfirmButton extends BaseComponent<ButtonBuilder> {
  override get label(): string {
    return '✅';
  }

  override get isSupported(): boolean {
    return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
  }

  override get title(): string {
    return 'Confirm Compress Context';
  }

  override get helpText(): string {
    return 'Confirms context compression.';
  }

  constructor(services: IBotServiceContainer) {
    super(services);
  }

  override build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(BotInteraction.CompressContextConfirm)
      .setLabel(this.label)
      .setStyle(ButtonStyle.Danger);
  }

  override buildAsync(): Promise<ButtonBuilder> {
    throw new Error('Method not implemented.');
  }
}
```

- [ ] **Step 3: Create `CompressContextCancelButton.ts`**

Create `src/services/clients/chat/discord/components/buttons/text/CompressContextCancelButton.ts`:

```ts
import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { BotInteraction } from '../../../../../../../enums/BotInteraction.js';
import { SupportedFeature } from '../../../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../../../../IBotServiceContainer.js';
import { BaseComponent } from '../../BaseComponent.js';

export class CompressContextCancelButton extends BaseComponent<ButtonBuilder> {
  override get label(): string {
    return '🔙';
  }

  override get isSupported(): boolean {
    return this.featureService.hasFeature(SupportedFeature.Txt2Txt);
  }

  override get title(): string {
    return 'Cancel Compress Context';
  }

  override get helpText(): string {
    return 'Cancels context compression.';
  }

  constructor(services: IBotServiceContainer) {
    super(services);
  }

  override build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(BotInteraction.CompressContextCancel)
      .setLabel(this.label)
      .setStyle(ButtonStyle.Secondary);
  }

  override buildAsync(): Promise<ButtonBuilder> {
    throw new Error('Method not implemented.');
  }
}
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/clients/chat/discord/components/buttons/text/CompressContextButton.ts src/services/clients/chat/discord/components/buttons/text/CompressContextConfirmButton.ts src/services/clients/chat/discord/components/buttons/text/CompressContextCancelButton.ts
git commit -m "feat: add Compress Context Discord buttons"
```

---

## Task 11: Create `ChatConfirmCompressActionRow` and add `CompressContextButton` to `ChatActionRow`

**Files:**
- Create: `src/services/clients/chat/discord/components/buttonRows/ChatConfirmCompressActionRow.ts`
- Modify: `src/services/clients/chat/discord/components/buttonRows/ChatActionRow.ts`

**Interfaces:**
- Consumes: `CompressContextCancelButton`, `CompressContextConfirmButton` (Task 10), `CompressContextButton` (Task 10)
- Produces: `ChatConfirmCompressActionRow` class, `ChatActionRow` now includes `CompressContextButton`.

- [ ] **Step 1: Create `ChatConfirmCompressActionRow.ts`**

Create `src/services/clients/chat/discord/components/buttonRows/ChatConfirmCompressActionRow.ts`:

```ts
import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

import { IBotServiceContainer } from '../../../../../IBotServiceContainer.js';
import { BaseComponent } from '../BaseComponent.js';
import { CompressContextCancelButton } from '../buttons/text/CompressContextCancelButton.js';
import { CompressContextConfirmButton } from '../buttons/text/CompressContextConfirmButton.js';
import { IActionRowBuilderFactory } from '../IActionRowBuilderFactory.js';
import { IActionRows } from './IActionRows.js';

export class ChatConfirmCompressActionRow extends BaseComponent<ActionRowBuilder<ButtonBuilder>[]> implements IActionRows {
  #buttons: BaseComponent<ButtonBuilder>[] = [];
  get buttons(): BaseComponent<ButtonBuilder>[] {
    return this.#buttons;
  }

  get isAsync(): boolean {
    return false;
  }

  #services: IBotServiceContainer;

  #actionRowBuilderFactory: IActionRowBuilderFactory;

  constructor(services: IBotServiceContainer) {
    super(services);

    this.#services = services;
    this.#actionRowBuilderFactory = services.actionRowBuilderFactory;
  }

  override build(): ActionRowBuilder<ButtonBuilder>[] {
    this.#buttons = [
      new CompressContextCancelButton(this.#services),
      new CompressContextConfirmButton(this.#services)
    ];

    return this.#actionRowBuilderFactory.buildActionRows(this.#buttons);
  }

  override buildAsync(): Promise<ActionRowBuilder<ButtonBuilder>[]> {
    throw new Error('Method not implemented.');
  }
}
```

- [ ] **Step 2: Add `CompressContextButton` to `ChatActionRow`**

Open `src/services/clients/chat/discord/components/buttonRows/ChatActionRow.ts`. Add the import:

```ts
import { CompressContextButton } from '../buttons/text/CompressContextButton.js';
```

In the `build()` method, add `CompressContextButton` to the buttons array, before `ClearContextButton`:

```ts
    this.#buttons = [
      new CompressContextButton(this.#services),
      new ClearContextButton(this.#services),
      new HelpButton(this.#services)
    ];
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add src/services/clients/chat/discord/components/buttonRows/ChatConfirmCompressActionRow.ts src/services/clients/chat/discord/components/buttonRows/ChatActionRow.ts
git commit -m "feat: add ChatConfirmCompressActionRow and CompressContextButton to ChatActionRow"
```

---

## Task 12: Handle Compress Context interactions in `GenerativeChatClient`

**Files:**
- Modify: `src/services/clients/chat/discord/GenerativeChatClient.ts`

**Interfaces:**
- Consumes: `BotInteraction.CompressContext*` (Task 9), `ChatConfirmCompressActionRow` (Task 11), `IBotServiceContainer.getContextCompressionService` (Task 7), `IContextService.getContextByChannelId` / `getConversationMessages`.
- Produces: Three new switch cases + two private methods for compress confirmation and execution.

- [ ] **Step 1: Add imports**

Open `src/services/clients/chat/discord/GenerativeChatClient.ts`. Add these imports (sorted, near the existing `ChatConfirmClearActionRow` import):

```ts
import { ChatConfirmCompressActionRow } from './components/buttonRows/ChatConfirmCompressActionRow.js';
import { IContextCompressionService } from '../../llm/services/IContextCompressionService.js';
```

- [ ] **Step 2: Add `#contextCompressionService` field**

Add this field near the other `readonly` fields (after `#contextService`):

```ts
  readonly #contextCompressionService: IContextCompressionService<DiscordMessage, OllamaMessage>;
```

- [ ] **Step 3: Initialize the field in the constructor**

In the constructor, after the `this.#contextService = ...` line, add:

```ts
    this.#contextCompressionService = services.getContextCompressionService<DiscordMessage, OllamaMessage>();
```

- [ ] **Step 4: Add three switch cases in `#onButtonInteraction`**

In the `switch(interaction.customId)` block, after the `ClearContextConfirm` case and before the `Help` case, add:

```ts
      case BotInteraction.CompressContext.toString():
        await this.#compressContextAskConfirmation(interaction);
        break;
      case BotInteraction.CompressContextCancel.toString():
        await this.#compressContextCancel(interaction);
        break;
      case BotInteraction.CompressContextConfirm.toString():
        await this.#compressContext(interaction);
        break;
```

- [ ] **Step 5: Add `#compressContextAskConfirmation` method**

Add this method after `#clearContextCancel` (around line 210):

```ts
  async #compressContextAskConfirmation(interaction: ButtonInteraction): Promise<void> {
    this.logger.info('Asking confirmation before compressing the large language model context...');

    try {
      const messageCount: number = this.#contextService.getContextByChannelId(interaction.channelId).length;
      await interaction.editReply({
        content: `Compress ${messageCount} messages into a summary? This will replace the conversation with a condensed summary to free up context window space.`,
        components: new ChatConfirmCompressActionRow(this.#services).build()
      });
    } catch {
      this.logger.error('An error occurred while asking to compress the Ollama context.');
    }
  }
```

- [ ] **Step 6: Add `#compressContext` method**

Add this method after `#compressContextAskConfirmation`:

```ts
  async #compressContext(interaction: ButtonInteraction): Promise<void> {
    this.logger.info('Compressing the large language model context...');

    try {
      const beforeCount: number = this.#contextService.getContextByChannelId(interaction.channelId).length;
      await this.#contextCompressionService.compressNow(interaction.channelId);
      const afterCount: number = this.#contextService.getContextByChannelId(interaction.channelId).length;

      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      await interaction.editReply(`Context compressed — ${beforeCount} messages summarized into ${afterCount}.`);
      await interaction.message.delete();
    } catch(error) {
      this.logger.error('An error occurred while compressing the Ollama context: ', error);
    }
  }
```

- [ ] **Step 7: Add `#compressContextCancel` method**

Add this method after `#compressContext`:

```ts
  async #compressContextCancel(interaction: ButtonInteraction): Promise<void> {
    this.logger.info('Cancelling compressing the large language model context...');

    try {
      await interaction.message.delete();
      await interaction.editReply('Cancelling...');
      await interaction.deleteReply();
    } catch(error) {
      this.logger.error('An error occurred while cancelling compressing the Ollama context: ', error);
    }
  }
```

- [ ] **Step 8: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 9: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 10: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 11: Commit**

```bash
git add src/services/clients/chat/discord/GenerativeChatClient.ts
git commit -m "feat: handle Compress Context button interactions in GenerativeChatClient"
```

---

## Task 13: Write `ContextCompressionService` unit tests

**Files:**
- Create: `src/services/clients/llm/services/ContextCompressionService.test.ts`

**Interfaces:**
- Consumes: `ContextCompressionService` (Task 6), `IContextService`, `OllamaClient`, `IContextMessageFactory`, `IConfigurationService`, `ILogger`, `IBotServiceContainer`.

- [ ] **Step 1: Create the test file**

Create `src/services/clients/llm/services/ContextCompressionService.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ContextMessage } from '../ollama/models/ContextMessage.js';
import { ContextCompressionService } from './ContextCompressionService.js';
import { IContextMessageFactory } from './IContextMessageFactory.js';
import { IContextService } from './IContextService.js';
import { IConfigurationService } from '../../environment-settings/IConfigurationService.js';
import { ILogger } from '../../ILogger.js';
import { IBotServiceContainer } from '../../IBotServiceContainer.js';
import { OllamaClient } from '../ollama/OllamaClient.js';
import { IContextCompressionService } from './IContextCompressionService.js';

function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<ILogger>;
}

function createMockContextService(
  conversationMessages: ContextMessage<unknown, unknown>[] = [],
  getContextByChannelIdMessages: unknown[] = []
): jest.Mocked<IContextService<unknown, unknown>> {
  return {
    addContext: jest.fn(),
    getContextByServerId: jest.fn().mockReturnValue(getContextByChannelIdMessages),
    getContextByChannelId: jest.fn().mockReturnValue(getContextByChannelIdMessages),
    getContextByUserId: jest.fn().mockReturnValue(getContextByChannelIdMessages),
    clearContext: jest.fn(),
    getConversationMessages: jest.fn().mockReturnValue(conversationMessages),
    replaceChannelContext: jest.fn()
  } as unknown as jest.Mocked<IContextService<unknown, unknown>>;
}

function createMockConfigurationService(overrides: Partial<IConfigurationService> = {}): IConfigurationService {
  return {
    ollamaHosts: [new URL('http://localhost:11434')],
    ollamaModels: ['test-model'],
    ollamaSystemPrompt: 'system',
    ollamaStreamsResponse: false,
    ollamaEmbeddingModel: null,
    ollamaTopK: 5,
    ollamaContextWindow: 4096,
    ollamaContextCompressionThreshold: 0.75,
    ...overrides
  } as IConfigurationService;
}

function createMockOllamaClient(summaryContent: string = 'Summary text'): jest.Mocked<OllamaClient> {
  return {
    sendMessage: jest.fn().mockResolvedValue({
      exchange: {
        request: {},
        response: { message: { role: 'assistant', content: summaryContent } }
      },
      data: []
    }),
    show: jest.fn().mockResolvedValue({ model_info: new Map([['llama.context_length', 8192]]) }),
    model: 'test-model',
    host: new URL('http://localhost:11434')
  } as unknown as jest.Mocked<OllamaClient>;
}

function createMockContextMessageFactory(): jest.Mocked<IContextMessageFactory<unknown, unknown>> {
  return {
    fromSystemPrompt: jest.fn(),
    formatChatMessage: jest.fn(),
    fromChatMessage: jest.fn(),
    fromChatPrompt: jest.fn(),
    fromLlmMessage: jest.fn(),
    fromSummary: jest.fn().mockImplementation((summary: string, channelId: string | null) => ({
      messageId: null,
      associatedMessageId: null,
      userId: null,
      associatedUserId: null,
      channelId: channelId,
      serverId: null,
      timestamp: new Date(),
      chatMessage: null,
      llmMessage: { role: 'system', content: summary },
      isReadOnly: false,
      isPrivate: false,
      isSummary: true
    }))
  } as unknown as jest.Mocked<IContextMessageFactory<unknown, unknown>>;
}

function createMockServices(
  contextService: jest.Mocked<IContextService<unknown, unknown>>,
  configurationService: IConfigurationService,
  ollamaClient: jest.Mocked<OllamaClient>,
  contextMessageFactory: jest.Mocked<IContextMessageFactory<unknown, unknown>>,
  logger: jest.Mocked<ILogger>
): IBotServiceContainer {
  return {
    configurationService,
    getContextService: jest.fn().mockReturnValue(contextService),
    getContextMessageFactory: jest.fn().mockReturnValue(contextMessageFactory),
    ollamaClient,
    getLogger: jest.fn().mockReturnValue(logger)
  } as unknown as IBotServiceContainer;
}

function makeMessage(role: string, content: string, isSummary: boolean = false): ContextMessage<unknown, unknown> {
  return {
    messageId: null,
    associatedMessageId: null,
    userId: null,
    associatedUserId: null,
    channelId: 'channel1',
    serverId: null,
    timestamp: new Date(),
    chatMessage: null,
    llmMessage: { role, content },
    isReadOnly: false,
    isPrivate: false,
    isSummary: isSummary
  };
}

describe('ContextCompressionService', () => {
  let contextService: jest.Mocked<IContextService<unknown, unknown>>;
  let configurationService: IConfigurationService;
  let ollamaClient: jest.Mocked<OllamaClient>;
  let contextMessageFactory: jest.Mocked<IContextMessageFactory<unknown, unknown>>;
  let logger: jest.Mocked<ILogger>;
  let services: IBotServiceContainer;
  let compressionService: IContextCompressionService;

  beforeEach((): void => {
    logger = createMockLogger();
    contextService = createMockContextService();
    configurationService = createMockConfigurationService();
    ollamaClient = createMockOllamaClient();
    contextMessageFactory = createMockContextMessageFactory();
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, unknown>(services);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  it('should not compress when token count is under the threshold', async (): Promise<void> => {
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tokens: new Array(10).fill('tok') })
    }) as unknown as typeof fetch;

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).not.toHaveBeenCalled();
    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('should compress when token count exceeds the threshold', async (): Promise<void> => {
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tokens: new Array(5000).fill('tok') })
    }) as unknown as typeof fetch;

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).toHaveBeenCalled();
    expect(contextService.replaceChannelContext).toHaveBeenCalledWith('channel1', [expect.objectContaining({ isSummary: true })]);

    global.fetch = originalFetch;
  });

  it('should always compress with compressNow', async (): Promise<void> => {
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);

    await compressionService.compressNow('channel1');

    expect(ollamaClient.sendMessage).toHaveBeenCalled();
    expect(contextService.replaceChannelContext).toHaveBeenCalledWith('channel1', [expect.objectContaining({ isSummary: true })]);
  });

  it('should fold old summary into new summary', async (): Promise<void> => {
    const oldSummary = makeMessage('system', 'Old summary', true);
    const userMsg = makeMessage('user', 'hello');
    const assistantMsg = makeMessage('assistant', 'hi');
    contextService.getConversationMessages.mockReturnValue([oldSummary, userMsg, assistantMsg]);

    await compressionService.compressNow('channel1');

    const callArgs = ollamaClient.sendMessage.mock.calls[0];
    const context = callArgs[1];
    const hasOldSummary = context.some(
      (m: { role: string; content: string }) => m.role === 'system' && m.content.includes('Old summary')
    );
    expect(hasOldSummary).toBe(true);
  });

  it('should no-op when tokenize fails', async (): Promise<void> => {
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.sendMessage).not.toHaveBeenCalled();
    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('should no-op when summarize fails', async (): Promise<void> => {
    const messages = [makeMessage('user', 'hello'), makeMessage('assistant', 'hi')];
    contextService.getConversationMessages.mockReturnValue(messages);
    ollamaClient.sendMessage.mockRejectedValue(new Error('LLM error'));

    await compressionService.compressNow('channel1');

    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should fall back to show() when ollamaContextWindow config is null', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: null });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, unknown>(services);

    const messages = [makeMessage('user', 'hello')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tokens: new Array(10).fill('tok') })
    }) as unknown as typeof fetch;

    await compressionService.compressIfNeeded('channel1');

    expect(ollamaClient.show).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('8192'), );

    global.fetch = originalFetch;
  });

  it('should fall back to 4096 when show() fails and config is null', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: null });
    ollamaClient.show.mockRejectedValue(new Error('show failed'));
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, unknown>(services);

    const messages = [makeMessage('user', 'hello')];
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tokens: new Array(10).fill('tok') })
    }) as unknown as typeof fetch;

    await compressionService.compressIfNeeded('channel1');

    expect(logger.warn).toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('should log and no-op when compressNow is called with empty context', async (): Promise<void> => {
    contextService.getConversationMessages.mockReturnValue([]);

    await compressionService.compressNow('channel1');

    expect(ollamaClient.sendMessage).not.toHaveBeenCalled();
    expect(contextService.replaceChannelContext).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No messages to compress'), );
  });

  it('should truncate oldest conversation messages when summarization input exceeds context window', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: 100 });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, unknown>(services);

    const messages: ContextMessage<unknown, unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      messages.push(makeMessage('user', `Message ${i} with some content to make it longer`));
    }
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    let tokenCount = 10000;
    global.fetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ tokens: new Array(tokenCount > 100 ? 100 : tokenCount).fill('tok') })
    })) as unknown as typeof fetch;

    const sendCallCount = ollamaClient.sendMessage.mock.calls.length;
    await compressionService.compressNow('channel1');

    expect(ollamaClient.sendMessage).toHaveBeenCalled();
    const callArgs = ollamaClient.sendMessage.mock.calls[0];
    const context = callArgs[1] as { role: string; content: string }[];
    expect(context.length).toBeLessThan(messages.length + 1);

    global.fetch = originalFetch;
  });

  it('should preserve old summary when truncating conversation messages', async (): Promise<void> => {
    configurationService = createMockConfigurationService({ ollamaContextWindow: 100 });
    services = createMockServices(contextService, configurationService, ollamaClient, contextMessageFactory, logger);
    compressionService = new ContextCompressionService<unknown, unknown>(services);

    const oldSummary = makeMessage('system', 'Old summary of earlier conversation', true);
    const messages: ContextMessage<unknown, unknown>[] = [oldSummary];
    for (let i = 0; i < 50; i++) {
      messages.push(makeMessage('user', `Message ${i} with some content`));
    }
    contextService.getConversationMessages.mockReturnValue(messages);

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tokens: new Array(500).fill('tok') })
    }) as unknown as typeof fetch;

    await compressionService.compressNow('channel1');

    const callArgs = ollamaClient.sendMessage.mock.calls[0];
    const context = callArgs[1] as { role: string; content: string }[];
    const hasOldSummary = context.some(
      (m) => m.role === 'system' && m.content.includes('Old summary')
    );
    expect(hasOldSummary).toBe(true);

    global.fetch = originalFetch;
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx jest src/services/clients/llm/services/ContextCompressionService.test.ts --verbose`
Expected: All tests PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/clients/llm/services/ContextCompressionService.test.ts
git commit -m "test: add ContextCompressionService unit tests"
```

---

## Task 14: Final verification and integration check

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Verify config.jsonc example exists or update if needed**

Check if there is a `config.example.jsonc` or similar in the repo root. If so, add the new optional fields with comments. If not, skip this step.

- [ ] **Step 5: Final commit (if any changes from step 4)**

```bash
git add -A
git commit -m "feat: context compression for chat mode"
```

---

## Notes for the implementer

1. **Pre-existing bug in `OllamaMessageTask`:** The `fromLlmMessage` call args in the non-stream path pass `this.#message.id` as `associatedUserId` and `this.#message.author.id` as `serverId` (lines 84-85). This is a pre-existing bug — do NOT fix it in this plan. Preserve as-is.

2. **`OllamaClient.model` getter:** The `ContextCompressionService` needs the selected model name for the tokenize request. If `OllamaClient` already exposes a `model` getter, no change is needed. If not, Task 6 Step 2 adds one.

3. **`OllamaClient` is a transient** (new instance per `this.#services.ollamaClient` access). The `ContextCompressionService` accesses `this.#services.ollamaClient` for `show()` and `sendMessage()`. Each access creates a new `OllamaClient`, but since `#host` and `#model` are selected randomly from arrays, the model may differ between calls. For summarization this is acceptable (any configured model works). For `show()`, the model_info is per-model so the result may vary if multiple models are configured — this is fine since we just need any `*.context_length` value.

4. **`fetch` is global** in Node 18+. No import needed.

5. **The `IContextCompressionService` interface** is generic-agnostic (no type params). The `ContextCompressionService` class is generic over `<ChatMessageType, LlmMessageType>` to match `ContextService`. The `IBotServiceContainer.getContextCompressionService` factory is generic, mirroring `getContextService`.

6. **`OllamaMessage.role`** in the `ollama` npm package is typed as `string`. When building context for summarization, we cast `message.llmMessage.role as string` — this is safe since `OllamaRole` values are already strings.