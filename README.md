# Musebot

A Discord Bot that allows users to queue jobs for
[EasyDiffusion](https://easydiffusion.github.io/).

## Setup

1. Install [Node.js](https://nodejs.org) (if you have a package manager, use
   that instead to install this)
    - Make sure to install at least v14 of Node.js
2. Install and run [EasyDiffusion](https://easydiffusion.github.io/)
3. [Create a Discord bot](https://discord.com/developers/applications)
    - Under Application » Bot
        - Enable Message Content Intent
        - Enable Server Members Intent (for replacing user mentions with the
          username)
4. Invite the bot to a server
    1. Go to Application » OAuth2 » URL Generator
    2. Enable `bot`
    3. Enable Send Messages, Read Messages/View Channels, and Read Message
       History
    4. Under Generated URL, click Copy and paste the URL in your browser
5. Rename `.env.example` to `.env` and edit the `.env` file
    - You can get the token from Application » Bot » Token, **never share this
      with anyone**
    - Make sure to change the model if you aren't using `orca`
    - EasyDiffusion URL can be kept the same unless you have changed the port
    - You can use multiple EasyDiffusion servers at the same time by separating
      the URLs with commas
    - Set the channels to the channel ID, comma separated
        1. In Discord, go to User Settings » Advanced, and enable Developer Mode
        2. Right click on a channel you want to use, and click Copy Channel ID
    - You can edit the system message the bot uses, or disable it entirely
6. Start the bot with `npm start`
7. You can interact with the bot by @mentioning it with your message
