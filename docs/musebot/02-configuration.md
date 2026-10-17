# Configuration

Musebot is configured through JSON-based configuration files (`config.json` or
`config.jsonc`). This is the modern, standardized configuration format with
excellent IDE support (autocomplete, validation, formatting).

**Note on Configuration Loading:**

Musebot loads the configuration file from its current working directory at
startup. Changes to this file will **not** take effect while the bot is running.
You must restart the bot for any changes to be applied.

## **Migration Guides**

* Upgrading from a pre-v10 release (Ollama-only config)? See the
  [v10 LLM Migration Guide](./04-migration-v10.md).
* Previously using `.env` files with `MUSEBOT_*` environment variables? See the
  [Migration Guide](./03-migration-from-env-to-jsonc.md).

### **Core Configuration**

#### `nodeEnvironment`

* **Description:** The operating environment for the Node.js runtime.
* **Required:** No
* **Type:** `String`
* **Default:** `production`
* **Values:** `production`, `development`

#### `mode`

* **Description:** **The core operating mode** of the bot. This determines which
  integrations are active. If set to `chat`, an LLM host must be configured.
  If set to `media`, ComfyUI/SwarmUI must be configured.
* **Required:** Yes
* **Type:** `String`
* **Values:** `chat`, `media`

---

### **Discord Configuration**

#### `chatApis.discord.token`

