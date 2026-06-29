# Introduction

## What is Musebot?

![Musebot Logo](images/musebot.jpg)

Musebot is a powerful, self-hosted Discord bot that acts as a bridge to
generative AI systems. It transforms your Discord server into an interactive
platform for two distinct modes of creativity:

* **Chat Function** leverages local large language models (via Ollama) for
  context-aware conversations, with optional **long-term memory**, **vision
  image interpretation**, and **web link content extraction**.
* **Media Function** connects to SwarmUI or ComfyUI to generate images, video,
  music, and other media from text or image prompts.

With its flexible architecture, extensible workflow system, and seamless Discord
integration, Musebot empowers you to bring cutting-edge AI capabilities into
your community - without relying on external APIs or cloud services.

## Download Musebot

Musebot can be purchased affordably for download from the official
[XCJS Discord](https://discord.com/channels/198965819978416128/shop).

## Quick Setup

This guide will help you get Musebot up and running with its two core
integrations: **Ollama** for chat and/or **SwarmUI/ComfyUI** for media
generation.

---

### **Step 1: Prerequisites**

Before installing Musebot, ensure you have one of the following AI backends
running:

* **For Chat Functionality:** Install and run [Ollama](https://ollama.com/).
  Download a model, for example:

    ```bash
    ollama pull gemma3
    ```

    Your Ollama instance should be running on `http://localhost:11434/` (or a
    known IP address).
* **For Media Functionality:** Install and run
  [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI).
  * Ensure the ComfyUI backend is accessible at
    `http://localhost:7801/ComfyBackendDirect`.
  * (Optional but helpful) Install Musebot's recommended custom nodes (detailed
    in the [full SwarmUI integration guide](integrations/swarm-ui.md)).
* **For Both:** Musebot can offer multimodal functionality if both the above
  solutions are available and configured. You will still select media or chat
  functionality.

---

### **Step 2: Download & Install**

1. Download the
   [latest Musebot release](https://discord.com/channels/198965819978416128/1342750267749302362).
2. Extract the files into a new, empty directory.
3. Copy `config.example.jsonc` to `config.jsonc`.

---

### **Step 3: Configure `config.jsonc`**

Edit your new `config.jsonc` file and set the following **required** properties.
See the [Configuration](musebot/02-configuration.md) reference for all options.

#### 1. Bot Mode

```jsonc
{
  "bots": [
    {
      "botId": "bot-1",
      "mode": "chat"
    }
  ]
}
```

Set `mode` to `"chat"` for LLM chat or `"media"` for media generation.

#### 2. Discord Setup

* Register your bot in the
  [Discord Developer Portal](https://discord.com/developers/applications).
* Copy your bot's token and set:

    ```jsonc
    "discord": {
      "token": "your_bot_token_here"
    }
    ```

#### 3. Configure Your Integration

* **For `mode: "chat"`:**

    ```jsonc
    "ollama": {
      "hosts": ["http://localhost:11434"],
      "models": ["gemma3"]
    }
    ```

    For optional **long-term memory**, add an embedding model:

    ```jsonc
    "ollama": {
      "hosts": ["http://localhost:11434"],
      "models": ["gemma3"],
      "embeddingModel": "nomic-embed-text"
    }
    ```

* **For `mode: "media"`:**

    ```jsonc
    "comfyUi": {
      "hosts": ["http://localhost:7801/ComfyBackendDirect"]
    }
    ```

---

#### 4. Run

##### Linux

```bash
chmod +x musebot-linux-x86_64
./musebot-linux-x86_64
```

##### Windows

* Double-click `musebot-win-x86_64.exe` or run it from PowerShell or the
  Command Prompt.

##### Docker

* See the full documentation for the `docker-compose.yml` example.

---

Your bot should now be online in your Discord server.
