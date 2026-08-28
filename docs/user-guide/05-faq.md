---
title: FAQ
---

# FAQ

Troubleshooting answers for common questions. Each answer links to a page with
more detail.

## The bot isn't replying to me

A few possibilities:

- The bot **requires mentions** — @mention it (or its role) in your message.
- The bot replies **by chance** — your admin sets a response rate, so not
  every message gets an answer. Mentioning the bot directly always works.
- The **channel isn't allowed** — the admin may restrict the bot to certain
  channels or bar it from others.

See [Getting Started](./01-getting-started.md).

## Why don't I see Retry, Expand Prompt, or other buttons?

Buttons depend on the **type of media generated** and whether the generation
is **stateful**:

- **Expand Prompt** and **Randomize** only appear for image and video
  generations on chat-capable bots.
- Music and audio generations never show Expand Prompt or Randomize.
- Stateless generations show fewer buttons (for example, Randomize and Help
  for stateless images).
- Some buttons, like Guidance Scale ±, disappear when they'd step past their
  limits.

See [Generating Media](./03-media.md).

## What does the **{ }** button do?

That's **Show Source**. It gives you a `.json` file with the full render
request — prompt, seed, dimensions, and more. Paste it back into the channel
as a prompt to customize and re-render it. Set the seed to `-1` for a random
seed.

See [Generating Media](./03-media.md).

## The bot says long-term memory is not enabled

Long-term memory is an opt-in feature that the admin must enable on the bot.
If it's disabled, `/memory` commands can't be used. Ask your server admin
whether the feature can be turned on.

See [Memory & Privacy](./04-memory-and-privacy.md).

## How do I get a different result?

- Click 🔄️ **Retry** to re-render the same prompt.
- Click 🎲 **Randomize** to have an LLM invent a fresh prompt (image and video
  generations).
- Click **{ } Show Source**, customize the JSON, and paste it back — set the
  seed to `-1` for a random seed.

See [Generating Media](./03-media.md).

## Can the bot see images and links?

Yes, when the admin has enabled the right capabilities:

- **Images:** attach images to your message and mention the bot — a
  vision-capable model will interpret them.
- **Links:** paste a web URL and the bot reads the page and uses its contents
  in its reply.

See [Chatting](./02-chat.md).

## Related Pages

- [Getting Started](./01-getting-started.md) — getting the bot's attention and where it replies.
- [Chatting](./02-chat.md) — conversations, vision, web links, and chat buttons.
- [Generating Media](./03-media.md) — rendering images, video, music, and audio.
- [Memory & Privacy](./04-memory-and-privacy.md) — what the bot remembers and how to opt out.