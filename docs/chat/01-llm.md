# LLM Providers

Musebot's chat mode talks to any server that speaks the **OpenAI-compatible
chat completions protocol**. Musebot appends only the endpoint paths
(`/chat/completions` and `/embeddings`) to the host URL you configure — the
URL must therefore already carry the provider's OpenAI base route, which is
usually `/v1`.
That includes [Ollama](https://ollama.com), [llama.cpp](https://github.com/ggml-org/llama.cpp)'s
`llama-server`, and hosted OpenAI-compatible APIs (OpenRouter, Together,
LM Studio, vLLM, etc.).

Hosts are configured in the `llm.hosts` array in your `config.jsonc` file.
Each host is an object with a `url` and, optionally, a `token` and an
`isLocal` flag:

```jsonc
{
  "bots": [
    {
      // ...
      "llm": {
        "hosts": [
          { "url": "http://localhost:11434/v1" },
          { "url": "https://api.openai-compatible.example.com/v1", "token": "sk-..." }
        ]
      }
    }
  ]
}
```

Musebot appends only `/chat/completions` and `/embeddings` to the URL exactly
as given — include the versioned route (usually `/v1`) yourself. Platform
probe endpoints (`/api/ps`, `/models`, `/props`, ...) are joined to the
server root, so an Ollama host with route `http://localhost:11434/v1` still
probes `/api/ps` at `http://localhost:11434/api/ps`.

Bare-string hosts (`"hosts": ["http://localhost:11434"]`) were supported in
earlier versions but are **rejected as of v10** — see the
[Migration Guide](../musebot/04-migration-v10.md).

## Provider Matrix

At startup, Musebot probes each configured host to detect what platform it is
talking to and picks a matching lifecycle strategy. Non-local hosts never get
model lifecycle management — unloading a model on someone else's server makes
no sense.

| Capability                     | Ollama                                  | llama.cpp (router mode)                             | llama.cpp (single model)                                | Hosted / cloud                    |
| ------------------------------ | --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| Detection                      | `GET /api/ps` responds                  | `GET /models` responds                              | `GET /props` responds                                   | Anything else                     |
| Model unload (`free()`)         | Yes — `POST /api/generate` with `keep_alive: 0` | Yes — `POST /models/unload` with `{"model": name}` | No — only idle sleep (see below)                        | No                                |
| Unload verification            | Yes — `GET /api/ps` until the model disappears | Yes — `GET /models` until status changes     | Yes — `GET /props` until `is_sleeping: true`            | No-op (always "unloaded")         |
| Vision detection               | Auto — `POST /api/show` capabilities    | Via `llm.visionModels` config                       | Via `llm.visionModels` config                           | Via `llm.visionModels` config    |
| Context window detection       | Auto — `POST /api/show`                 | None — set `llm.contextWindow` manually            | None — set `llm.contextWindow` manually                 | None — set `llm.contextWindow` manually |
| Authentication                | Optional per-host `token`               | Optional per-host `token`                           | Optional per-host `token`                                | Typically required — `token`     |

### Ollama

There are multiple ways to run Ollama using the `ollama serve` command,
including through Docker, a systemd service, or other means. Please refer to
the [Ollama documentation](https://github.com/ollama/ollama/blob/main/README.md) to
download, configure, and install Ollama.

Once Ollama is running as a server, it's typically accessible on port `11434`
of your assigned host:

```jsonc
"llm": {
  "hosts": [{ "url": "http://localhost:11434/v1" }]
}
```

Ollama is the best-supported provider: Musebot automatically detects vision
models, the model's context window, and can truly unload models after use
(`keep_alive: 0`, verified via `/api/ps`) so they release VRAM for other
workloads such as ComfyUI.

### llama.cpp — Router Mode

Launch `llama-server` **without** the `-m` flag and point `--models-dir` at a
directory of GGUF files:

```bash
llama-server --models-dir ./models --models-max 4 --api-key sk-your-key
```

In router mode, `llama-server` loads models on demand and Musebot can unload
them via `POST /models/unload` with `{"model": "<name>"}`. `GET /models` lists
the per-model status, which Musebot polls to verify the unload completed.
Model instances inherit the router's API key, so configure that key as the
host's `token`. With `--models-max` (default `4`) you can bound how many models
stay resident at once.

### llama.cpp — Single-Model Mode

Launch `llama-server` with a single `-m path/to/model.gguf`. In this mode
there is **no on-demand unload endpoint**. To let Musebot release the model's
RAM between uses, launch the server with:

```bash
llama-server -m ./models/gemma.gguf --sleep-idle-seconds 300
```

After `--sleep-idle-seconds N` seconds of inactivity, `llama-server` unloads
the model (and its KV cache) from RAM and automatically reloads it on the
next request. Musebot detects the sleeping state via `is_sleeping` in
`GET /props`. Without `--sleep-idle-seconds`, Musebot's unload wait never
terminates — the model always looks loaded.

### Hosted / Cloud Providers

Any OpenAI-compatible endpoint works: OpenRouter, Together, Groq, vLLM, LM
Studio, and so on. Configure the `token` per host — Musebot sends it as an
`Authorization: Bearer <token>` header on every request. Musebot performs no
model lifecycle management on non-local hosts; vision models must be listed
in `llm.visionModels` and the context window set via `llm.contextWindow`.

## Local vs Non-Local

Musebot only manages model lifecycle on **local** hosts. A host is considered
local when:

* The URL's hostname is `localhost`, starts with `127.`, or is `::1`, or
* The hostname resolves (via DNS) to a private address: RFC 1918
  (`10/8`, `172.16/12`, `192.168/16`), the Tailscale CGNAT range
  `100.64/10`, link-local `169.254/16`, IPv6 unique-local `fc00::/7`, or
  IPv6 link-local `fe80::/10`, or
* The hostname cannot be resolved at all (conservatively treated as local).

An explicit `"isLocal": true` or `"isLocal": false` on the host object always
overrides the automatic detection — useful when DNS or a reverse proxy makes
the automatic check unreliable.

## Models

Configure one or more model names in `llm.models`; Musebot picks one at
random for each request. With Ollama you can browse models at
[https://ollama.com/search](https://ollama.com/search) and download them with:

```bash
ollama pull gemma4:12b
```

For other providers, use whatever model identifiers the provider exposes
(e.g., `meta-llama/Llama-3.3-70B-Instruct` on OpenRouter-style hosts).

## Vision

Musebot automatically enables its **Vision** feature when a configured model
is capable of image input.

* **Ollama hosts** — vision capability is auto-detected at startup by
  querying Ollama's `/api/show` endpoint. If any configured model reports
  `vision` in its capabilities, Vision is enabled. No configuration required.
* **Everything else** — list the model names that accept image input in the
  optional `llm.visionModels` array:

  ```jsonc
  "llm": {
    // ...
    "visionModels": ["llava", "gemma4:12b"]
  }
  ```

When Vision is enabled:

* **Image attachments** on user messages are fetched, encoded, and passed
  alongside the message text to the vision-capable model during the normal chat
  response. The model can "see" and reason about images users post.
* **Long-term memory** stores image interpretations: when a message with image
  attachments is stored as a memory, Musebot uses the vision model to generate a
  text description of each image, which is stored alongside the message. This
  allows the bot to recall the content of past images even though the embedding
  is text-based.
* **Image-only messages** are eligible for long-term memory storage. Without
  Vision, messages with no text body are skipped.

## Web Link Reading

When a user posts a message containing URLs, Musebot extracts the link
content and uses it as context for the response. This works for any model — no
vision capability is required.

* **Before replying**, Musebot fetches each URL, extracts the readable content
  using [Readability](https://github.com/mozilla/readability), and injects it
  as a system message into the LLM context. The bot can then answer questions
  about or reference the linked page.
* **In long-term memory**, link content is stored as a `web` attachment on the
  message. The extracted text is embedded alongside the message text so past
  link content is searchable.

URL detection is automatic — any `http://` or `https://` URL in the message
text is fetched. Non-HTML responses (images, PDFs, etc.) are skipped silently.
There is no configured size limit on extracted content.

## Image Attachment Support

If you also integrate Musebot with a [ComfyUI](../media/01-swarm-ui.md) instance
with `mode` set to `"chat"`, Musebot will use the large language model response
as a prompt for an image and attach it to its response asynchronously, providing
a visual for the response.

## Context Compression

As a conversation grows, the accumulated message history consumes more of the
model's context window. When the token count exceeds a configurable threshold,
Musebot automatically compresses the conversation context by summarizing older
messages into a compact summary using the same LLM. This keeps long-running
conversations responsive without losing the thread of discussion.

### How It Works

1. **Threshold check** — After each response, Musebot estimates the token count
   of the conversation context and compares it against the context window
   multiplied by the compression threshold. If the estimate is below the
   threshold, nothing happens.
2. **Chunked summarization** — When the conversation exceeds the context window,
   Musebot splits the conversation into window-sized chunks, summarizes each
   chunk individually, then combines all chunk summaries (plus any existing
   summary) into a final summary. If the combined summaries still exceed the
   window, the oldest chunk summaries are dropped to fit.
3. **Replacement** — The conversation messages are replaced with the single
   summary message. The system prompt and channel topic are preserved.

### Context Window Resolution

The context window is resolved in this order:

1. **Config** — `llm.contextWindow` in `config.jsonc`, if set, always wins.
2. **Strategy probe** — Ollama hosts only: the model's `context_length` is read
   from `/api/show`.
3. **Fallback** — `4096` tokens.

For llama.cpp and hosted providers there is no probe, so set
`llm.contextWindow` manually if your model's window differs from the fallback.

### Configuration

Both settings are optional and live under `llm` in `config.jsonc`:

```jsonc
"llm": {
  // ...
  // The maximum context window (in tokens) for the LLM.
  // When unset, Musebot probes the host strategy (Ollama only) and
  // ultimately falls back to 4096.
  // "contextWindow": 4096,

  // The threshold (as a fraction of the context window) at which compression
  // triggers. For example, 0.75 means compression at 75% of the window.
  // "contextCompressionThreshold": 0.75
}
```

## Streaming

When `llm.streamsResponse` is `true`, responses are streamed token-by-token
via server-sent events, appearing as if the bot is typing in real time.
Musebot requests usage accounting with
`stream_options: { "include_usage": true }`, and the provider reports token
usage on the final chunk. If the provider omits usage from its stream, Musebot
falls back to a character-based token estimate (calibrated against actual usage
samples when available). **Note:** This is an experimental feature.

## Authentication

Each host accepts an optional `token` field:

```jsonc
"llm": {
  "hosts": [
    { "url": "https://api.examplerator.com/v1", "token": "sk-..." }
  ]
}
```

* The token is sent as an `Authorization: Bearer <token>` header on **every**
  request to that host — and only when a token is configured. Local hosts
  without a token send no header.
* On llama.cpp, tokens are configured server-side via `--api-key`
  (comma-separated list for multiple keys); `GET /health` is exempt from
  authentication.
* Tokens live only in `config.jsonc`, which is in `.gitignore` and must
  **never** be committed to version control (see
  [ADR 003](../adr/003-drop-env-support.md)). Musebot does not read
  credentials from environment variables.