# Configuration

Musebot is configured through JSON-based configuration files (`config.json` or
`config.jsonc`). This is the modern, standardized configuration format with
excellent IDE support (autocomplete, validation, formatting).

**Note on Configuration Loading:**

Musebot loads the configuration file from its current working directory at
startup. Changes to this file will **not** take effect while the bot is running.
You must restart the bot for any changes to be applied.

## **Migration from Environment Variables**

If you were previously using `.env` files with `MUSEBOT_*` environment
variables, you need to migrate to JSON configuration. See [Migration Guide](./03-migration-from-env-to-jsonc.md) for detailed instructions on how to migrate your configuration.

### **Core Configuration**

#### `nodeEnvironment`

* **Description:** The operating environment for the Node.js runtime.
* **Required:** No
* **Type:** `String`
* **Default:** `production`
* **Values:** `production`, `development`

#### `mode`

* **Description:** **The core operating mode** of the bot. This determines which
  integrations are active. If set to `chat`, Ollama must be configured. If set
  to `media`, ComfyUI/SwarmUI must be configured.
* **Required:** Yes
* **Type:** `String`
* **Values:** `chat`, `media`

---

### **Discord Configuration**

#### `discord.token`

* **Description:** The authentication token for your bot, obtained from the
  [Discord Developer Portal](https://discord.com/developers/applications).
* **Required:** Yes
* **Type:** `String`

#### `discord.channels`

* **Description:** An array of **allowed** channel IDs. The bot
  will *only* respond in these channels. If left empty, all channels are
  allowed.
* **Required:** No
* **Type:** `String[]`

#### `discord.channelsDisallowed`

* **Description:** An array of **disallowed** channel IDs. The bot
  will *never* respond in these channels, even if they are in
  `discord.channels`.
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

### **Chat Mode (Ollama) Settings**

*Required if `mode=chat`*

#### `ollama.hosts`

* **Description:** An array of URLs of your Ollama instance(s). You can specify
  multiple URLs for load balancing.
* **Required:** Yes
* **Type:** `String[]`

#### `ollama.models`

* **Description:** An array of LLM names to use. A random one will be selected
  for each request to the Ollama backend.
* **Required:** No
* **Type:** `String[]`

#### `ollama.systemPrompt`

* **Description:** A custom system prompt to give the LLM a specific persona or
  context. The bot also automatically uses the current Discord channel's topic
  as part of its system prompt, so it's aware of the conversation's context.
  Can be either a string or an array of strings. If an array is provided, the
  entries are joined with newlines to form a single prompt — useful for breaking
  up large system prompts into legible sections.
* **Required:** No
* **Type:** `String` or `String[]`

#### `ollama.streamsResponse`

* **Description:** If `true`, the bot will stream the LLM's response
  token-by-token, appearing as if it's typing in real-time. This provides a more
  natural user experience but can be less stable. **Note:** This is an
  experimental feature.
* **Required:** No
* **Type:** `Boolean`
* **Default:** `false`
* **Values:** `true`, `false`

### **Media Mode (ComfyUI/SwarmUI) Settings**

*Required if `mode=media`*

#### `comfyUi.hosts`

* **Description:** An array of URLs of your ComfyUI/SwarmUI backend(s). For SwarmUI,
  this is typically `http://localhost:7801/ComfyBackendDirect`. Supports
  multiple URLs for redundancy or load balancing.
* **Required:** Yes
* **Type:** `String[]`

#### `comfyUiGuidanceScaleInterval`

* **Description:** The interval step used when adjusting the guidance scale via
  the +/− buttons in the media generation interface.
* **Required:** No
* **Type:** `Number`
* **Default:** `0.5`

#### `comfyUiOllamaPrompts`

* **Description:** If *both* Ollama and ComfyUI/SwarmUI are configured, this
  provides an array of prompt strings used by the "Randomize" button in the media
  generation interface. One will be chosen at random for the user.
* **Required:** No
* **Type:** `String[]`
* **Default:** `["Describe something or someone with extraordinary detail."]`

---

### **Task Queue & Error Handling**

#### `taskQueue.numAttempts`

* **Description:** The maximum number of times a failed task (e.g., a request to
  Ollama or ComfyUI) will be retried before it is marked as a permanent failure.
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
  Ollama and ComfyUI on the same host with one GPU will likely cause conflicts
  in `parallel` mode.
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
