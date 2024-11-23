# Musebot

Musebot is an interactive chat bot designed for use in the Discord chat service.

The goal of Musebot is to bring self-hosted generative AI solutions to Discord
as entertainment or to aid in creative processes.

Musebot currently supports the following generative AI solutions:

* [EasyDiffusion](https://easydiffusion.github.io/) - Deprecated, partial support for new features.
* [Automatic1111/Stable Diffusion Web UI](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
* [Forge UI](https://github.com/lllyasviel/stable-diffusion-webui-forge)
* [Ollama](https://ollama.com/)

Please refer to the respective documentation provided by these projects for
installation and configuration.

## Installation

Musebot is provided as a single-file application with no external dependencies
except for those built into your operating system.

Musebot currently supports the following operating systems and architectures:

| Operating System | Architectures |
| ---------------- | --------------|
| Linux            | x86_64        |
| Windows          | x86_64        |
| Mac OS X         | x86_64        |

## Linux

1. Extract musebot wherever fits your use case or environment.
2. Ensure that musebot is set as executable.

   `chmod +x musebot`
3. Rename `.env.example` to `.env`.
4. Configure Musebot using the provided `.env` file and place it in the same
   directory as the Musebot executable. The `.env` file is documented to explain
   the use case of each provided environment variable.
5. Continue to Bot Registration.

## Bot Registration

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

## Lookup Discord Channel IDs

If you decide to restrict Musebot to a single or subset of channels, follow
these steps:

1. In Discord, go to `User Settings` » `Advanced` » `Enable Developer Mode`.
2. Right click on a channel for Musebot to use and click `Copy Channel ID`.
3. Add the channel ID(s) to the `MUSEBOT_DISCORD_CHANNELS` environment variable.

## Start Musebot

1. After installation and registration are complete, open a terminal and
   run `./musebot`.
2. If you wish to run Musebot as a system service, there are several
   recommendations:

   * Add Musebot to a Docker container.
   * Or create a systemd service for Musebot.

   Additional runtime options may be provided at a later date.
