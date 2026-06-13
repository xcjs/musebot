# Migration Guide: From .env to config.jsonc

This guide will help you migrate from using environment variables (`.env` file) to the new JSON-based configuration system (`config.json` or `config.jsonc`).

## Overview

**What's changing:**
- All configuration is now via `config.json` (preferred) or `config.jsonc` (with comments support)
- `.env` file support has been removed from the codebase
- Configuration is validated at startup with clear error messages

**Why the change:**
- Single configuration format reduces complexity
- Better IDE support (autocomplete, validation, formatting)
- Easier to document and understand
- Less risk of accidentally committing secrets

## Migration Steps

### Step 1: Remove .env File

1. Delete your existing `.env` file from your project directory
2. Remove any `.env.example` file you may have

```bash
rm .env
rm .env.example
```

### Step 2: Create config.jsonc

Create a new `config.jsonc` file in your project root. You can use `config.json` as well, but `config.jsonc` allows comments which makes it easier to edit.

#### Minimal Example (Chat Mode)

```jsonc
{
  "global": {
    "taskQueue": {
      "numAttempts": 10,
      "retryDelayMs": 1000,
      "strategy": "serial",
      "forceSerialAcrossHosts": false
    }
  },
  "bots": [
    {
      "botId": "bot-1",
      "nodeEnvironment": "production",
      "mode": "chat",
      "requiresMention": true,
      "responseRate": 100,
      "chatApis": {
        "discord": {
          "token": "YOUR_DISCORD_BOT_TOKEN_HERE",
          "channels": ["YOUR_CHANNEL_ID_1"],
          "privateMessageUsers": ["USER_ID_1"]
        }
      },
      "ollama": {
        "hosts": ["http://localhost:11434"],
        "models": ["llama2", "mistral"],
        "systemPrompt": "You are a helpful assistant",
        "streamsResponse": false
      },
      "comfyUi": {
        "hosts": []
      },
      "comfyUiGuidanceScaleInterval": 0.5,
      "multiModal": {
        "randomPrompts": []
      }
    }
  ]
}
```

#### Minimal Example (Media Mode)

```jsonc
{
  "global": {
    "taskQueue": {
      "numAttempts": 10,
      "retryDelayMs": 1000,
      "strategy": "serial",
      "forceSerialAcrossHosts": false
    }
  },
  "bots": [
    {
      "botId": "bot-1",
      "nodeEnvironment": "production",
      "mode": "media",
      "requiresMention": true,
      "responseRate": 100,
      "chatApis": {
        "discord": {
          "token": "YOUR_DISCORD_BOT_TOKEN_HERE",
          "channels": ["YOUR_CHANNEL_ID_1"],
          "privateMessageUsers": ["USER_ID_1"]
        }
      },
      "ollama": {
        "hosts": ["http://localhost:11434"],
        "models": [],
        "systemPrompt": "You are a helpful assistant",
        "streamsResponse": false
      },
      "comfyUi": {
        "hosts": ["http://localhost:8188"]
      },
      "comfyUiGuidanceScaleInterval": 0.5,
      "multiModal": {
        "randomPrompts": []
      }
    }
  ]
}
```

### Step 3: Map .env Variables to config.jsonc

| .env Variable (Old) | config.jsonc Property (New) | Type | Required |
|---------------------|-----------------------------|------|----------|
| `MUSEBOT_FUNCTION` | `bots[].mode` | enum | Yes |
| `MUSEBOT_DISCORD_TOKEN` | `bots[].chatApis.discord.token` | string | Yes |
| `MUSEBOT_DISCORD_CHANNELS` | `bots[].chatApis.discord.channels` | string[] | No |
| `MUSEBOT_DISCORD_CHANNELS_DISALLOWED` | `bots[].chatApis.discord.channelsDisallowed` | string[] | No |
| `MUSEBOT_REQUIRES_MENTION` | `bots[].requiresMention` | boolean | No |
| `MUSEBOT_RESPONSE_RATE` | `bots[].responseRate` | number | No |
| `MUSEBOT_PRIVATE_MESSAGE_USERS` | `bots[].chatApis.discord.privateMessageUsers` | string[] | No |
| `MUSEBOT_ERROR_MESSAGE` | `bots[].errorMessage` | string | No |
| `MUSEBOT_OLLAMA_HOSTS` | `bots[].ollama.hosts` | string[] | Yes (chat mode) |
| `MUSEBOT_OLLAMA_MODELS` | `bots[].ollama.models` | string[] | No (chat mode) |
| `MUSEBOT_OLLAMA_SYSTEM_PROMPT` | `bots[].ollama.systemPrompt` | string or string[] | No |
| `MUSEBOT_OLLAMA_STREAMS_RESPONSE` | `bots[].ollama.streamsResponse` | boolean | No |
| `MUSEBOT_STABLE_DIFFUSION_HOSTS` | `bots[].comfyUi.hosts` | string[] | Yes (media mode) |
| `MUSEBOT_STABLE_DIFFUSION_GUIDANCE_SCALE_INTERVAL` | `bots[].comfyUiGuidanceScaleInterval` | number | No |
| `MUSEBOT_STABLE_DIFFUSION_OLLAMA_PROMPTS` | `bots[].multiModal.randomPrompts` | string[] | No |
| `MUSEBOT_MAX_TASK_ATTEMPTS` | `global.taskQueue.numAttempts` / `bots[].taskQueue.numAttempts` | number | No |
| `MUSEBOT_TASK_RETRY_DELAY_MILLISECONDS` | `global.taskQueue.retryDelayMs` / `bots[].taskQueue.retryDelayMs` | number | No |
| `MUSEBOT_TASK_QUEUE_STRATEGY` | `global.taskQueue.strategy` / `bots[].taskQueue.strategy` | enum | No |
| `MUSEBOT_TASK_QUEUE_FORCE_SERIAL_ACROSS_HOSTS` | `global.taskQueue.forceSerialAcrossHosts` / `bots[].taskQueue.forceSerialAcrossHosts` | boolean | No |

