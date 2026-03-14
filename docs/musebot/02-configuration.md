# Configuration

## **Environment Variables Reference**

Musebot is configured entirely through environment variables defined in a `.env`
file. This file is plain text and uses the `KEY=value` format. A comprehensive
template, `.env.example`, is provided in the main distribution. Rename this file
to `.env` and fill in the required values for your setup.

**Note on Configuration Loading:**

Musebot loads the `.env` file from its current working directory at startup.
Changes to this file will **not** take effect while the bot is running. You must
restart the bot for any changes to be applied.

### **Core Configuration**

#### `NODE_ENV`

* **Description:** The operating environment for the Node.js runtime.
* **Required:** No
* **Type:** `String`
* **Default:** `production`
* **Values:** `production`, `development`

#### `MUSEBOT_FUNCTION`

* **Description:** **The core operating mode** of the bot. This determines which
  integrations are active. If set to `chat`, Ollama must be configured. If set
  to `media`, ComfyUI/SwarmUI must be configured.
* **Required:** Yes
* **Type:** `String`
* **Values:** `chat`, `media`

---

### **Discord Configuration**

#### `MUSEBOT_DISCORD_TOKEN`

* **Description:** The authentication token for your bot, obtained from the
  [Discord Developer Portal](https://discord.com/developers/applications).
* **Required:** Yes
* **Type:** `String`

#### `MUSEBOT_DISCORD_CHANNELS`

* **Description:** A comma-separated list of **allowed** channel IDs. The bot
  will *only* respond in these channels. If left blank, all channels are
  allowed.
* **Required:** No
* **Type:** `Integer` or `Integer,Integer,...`

#### `MUSEBOT_DISCORD_CHANNELS_DISALLOWED`

* **Description:** A comma-separated list of **disallowed** channel IDs. The bot
  will *never* respond in these channels, even if they are in
  `MUSEBOT_DISCORD_CHANNELS`.
* **Required:** No
* **Type:** `Integer` or `Integer,Integer,...`

#### `MUSEBOT_REQUIRES_MENTION`

* **Description:** If `true`, the bot will only respond when it is mentioned in
  a message (e.g., `@Musebot help`).
* **Required:** No
* **Type:** `Boolean`
* **Default:** `true`
* **Values:** `true`, `false`

#### `MUSEBOT_RESPONSE_RATE`

* **Description:** If `MUSEBOT_REQUIRES_MENTION` is `false`, this sets the
  percentage chance (0-100) the bot will respond to a public message. A value of
  `50` means it responds to roughly half of the messages.
* **Required:** No
* **Type:** `Integer`
* **Default:** `100`
* **Values:** `1-100`

#### `MUSEBOT_PRIVATE_MESSAGE_USERS`

* **Description:** A comma-separated list of Discord usernames (case-sensitive!)
  who are allowed to send the bot private messages. *Note:* This is the
  username, not the display name.
* **Required:** No
* **Type:** `String` or `String,String,...`

#### `MUSEBOT_ERROR_MESSAGE`

* **Description:** A custom message to display when a task (like media
  generation) fails. If not set, a generic error message is displayed.
* **Required:** No
* **Type:** `String`
* **Default:** `An error occurred while generating a response. Please try again
  later.`

### **Chat Mode (Ollama) Settings**

*Required if `MUSEBOT_FUNCTION=chat`*

#### `MUSEBOT_OLLAMA_HOSTS`

* **Description:** The URL(s) of your Ollama instance(s). You can specify
  multiple URLs for load balancing by separating them with commas (e.g.,
  `http://host1:11434/,http://host2:11434/`).
* **Required:** Yes
* **Type:** `URL` or `URL,URL,...`

#### `MUSEBOT_OLLAMA_MODELS`

* **Description:** The name(s) of the LLM(s) to use. You can list multiple
  models (comma-separated); a random one will be selected for each request to
  the Ollama backend.
* **Required:** Yes
* **Type:** `String` or `String,String,...`

#### `MUSEBOT_OLLAMA_SYSTEM_PROMPT`

* **Description:** A custom system prompt to give the LLM a specific persona or
  context. The bot also automatically uses the current Discord channel's topic
  as part of its system prompt, so it's aware of the conversation's context.
* **Required:** No
* **Type:** `String`

#### `MUSEBOT_OLLAMA_STREAMS_RESPONSE`

* **Description:** If `true`, the bot will stream the LLM's response
  token-by-token, appearing as if it's typing in real-time. This provides a more
  natural user experience but can be less stable. **Note:** This is an
  experimental feature.
* **Required:** No
* **Type:** `Boolean`
* **Default:** `false`
* **Values:** `true`, `false`

### **Media Mode (ComfyUI/SwarmUI) Settings**

*Required if `MUSEBOT_FUNCTION=media`*

#### `MUSEBOT_STABLE_DIFFUSION_HOSTS`

* **Description:** The URL(s) of your ComfyUI/SwarmUI backend(s). For SwarmUI,
  this is typically `http://localhost:7801/ComfyBackendDirect`. Supports
  multiple URLs for redundancy or load balancing.
* **Required:** Yes
* **Type:** `URL` or `URL,URL,...`

---

### **Task Queue & Error Handling**

#### `MUSEBOT_TASK_QUEUE_MAX_ATTEMPTS`

* **Description:** The maximum number of times a failed task (e.g., a request to
  Ollama or ComfyUI) will be retried before it is marked as a permanent failure.
* **Required:** No
* **Type:** `Integer`
* **Default:** `10`

#### `MUSEBOT_TASK_QUEUE_RETRY_DELAY_MS`

* **Description:** The delay in milliseconds between task retries. Increasing
  this can be helpful if the AI backend is under heavy load.
* **Required:** No
* **Type:** `Integer`
* **Default:** `1000`

#### `MUSEBOT_TASK_QUEUE_STRATEGY`

* **Description:** Determines if tasks are executed in `serial` (one after the
  other) or `parallel` (at the same time). Use `parallel` only if your hardware
  (e.g., multiple GPUs) and host configuration support it. For example, running
  Ollama and ComfyUI on the same host with one GPU will likely cause conflicts
  in `parallel` mode.
* **Required:** No
* **Type:** `String`
* **Default:** `serial`
* **Values:** `serial`, `parallel`

### **Cross-Integration Features**

#### `MUSEBOT_STABLE_DIFFUSION_OLLAMA_PROMPTS`

* **Description:** If *both* Ollama and ComfyUI/SwarmUI are configured, this
  provides the prompt text used by the "Randomize" button in the media
  generation interface. You can provide multiple prompts separated by a pipe
  (`|`), and one will be chosen at random for the user.
* **Required:** No
* **Type:** `String` or `String|String|...`
* **Default:** `Describe something or someone with extraordinary detail.`
