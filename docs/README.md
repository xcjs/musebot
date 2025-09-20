# Musebot

![Musebot Logo](assets/images/logos/musebot.jpg)

Thanks for purchasing a copy of Musebot! I'm excited to see how people utilize
it, and I hope it brings you a lot of inspiration!

Musebot is an interactive chat bot designed for use in the Discord chat service.

The goal of Musebot is to bring self-hosted generative AI solutions to Discord
as entertainment or to aid in creative processes.

Musebot currently supports the following generative AI solutions:

* [Comfy UI](https://www.comfy.org/)
* [Swarm UI](https://github.com/Stability-AI/StableSwarmUI)
* [Ollama](https://ollama.com/)

While some documentation is included on these systems, please refer to the
respective documentation provided by these projects for basic installation and
configuration.

## Musebot Discord Instance

If you need help or support, please visit the
[XCJS Discord](https://xcjs.com/discord) instance.

## 1. Discord Configuration

Refer to the included [Discord Integration](Integrations/Discord/index.html)
documentation.

## 2. Generative AI API Configuration

While Musebot supports multiple generative AI backends, only one needs to
be configured, although you are welcome to set up more.

1. Choose the primary/only functionality you expect from Musebot by setting
   `MUSEBOT_FUNCTION` in your `.env` file. Supported values are documented for
   you and are based on the supported generative AI backends.
2. While this drives Musebot's primary functionality, additional multimodal
   features can be unlocked by configuring other backends. This is entirely
   optional.

   Only one supported backend _needs_ to be configured, but feel free to
   configure multiple based on your needs. (Ollama and/or SwarmUI/ComfyUI).

### Media Generation

#### SwarmUI

Refer to the included [SwarmUI Integration](Integrations/SwarmUI/index.html)
documentation.

#### ComfyUI

**Note:** _If you're new to ComfyUI, consider using SwarmUI instead._

Standalone ComfyUI integration (that is, without
[SwarmUI](Integrations/SwarmUI/index.html)
as a wrapper) is supported, but for more advanced users. There is no
documentation for standalone ComfyUI integration at this time.

If you need help with ComfyUI configuration for Musebot, most of the
[SwarmUI documentation](Integrations/SwarmUI/index.html) may offer some clues,
albeit with some adjustments here and there.

### Large Language Model Inferencing

#### Ollama

Refer to the included [Ollama Integration](Integrations/Ollama/index.html)
documentation.

## 3. Musebot Installation

Musebot is provided as a single-file application with no external dependencies
except for those built into your operating system.

Musebot currently supports the following operating systems and architectures.
Your download should include an application for each supported platform:

| Operating System | Architectures | File Name                |
| ---------------- | ------------- | ------------------------ |
| Docker           | x86_64        |                          |
| Linux            | x86_64        | `musebot-linux-x86_64`   |
| Windows          | x86_64        | `musebot-win-x86_64.exe` |
| Mac OS X         | x86_64        | `musebot-macos-x86_64`   |

### Docker

1. Extract musebot wherever fits your use case or environment.
2. Configure Musebot using the provided `.env` file and place it in the same
   directory as the Musebot executable. The `.env` file is documented to explain
   the use case of each provided environment variable.
3. A `docker-compose.yml` file is provided to help get you started. Feel free to
   modify it to fit your needs. Ensure that all required files are in the same
   directory as the compose file:

   * `.env`
   * `docker-compose.yml`
   * `Dockerfile`
   * `musebot-linux-x86_64`
   * `LICENSE.txt`
4. Using the extracted directory as your working directory, run
   `docker compose up -d`.

### Linux

1. Extract musebot wherever fits your use case or environment.
2. Ensure that musebot is set as executable.

   `chmod +x musebot-linux-x86_64`
3. Configure Musebot using the provided `.env` file and place it in the same
   directory as the Musebot executable. The `.env` file is documented to explain
   the use case of each provided environment variable.
4. Execute `./musebot-linux-x86_64`

### Mac OS X

1. Extract musebot wherever fits your use case or environment.
2. Ensure that musebot is set as executable.

   `musebot-macos-x86_64`
3. Configure Musebot using the provided `.env` file and place it in the same
   directory as the Musebot executable. The `.env` file is documented to explain
   the use case of each provided environment variable.
4. Execute `./musebot-macos-x86_64`

### Windows

1. Extract musebot wherever fits your use case or environment.
2. Configure Musebot using the provided `.env` file and place it in the same
   directory as the Musebot executable. The `.env` file is documented to explain
   the use case of each provided environment variable.
3. Execute `./musebot-win-x86_64.exe` from the Command Prompt or Powershell.
   Double-clicking on it may also work, but isn't recommended.
