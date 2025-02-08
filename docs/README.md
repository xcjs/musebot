# Musebot

Musebot is an interactive chat bot designed for use in the Discord chat service.

The goal of Musebot is to bring self-hosted generative AI solutions to Discord
as entertainment or to aid in creative processes.

Musebot currently supports the following generative AI solutions:

* [Comfy UI](https://www.comfy.org/)
* [Swarm UI](https://github.com/Stability-AI/StableSwarmUI)
* [Ollama](https://ollama.com/)

Please refer to the respective documentation provided by these projects for
installation and configuration.

## Installation

Musebot is provided as a single-file application with no external dependencies
except for those built into your operating system.

Musebot currently supports the following operating systems and architectures.
Your download should include an application for each supported configuration:

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
   Double-clicking on it may work.

### Bot Registration

Before starting Musebot, ensure that you've registered an application with
Discord.

1. Using your web browser, navigate to the
   [Discord Developer Portal](https://discord.com/developers/applications).
2. Login to the Discord account associated with the Discord server you want to
   add Musebot to.
3. Click `New Application` in the upper right hand corner and name your
   application. It does not need to be "Musebot", but can be any character or
   concept you desire. Agree to Discord's terms by checking the box.
4. Name your application, add a profile image, and save your changes. Provide a
   Provide a description if you want.
5. Save your changes.
6. Click the `Bot` link in the left navigation menu.
7. If you want to limit your bot to only your Discord server, disable the toggle
   titled `Public Bot`.
8. Enable the `Server Members Intent` toggle.
9. Enable the `Message Content Intent` toggle.
10. Save your changes.
11. Click the `OAuth2` link in the left navigation menu.
12. Under the `OAuth2 URL Generator` in the `Scopes` checklist, check `Bot`.
13. In the `Bot Permissions` checklist, check the following checkboxes:

    * Read Messages/View Channels
    * Send Messages
    * Read Message History
14. Copy the generated link at the bottom of the page and paste it into a new
    browser tab. You will be asked to login and/or confirm the bot and its
    requested permissions.
15. Return to the tab where you configured your Discord application.
16. Click on `Bot` in the left navigation menu.
17. Optionally set a banner and save it.
18. Click the `Reset Token` button. This will create or reset your token. This
    is required for the `MUSEBOT_DISCORD_TOKEN` environment variable.

### Lookup Discord Channel IDs

If you decide to restrict Musebot to a single or subset of channels, follow
these steps:

1. In Discord, go to `User Settings` » `Advanced` » `Enable Developer Mode`.
2. Right click on a channel for Musebot to use and click `Copy Channel ID`.
3. Add the channel ID(s) to the `MUSEBOT_DISCORD_CHANNELS` environment variable.
