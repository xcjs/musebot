---
title: Memory & Privacy
---

# Memory & Privacy

Musebot can remember past conversations — but only if you explicitly opt in.
Long-term memory is entirely in your control, and it only exists if the admin
enabled the feature on the bot.

## Opting In: `/memory remember`

Run the `/memory remember` slash command to opt in. The bot will:

1. Confirm you've opted in.
2. **Backfill** — read the message history it can access in the server's
   channels (your messages and the bot's replies to you) and store memories
   from them, reporting how many messages were stored when done.

Once opted in, new conversations are remembered automatically. Your consent
persists across sessions — the bot doesn't ask again, and if the bot restarts
mid-backfill, it resumes where it left off.

If you run `/memory remember` when you're already opted in, the bot simply
reports your status rather than duplicating work.

## Opting Out: `/memory forget`

Run the `/memory forget` slash command to opt out. The bot **permanently
deletes everything it has stored about you** — across all servers — and
confirms the deletion. There's nothing left to forget afterward.

## What the Bot Remembers

- Memories are recalled **per server**: conversations from one server help the
  bot in that server, but aren't carried into others.
- When relevant, past memories are quietly included in the bot's context so it
  can pick up where you left off — even days later.
- If the feature is disabled, the command replies that long-term memory is not
  enabled on this bot.

## For Admins

Setting up long-term memory (embedding models, vector storage) is covered in
the [long-term memory administration guide](../chat/02-long-term-memory.md).

## Related Pages

- [Getting Started](./01-getting-started.md) — getting the bot's attention and where it replies.
- [Chatting](./02-chat.md) — conversations, vision, web links, and chat buttons.
- [Generating Media](./03-media.md) — rendering images, video, music, and audio.
- [FAQ](./05-faq.md) — quick troubleshooting answers.