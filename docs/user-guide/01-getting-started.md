---
title: Getting Started
---

# Getting Started

Musebot is a Discord bot that brings generative AI to your server. It can chat
with you using large language models and generate media — images, video, music,
and audio — through ComfyUI. The bot is set up and maintained by your server
admin, so there is nothing for you to install or configure.

## Adding Musebot to a Server

You don't add Musebot to a server yourself — your server admin invites and
hosts it. If you'd like Musebot in a server you run, point the server's admin
at the [setup documentation](../musebot/01-discord.md); they'll handle the
rest.

## Getting the Bot's Attention

Whether Musebot responds to you depends on how your admin configured it:

- **If the bot requires mentions**, @mention the bot (or its role) in your
  message. The bot replies only to messages that mention it.
- **If the bot doesn't require mentions**, it replies to messages by chance.
  Your admin sets a response rate — a percentage of messages it will answer.
  Directly mentioning the bot always gets its attention, even in this mode.
- **Channel access matters.** The admin can restrict the bot to specific
  channels or bar it from others. If the bot never replies in a particular
  channel, it may simply not be allowed to listen there.

When the bot starts working on your request, you'll see the typing indicator
("Musebot is typing…"). That means your request was received and is being
processed. Long or complex requests — especially media generation — can take a
while to finish.

## What's Next

- Learn about chatting with the bot in [Chatting](./02-chat.md).
- Ready to make something? See [Generating Media](./03-media.md).
- Curious what the bot remembers? Read [Memory & Privacy](./04-memory-and-privacy.md).
- Something not working? Check the [FAQ](./05-faq.md).