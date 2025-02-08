# Musebot

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

## 1. System Installation

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
4. Continue to Bot Registration.
5. Execute `./musebot-linux-x86_64`

### Mac OS X

1. Extract musebot wherever fits your use case or environment.
2. Ensure that musebot is set as executable.

   `musebot-macos-x86_64`
3. Configure Musebot using the provided `.env` file and place it in the same
   directory as the Musebot executable. The `.env` file is documented to explain
   the use case of each provided environment variable.
4. Continue to Bot Registration.
5. Execute `./musebot-macos-x86_64`

### Windows

1. Extract musebot wherever fits your use case or environment.
2. Configure Musebot using the provided `.env` file and place it in the same
   directory as the Musebot executable. The `.env` file is documented to explain
   the use case of each provided environment variable.
3. Continue to Bot Registration.
4. Execute `./musebot-win-x86_64.exe` from the Command Prompt or Powershell.
   Double-clicking on it may also work, but isn't recommended.

## 2. Discord Configuration

Refer to the included [Discord](Integrations/Discord.md) documentation.

## 3. AI API Configuration

### Image Generation

#### ComfyUI

Refer to the included [ComfyUI](Integrations/ComfyUI.md) documentation.

#### SwarmUI

Refer to the included [SwarmUI](Integrations/SwarmUI.md) documentation.

### Large Language Model Inferencing

#### Ollama

Refer to the included [Ollama](Integrations/Ollama.md) documentation.