* **Description:** The authentication token for your bot, obtained from the
  [Discord Developer Portal](https://discord.com/developers/applications).
* **Required:** Yes
* **Type:** `String`

#### `chatApis.discord.channels`

* **Description:** An array of **allowed** channel IDs. The bot
  will *only* respond in these channels. If left empty, all channels are
  allowed.
* **Required:** No
* **Type:** `String[]`

#### `chatApis.discord.channelsDisallowed`

* **Description:** An array of **disallowed** channel IDs. The bot
  will *never* respond in these channels, even if they are in
  `chatApis.discord.channels`.
* **Required:** No
* **Type:** `String[]`

#### `requiresMention`

* **Description:** If `true`, the bot will only respond when it is mentioned in
  a message (e.g., `@Musebot help`).
* **Required:** No
* **Type:** `Boolean`
* **Default:** `true`
* **Values:** `true`, `false`

#### `responseRate`

* **Description:** If `requiresMention` is `false`, this sets the
  percentage chance (0-100) the bot will respond to a public message. A value of
  `50` means it responds to roughly half of the messages.
* **Required:** No
* **Type:** `Integer`
* **Default:** `100`
* **Values:** `1-100`

#### `discord.privateMessageUsers`

* **Description:** An array of Discord usernames (case-sensitive!)
  who are allowed to send the bot private messages. *Note:* This is the
  username, not the display name.
* **Required:** No
* **Type:** `String[]`

#### `errorMessage`

* **Description:** A custom message to display when a task (like media
  generation) fails. If not set, a generic error message is displayed.
* **Required:** No
* **Type:** `String`
* **Default:** `An error occurred while generating a response. Please try again
  later.`

### **Chat Mode (LLM) Settings**

*Required if `mode=chat`*

Musebot speaks the OpenAI-compatible protocol, so any compatible platform
works — Ollama, llama.cpp's `llama-server`, and hosted APIs. See
[LLM Providers](../chat/01-llm.md) for a provider capability matrix, and the
[v10 Migration Guide](./04-migration-v10.md) if you're upgrading from an
earlier release.

#### `llm.hosts`

* **Description:** An array of your LLM backend host(s). Each entry is an
  object with a `url` (required) and optional `token` and `isLocal` fields.
  You can specify multiple hosts for load balancing. Bare-string hosts (as
  used before v10) are rejected at startup.

  ```jsonc
  "llm": {
    "hosts": [
      { "url": "http://localhost:11434/v1" },
      { "url": "https://api.examplerator.com/v1", "token": "sk-...", "isLocal": false }
    ]
  }
  ```
* **Required:** Yes
* **Type:** `Object[]` (`{ "url": String, "token"?: String, "isLocal"?: Boolean }`)

#### `llm.hosts[].url`

* **Description:** The base URL of the LLM backend. It must include the
  full OpenAI-compatible base route (usually `/v1`), e.g.
  `http://localhost:11434/v1` for Ollama. Musebot appends only the endpoint
  paths (`/chat/completions`, `/embeddings`) to the URL exactly as given;
  platform probe endpoints (`/api/ps`, `/models`, `/props`, ...) are
  always joined to the server root.
* **Required:** Yes
* **Type:** `String`

#### `llm.hosts[].token`

* **Description:** An optional API token for the host. When set, it is sent as
  an `Authorization: Bearer <token>` header on every request to that host;
  when unset, no header is sent. Tokens live only in `config.jsonc` — never
  commit them. See [ADR 003](../adr/003-drop-env-support.md).
* **Required:** No
* **Type:** `String`

#### `llm.hosts[].isLocal`

* **Description:** Overrides Musebot's automatic local-host detection. When
  `true`, the host gets model lifecycle management (on supported platforms);
  when `false`, the host is treated as remote and its models are never
  unloaded. Automatic detection: `localhost`/`127.*`/`::1` are local; other
  hostnames are DNS-resolved and considered local when they resolve to an
  RFC 1918 address (`10/8`, `172.16/12`, `192.168/16`), the Tailscale CGNAT
  range (`100.64/10`), link-local (`169.254/16`), IPv6 unique-local
  (`fc00::/7`), or IPv6 link-local (`fe80::/10`). Unresolvable hostnames are
  conservatively treated as local.
* **Required:** No
* **Type:** `Boolean`

#### `llm.models`

* **Description:** The LLM(s) to use. A random one will be selected for each
  request. Entries may be plain model-name strings, or objects that declare
  which inputs and outputs each model supports:

  ```jsonc
  "llm": {
    "models": [
      "gemma4-12b-qat",
      {
        "name": "gemma4-12b-qat",
        "inputModalities": ["text", "image"],
        "outputModalities": ["text"]
      }
    ]
  }
  ```

  Modality values are **case-insensitive** and may be `text`, `image`,
  `video`, or `audio`; both arrays default to `["text"]` when omitted. A model
  declared with `image` input enables the Vision feature directly; otherwise
  Musebot detects vision from the host (Ollama via `/api/show`, other hosts
  via their `/models` catalog when available). Configured modalities always
  win over host detection.
  See [Vision](../chat/01-llm.md#vision) for details.
* **Required:** No
* **Type:** `Array<string | { name: String, inputModalities?: Modality[], outputModalities?: Modality[] }>`

#### `llm.systemPrompt`

* **Description:** A custom system prompt to give the LLM a specific persona or
  context. The bot also automatically uses the current Discord channel's topic
  as part of its system prompt, so it's aware of the conversation's context.
  Can be either a string or an array of strings. If an array is provided, the
  entries are joined with newlines to form a single prompt — useful for breaking
  up large system prompts into legible sections.
* **Required:** No
* **Type:** `String` or `String[]`

#### `llm.streamsResponse`

* **Description:** If `true`, the bot will stream the LLM's response
  token-by-token, appearing as if it's typing in real-time. This provides a more
  natural user experience but can be less stable. **Note:** This is an
  experimental feature.
* **Required:** No
* **Type:** `Boolean`
* **Default:** `false`
* **Values:** `true`, `false`

#### `llm.embeddingModel`

* **Description:** The name of a model to use for generating text embeddings.
  When set, long-term memory (LTM) is enabled — Musebot will store
  conversation messages as vector embeddings and retrieve relevant context from
  past conversations to augment the LLM's prompt. See
  [Long-Term Memory](../chat/02-long-term-memory.md) for details.
* **Required:** No
* **Type:** `String`
* **Default:** *(unset — LTM disabled)*

#### `llm.embeddingInputLimit`

* **Description:** The chunk size in characters for embedding inputs (Musebot
  embeds serialized conversation rows for long-term memory). Inputs longer
  than the limit are split into chunks, each chunk is embedded separately,
  and the resulting chunk vectors are pooled (averaged) into a single stored
  embedding — inputs are never truncated. Retrieval for oversized inputs
  matches their overall gist rather than individual chunk precision. There is
  no standard way to query an embedding server's maximum input size, so keep
  this within limits your embedding server accepts for a single input. Only
  applies when `llm.embeddingModel` is set.
* **Required:** No
* **Type:** `Integer`
* **Default:** `2000`

#### `llm.topK`

* **Description:** The number of similar memories to retrieve from the vector
  store when augmenting the LLM prompt. Only applies when
  `llm.embeddingModel` is set. Higher values provide more context at the cost
  of prompt length and latency.
* **Required:** No
* **Type:** `Integer`
* **Default:** `5`

#### `llm.contextWindow`

* **Description:** The maximum context window (in tokens) for the LLM, used to
  decide when conversation context compression triggers. When unset, Musebot
  probes the host for the model's context length — Ollama via `/api/show`,
  llama.cpp router and most other OpenAI-compatible hosts via their `/models`
  catalog — and falls back to `4096` if the probe fails or returns nothing.
  A manually set value always wins over the probe.
  See [Context Compression](../chat/01-llm.md#context-compression) for details.
* **Required:** No
* **Type:** `Integer`
* **Default:** *(unset — probe the host, otherwise 4096)*

#### `llm.contextCompressionThreshold`

* **Description:** The threshold, as a fraction of the context window, at which
  Musebot compresses the conversation context into a summary. For example,
  `0.75` means compression triggers when the token count reaches 75% of the
  window.
* **Required:** No
* **Type:** `Number`
* **Default:** `0.75`

### **Media Mode (ComfyUI/SwarmUI) Settings**

*Required if `mode=media`*

#### `comfyUi.hosts`

* **Description:** An array of URLs of your ComfyUI/SwarmUI backend(s). For SwarmUI,
  this is typically `http://localhost:7801/ComfyBackendDirect`. Supports
  multiple URLs for redundancy or load balancing.
* **Required:** Yes
* **Type:** `String[]`

#### `comfyUi.timeoutMinutes`

* **Description:** The maximum duration in minutes that a single ComfyUI render
  task is allowed to run before it is aborted. When the timeout elapses, Musebot
  interrupts the ComfyUI workflow and disconnects the WebSocket, causing the task
  to fail and be retried (subject to `taskQueue.numAttempts`).
* **Required:** No
* **Type:** `Number`
* **Default:** `30`

#### `comfyUi.guidanceScaleInterval`

* **Description:** The interval step used when adjusting the guidance scale via
  the +/− buttons in the media generation interface.
* **Required:** No
* **Type:** `Number`
* **Default:** `0.5`

#### `multiModal.randomPrompts`

* **Description:** If *both* an LLM host and ComfyUI/SwarmUI are configured,
  this provides an array of prompt strings used by the "Randomize" button in
  the media generation interface. One will be chosen at random for the user.
* **Required:** No
* **Type:** `String[]`
* **Default:** `["Describe something or someone with extraordinary detail."]`

---

### **Task Queue & Error Handling**

#### `taskQueue.numAttempts`

* **Description:** The maximum number of times a failed task (e.g., a request to
  an LLM host or ComfyUI) will be retried before it is marked as a permanent
  failure.
  Can be set globally in `global.taskQueue` or overridden per-bot.
* **Required:** No
* **Type:** `Integer`
* **Default:** `10`

#### `taskQueue.retryDelayMs`

* **Description:** The delay in milliseconds between task retries. Increasing
  this can be helpful if the AI backend is under heavy load.
  Can be set globally in `global.taskQueue` or overridden per-bot.
* **Required:** No
* **Type:** `Integer`
* **Default:** `1000`

#### `taskQueue.strategy`

* **Description:** Determines if tasks are executed in `serial` (one after the
  other) or `parallel` (at the same time). Use `parallel` only if your hardware
  (e.g., multiple GPUs) and host configuration support it. For example, running
  an LLM host and ComfyUI on the same machine with one GPU will likely cause
  conflicts in `parallel` mode.
  Can be set globally in `global.taskQueue` or overridden per-bot.
* **Required:** No
* **Type:** `String`
* **Default:** `serial`
* **Values:** `serial`, `parallel`

#### `taskQueue.forceSerialAcrossHosts`

* **Description:** If `true`, forces serial execution across all hosts even when
  the strategy is `parallel`.
  Can be set globally in `global.taskQueue` or overridden per-bot.
* **Required:** No
* **Type:** `Boolean`
* **Default:** `false`
