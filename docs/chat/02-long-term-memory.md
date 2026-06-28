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
   text, timestamp, roles, channel info, server info) with vector embeddings.
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
`workflows/txt2txt/memory.db`. The directory is created automatically if it
doesn't exist. The database uses [sqlite-vec](https://github.com/asg0171/sqlite-vec)
for vector similarity search.

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
        "models": ["mistral-nemo"],
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
- **Backfills** up to 100 recent messages from the current channel, storing
  each as a memory. Messages from other bots and empty messages are skipped.
- Replies with the number of messages stored.

After opting in, the user's messages are stored passively as they continue to
converse, even in channels where the bot doesn't respond.

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
  full JSON structure.
- **Similarity search** uses cosine distance via sqlite-vec.
- **Memory injection** — retrieved memories are concatenated into a single
  system message prepended to the rolling context. They are not added to the
  persistent rolling context, so they don't accumulate over time.
- **Database schema** uses Drizzle ORM for relational tables (user consent,
  message records) and raw SQL for vector operations (sqlite-vec does not
  support parameterized vector queries through ORMs).