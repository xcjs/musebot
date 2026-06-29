# Long-Term Memory

Long-Term Memory (LTM) is an optional feature for Musebot's chat mode that
allows the bot to remember and recall information from past conversations. When
enabled, Musebot stores messages as vector embeddings in a local SQLite
database and retrieves relevant context before each response, giving the LLM
access to history beyond the current channel's rolling context window.

## How It Works

When LTM is enabled, Musebot:

1. **Passively listens** to all messages in channels it can see, storing them
   as structured `LlmChatMessage` objects (username, display name, message
   text, timestamp, roles, channel info, server info, and attachments) with
   vector embeddings.
2. **Stores its own responses** alongside user messages, attributed to the
   triggering user for consent and deletion purposes.
3. **Retrieves relevant memories** before generating a reply. The current
   message is embedded and compared against stored memories in the same server
   (Discord guild). The top-K most similar memories are injected as system
   messages prepended to the LLM context.

Memories are **server-scoped** — only messages from the same Discord server
are considered during retrieval, but consent is **global per-user** — a user
opts in once and their memories are accessible across all servers.

## Prerequisites

### Embedding Model

LTM requires an embedding model installed in your Ollama instance. Embedding
models convert text into high-dimensional vectors for similarity search. You
can browse available embedding models at
[https://ollama.com/search](https://ollama.com/search) (filter by "embedding").

A popular choice is `nomic-embed-text`:

```bash
ollama pull nomic-embed-text
```

### Storage

Memories are stored in a local SQLite database at
`workflows/{botId}/txt2txt/memory.db`, where `{botId}` is the bot's configured
`botId` value. The directory is created automatically if it doesn't exist. The
database uses [sqlite-vec](https://github.com/asg0171/sqlite-vec) for vector
similarity search.

No external services or additional infrastructure are required — everything
runs locally alongside Musebot.

## Configuration

To enable LTM, add the `embeddingModel` field to the `ollama` block in your
`config.jsonc`:

```jsonc
{
  "bots": [
    {
      // ...
      "ollama": {
        "hosts": ["http://localhost:11434/"],
        "models": ["gemma4:12b"],
        "systemPrompt": "You are a helpful assistant.",
        "streamsResponse": false,
        "embeddingModel": "nomic-embed-text"
      }
    }
  ]
}
```

The optional `topK` field controls how many memories are retrieved per request:

```jsonc
        "embeddingModel": "nomic-embed-text",
        "topK": 5
```

| Field | Required | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `ollama.embeddingModel` | No | `String` | *(unset)* | Ollama embedding model name. Presence enables LTM. |
| `ollama.topK` | No | `Integer` | `5` | Number of similar memories to retrieve per request. |

When `ollama.embeddingModel` is omitted, LTM is fully disabled and no
database is created.

## User Consent & Slash Commands

LTM is **opt-in per user**. Users control whether their messages are stored
via two slash commands:

### `/memory remember`

Opts the user into LTM. When invoked, Musebot:

- Records the user's consent in the database.
- **Backfills** messages from all accessible text channels across all servers
  the bot is in (excluding channels listed in `channelsDisallowed`). The full
  channel history is paginated — not just the most recent messages. Messages
  from other bots and empty messages are skipped. Both the user's messages and
  the bot's own responses are stored.
- Replies with the number of messages stored.

If the backfill is interrupted (e.g., the bot restarts), running
`/memory remember` again will **resume** the backfill from where it left off.
Already-stored messages are skipped via deduplication, so no duplicates are
created.

After opting in, the user's messages are stored passively as they continue to
converse, even in channels where the bot doesn't respond.

### Messages with Attachments

When a message contains image attachments or web links, Musebot interprets the
content before storing it:

* **Image attachments** — If the [Vision](01-ollama.md#vision) feature is
  enabled, each image is sent to the vision-capable model and a text
  description (the "interpretation") is generated and stored as part of the
  `LlmChatMessage`'s `attachments` array. Image-only messages (no text body)
  are eligible for storage only when Vision is enabled; without Vision, they
  are skipped.
* **Web link attachments** — URLs in the message text are fetched and their
  readable content is extracted via [Readability](https://github.com/mozilla/readability).
  The extracted text is stored as a `web` attachment on the `LlmChatMessage`.
  This works with any chat model — no vision capability is required.

Attachments are stored within the JSON-serialized `content` column of the
`LlmChatMessage` record. The embedding is generated from the `messageText`
field (the raw message text), not from attachment interpretations, but the
full attachment content is available to the LLM when a memory is retrieved
and injected into context.

### `/memory forget`

Opts the user out of LTM. When invoked, Musebot:

- **Deletes all memories** associated with the user, globally across all
  servers.
- Removes the user's consent record.
- Replies with a confirmation.

This is a permanent deletion — memories cannot be recovered after opting out.

::: tip
Slash commands are registered globally when the bot starts up. It may take a
few minutes for Discord to propagate new commands to all servers.
:::

## Startup Catch-Up

When Musebot starts up, it automatically:

1. **Resumes incomplete backfills** for any users whose backfill was
   interrupted (e.g., by a bot restart during `/memory remember`).
2. **Catches up on missed messages** for all consenting users. For each user,
   Musebot checks the timestamp of their most recently stored memory and fetches
   any newer messages from all accessible channels — ensuring messages sent
   while the bot was offline are not lost.

## Embedding Model Migration

Each stored memory records the embedding model used to generate its vector.
When querying, only memories matching the currently configured
`ollama.embeddingModel` are considered — this prevents vector space mismatches
between different embedding models.

If you change the embedding model, Musebot automatically detects memories
embedded with the old model on startup and re-embeds them using the new model.
Old vectors are deleted and replaced; the relational record is preserved.

## Privacy Considerations

- **User consent is required.** No messages are stored until a user explicitly
  runs `/memory remember`.
- **Consent is global.** A user who opts in has their messages stored across
  all servers where Musebot is present. Opting out deletes all memories
  globally.
- **Retrieval is server-scoped.** Memories are only retrieved from the same
  Discord server as the current message. A user's memories from Server A are
  not used when generating a response in Server B.
- **Bot responses are stored too.** The bot's own replies are stored as
  memories (attributed to the triggering user) so the LLM can recall past
  conversations holistically.
- **Data is local.** The SQLite database lives on the same machine as Musebot.
  No data is sent to third-party services beyond Ollama (for embedding
  generation).

## Technical Details

- **Embeddings** are generated from the `message` field of each
  `LlmChatMessage` (the raw message text with bot mentions stripped), not the
  full JSON structure. Attachment interpretations are not included in the
  embedding vector.
- **Similarity search** uses cosine distance via sqlite-vec.
- **Memory injection** — retrieved memories are serialized into a single
  system message prepended to the rolling context. The full `LlmChatMessage`
  JSON (including attachments) is included, so the LLM can see both the
  original message text and any image descriptions or web link content from
  that message. Memories are not added to the persistent rolling context, so
  they don't accumulate over time.
- **Database schema** uses Drizzle ORM for relational tables and raw SQL for
  vector operations (sqlite-vec does not support parameterized vector queries
  through ORMs).
  - `UserConsent` — `userId` (PK), `consentedAt` (timestamp),
    `backfillCompleted` (boolean, tracks whether the initial backfill finished)
  - `LlmChatMessage` — `id` (auto-increment PK), `userId`, `serverId`,
    `content` (JSON-serialized `LlmChatMessage`, including `attachments`),
    `messageText`, `isBot`, `embeddingModel` (model used for the vector),
    `discordMessageId` (nullable, unique — used for deduplication during
    backfill resume), `createdAt`