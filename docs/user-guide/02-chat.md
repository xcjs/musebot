---
title: Chatting
---

# Chatting

Musebot's chat mode turns the bot into a conversational companion powered by a
large language model (LLM). Ask questions, chat, or brainstorm — the bot
replies right in the channel.

## Conversational Replies

Mention the bot (or just send a message, if your admin allows it — see
[Getting Started](./01-getting-started.md)) and the bot will reply. If the
admin enabled streaming, the response appears progressively, updating in place
as it's written, so you don't have to wait for the whole answer to appear.
Long replies are split across multiple messages.

## Vision (Images)

If the admin configured a vision-capable model, you can attach images to your
message and the bot will interpret them. Attach one or more images
(JPEG, PNG, or WebP) and mention the bot along with your question about them —
for example, "what's in this picture?"

## Web Links

Paste a web link in your message and the bot will read the page and use its
contents when replying. Ask follow-up questions about the article — the bot
has already read it. This works with regular web pages, not every file type.

## Emoji Reactions

React to one of the bot's messages with any emoji, and the bot may reply with
a conversational response to your reaction. It's a playful way to give
feedback on a response.

## Buttons

Under the bot's last reply you'll find a row of buttons:

| Button | What it does |
| ------ | ------------ |
| 🆑 **Clear Context** | Resets the bot's memory of the current conversation. The bot asks for confirmation first — choose ✅ to confirm or 🔙 to cancel. Once cleared, the bot forgets everything discussed in the channel up to that point. |
| ❔ **Help** | Re-sends the button guide so you always have it handy. |

The context the bot uses is per-channel — clearing it doesn't affect other
channels. If you'd like the bot to forget things it learned in *past*
conversations, see [Memory & Privacy](./04-memory-and-privacy.md).

## Related Pages

- [Getting Started](./01-getting-started.md) — getting the bot's attention and where it replies.
- [Generating Media](./03-media.md) — rendering images, video, music, and audio.
- [Memory & Privacy](./04-memory-and-privacy.md) — what the bot remembers and how to opt out.
- [FAQ](./05-faq.md) — quick troubleshooting answers.