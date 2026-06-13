# Musebot

![Musebot Logo](docs/images/musebot.jpg)

Musebot is a self-hosted Discord bot that bridges generative AI systems into
Discord. It connects to **Ollama** for LLM-powered conversation and
**ComfyUI/SwarmUI** for media generation (images, video, audio, music) — all
running on your own hardware, no external APIs required.

## Features

- **Chat Mode** — Context-aware LLM conversations via Ollama, with streaming
  support, multi-model selection, and custom system prompts
- **Media Mode** — Generate images, video, audio, and music from text or image
  prompts via ComfyUI/SwarmUI workflows
- **Multi-Instance** — Run multiple bot instances (chat, media, or both) from a
  single configuration file
- **Interactive Controls** — Discord buttons for retry, randomize, expand
  prompt, and guidance scale adjustments on generated media
- **Extensible Workflows** — Customize and swap ComfyUI workflow JSON files at
  runtime without code changes
- **Task Queue** — Configurable serial or parallel execution with automatic
  retries and load balancing across multiple hosts

## Prerequisites

- **Node.js** 24+ (for development) or a pre-built binary (for production)
- **For Chat Mode:** [Ollama](https://ollama.com/) with at least one model
  downloaded (e.g., `ollama pull mistral-nemo`)
- **For Media Mode:** [ComfyUI](https://github.com/comfyanonymous/ComfyUI) or
  [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) with a ComfyUI
  backend

## Quick Start

### Download & Install

1. Download the
   [latest Musebot release](https://discord.com/channels/198965819978416128/1342750267749302362).
2. Extract the files into a new directory.
3. Copy `config.example.jsonc` to `config.jsonc` and edit it (see
   [Configuration](#configuration) below).

### Running

**Linux:**

```bash
chmod +x musebot-linux-x86_64
./musebot-linux-x86_64
```

**Windows:**

Double-click `musebot-win-x86_64.exe` or run it from a terminal.

**Docker:**

```bash
docker compose up -d
```

See [Docker](#docker) below for details.

### Development

```bash
npm install
npm start
```

A debugging configuration is provided for Visual Studio Code.

## Configuration

Musebot is configured via `config.jsonc` (JSON with comments). Copy
`config.example.jsonc` to get started — it contains every option with inline
documentation.

### Minimal Chat Bot

```jsonc
{
  "bots": [
    {
      "botId": "chat-bot",
      "mode": "chat",
      "chatApis": {
        "discord": {
          "token": "YOUR_DISCORD_BOT_TOKEN"
        }
      },
      "ollama": {
        "hosts": ["http://localhost:11434"],
        "models": ["mistral-nemo"]
      }
    }
  ]
}
```

### Minimal Media Bot

```jsonc
{
  "bots": [
    {
      "botId": "media-bot",
      "mode": "media",
      "chatApis": {
        "discord": {
          "token": "YOUR_DISCORD_BOT_TOKEN"
        }
      },
      "comfyUi": {
        "hosts": ["http://localhost:8188"]
      }
    }
  ]
}
```

### Key Settings

| Setting | Description |
| --- | --- |
| `mode` | `"chat"` for LLM conversation, `"media"` for media generation |
| `chatApis.discord.token` | Bot token from the [Discord Developer Portal](https://discord.com/developers/applications) |
| `chatApis.discord.channels` | Allowed channel IDs (empty = all channels) |
| `ollama.hosts` | Ollama API URLs (required for chat mode) |
| `ollama.models` | LLM model names to use |
| `ollama.systemPrompt` | Custom system prompt (string or string array) |
| `comfyUi.hosts` | ComfyUI/SwarmUI API URLs (required for media mode) |
| `requiresMention` | Require @mention to respond (default: `true`) |
| `taskQueue.strategy` | `"serial"` or `"parallel"` execution (default: `"serial"`) |

For the full configuration reference, see
[`config.example.jsonc`](config.example.jsonc) or the
[Configuration docs](docs/musebot/02-configuration.md).

## Docker

The included `docker-compose.yml` mounts your configuration and workflows:

```yaml
services:
  musebot:
    container_name: musebot
    build: .
    restart: unless-stopped
    volumes:
      - ./config.jsonc:/app/config.jsonc
      - ./workflows:/app/workflows
```

For production deployment with multiple bot instances, see
`docker-compose.prod.yml`.

## Workflows

ComfyUI workflow JSON files live under the `workflows/` directory and are
organized by generation type (`txt2img/`, `img2img/`, `txt2vid/`, etc.). These
can be customized or replaced at runtime without code changes — just drop in
new workflow JSON files and restart.

## Documentation

Full end-user documentation is available online at [musebot.docs.xcjs.com](https://musebot.docs.xcjs.com/) or in the
[docs](docs/introduction.md) directory, including:

- [Configuration Reference](docs/musebot/02-configuration.md)
- [Ollama Integration](docs/chat/01-ollama.md)
- [ComfyUI/SwarmUI Integration](docs/media/01-swarm-ui.md)
- [Migration from .env to config.jsonc](docs/musebot/03-migration-from-env-to-jsonc.md)

## License

AGPL-3.0 — see [LICENSE](LICENSE).