**Notes:**
- `MUSEBOT_OLLAMA_SYSTEM_PROMPT` can be a `string` or `string[]`. When an array is provided, the entries are joined with newlines to form a single prompt. This allows large system prompts to be broken into multiple strings for legibility:
  ```jsonc
  "systemPrompt": [
    "You are a helpful assistant.",
    "Always be concise and clear.",
    "Never hallucinate information."
  ]
  ```
  This is equivalent to: `"You are a helpful assistant.\nAlways be concise and clear.\nNever hallucinate information."`
- `MUSEBOT_MAX_TASK_ATTEMPTS`, `MUSEBOT_TASK_RETRY_DELAY_MILLISECONDS`, `MUSEBOT_TASK_QUEUE_STRATEGY`, and `MUSEBOT_TASK_QUEUE_FORCE_SERIAL_ACROSS_HOSTS` can be set globally in `global.taskQueue` or overridden per-bot in `bots[].taskQueue`.

### Step 4: Verify Configuration

1. Start the bot:
```bash
npm start
```

2. If there are any issues, you'll see a clear error message with guidance on what's wrong.

**Common validation errors:**

- **Media mode missing ComfyUI hosts:**
```
Error: Media mode requires at least one ComfyUI host configured in bot.comfyUi.hosts.
```

- **Chat mode missing Ollama hosts:**
```
Error: Chat mode requires at least one Ollama host configured in bot.ollama.hosts.
```

- **Environment variables detected:**
```
[FATAL ERROR] .env support has been removed. Please migrate all environment variables to config.jsonc format.

Migration guide: docs/migration-from-env-to-jsonc.md

Detected environment variables: MUSEBOT_FUNCTION, MUSEBOT_DISCORD_TOKEN
```

### Step 5: Update Development Environment

If you're using Docker:

1. Update your `docker-compose.yml` to use the config file instead of environment variables:
```yaml
services:
  musebot:
    build: .
    volumes:
      - .:/app
      - ./workflows:/app/workflows
    environment:
      - NODE_ENV=production
```

No environment variables needed anymore!

If you're running directly:

```bash
# Node.js
node dist/app.js

# Or if using pkg binary
./build/pkg/musebot.cjs
```

## Complete Configuration Reference

For a comprehensive reference on all configuration options, see: [Configuration](./02-configuration.md)

## Troubleshooting

### Bot won't start

1. Check that `config.jsonc` exists in the project root
2. Verify the JSON syntax is valid (no missing commas or brackets)
3. Check that `nodeEnvironment`, `botId`, `mode`, and required host fields are set
4. Look at the error message - it should guide you to what's wrong

### Mode mismatch errors

- If you get "Chat mode requires Ollama hosts" - ensure `bots[].ollama.hosts` has at least one entry when `mode` is `chat`
- If you get "Media mode requires ComfyUI hosts" - ensure `bots[].comfyUi.hosts` has at least one entry when `mode` is `media`

### Environment variable still being picked up

This shouldn't happen anymore, but if you see the FATAL ERROR with detected `MUSEBOT_*` variables, ensure:
1. No `.env` file exists in your project
2. No `MUSEBOT_*` environment variables are set in your shell or deployment system

### Missing required properties

Check that all properties defined in your `mode` (chat or media) are present:
- **Chat mode**: `ollama.hosts` and `discord.token`
- **Media mode**: `comfyUi.hosts` and `discord.token`

## Support

If you encounter issues during migration:

1. Check the error message - it should be very specific about what's wrong
2. Review the examples in `config.example.jsonc` as a reference
3. Consult [Configuration](./02-configuration.md) for detailed configuration documentation
4. Open an issue on the project repository