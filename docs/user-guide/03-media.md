---
title: Generating Media
---

# Generating Media

In media mode, Musebot renders images, video, music, and audio from your
prompts using ComfyUI. Describe what you want — the bot handles the rest and
posts the result in the channel.

## Making a Request

Send a prompt in a channel where the bot is allowed to respond (see
[Getting Started](./01-getting-started.md)). What the bot generates depends on
what your admin has set up — it may render images, videos, music, or audio.

## Buttons

Every generation comes with buttons. Which buttons you see depends on the type
of media generated and whether the generation is stateful (can be re-rendered
with tweaks):

| Button | What it does |
| ------ | ------------ |
| 🔄️ **Retry** | Re-renders with the same prompt for a different result. |
| ➖ **Decrease Guidance Scale** | Loosens how strictly the render follows your prompt. |
| ➕ **Increase Guidance Scale** | Makes the render follow your prompt more strictly. |
| **{ }** **Show Source** | Reveals the render's source JSON. You can paste it back as a prompt to customize the render. |
| ❔ **Help** | Explains the buttons on that message. |
| 📃 **Expand Prompt** | An LLM enriches your prompt first, then the render uses the expanded version. |
| 🎲 **Randomize** | An LLM invents a fresh, unrelated prompt and renders that instead. |

Depending on the generation type you may see fewer buttons:

- Image and video generations (stateful): Retry, Guidance Scale ±, Show
  Source, Help, Expand Prompt, Randomize.
- Music and audio generations (stateful): Retry, Guidance Scale ±, Show
  Source, Help — no Expand Prompt or Randomize.
- Stateless image/video generations: Randomize and Help.
- Stateless audio generations: Help only.

## Show Source and Custom Renders

Click **{ } Show Source** to get a `.json` file with the full render request —
the prompt, seed, dimensions, sampler, and more. Paste that JSON back into the
channel as a prompt and the bot will re-render it with whatever you changed:
edit the prompt text, tweak the dimensions, change the sampler.

**Tip:** set the `"seed"` in the JSON to `-1` and the bot will pick a random
seed for the render.

## Editing Images (img2img and img2vid)

Attach an image to your message (or reference a recent message with one) and
you'll get buttons for each img2img/img2vid workflow your admin configured —
for example, upscaling or style transfer. One render is produced per
attachment. Each button is labeled with its workflow's name, exactly as the
admin defined it.

## Guidance Scale

Guidance scale controls how strictly the render follows your prompt: lower
values give the model more freedom; higher values stick closer to your text.
The ➕/➖ buttons step the value by an interval your admin configured, within
fixed bounds (0–30). If a button would step past a bound, it's unavailable.

## Related Pages

- [Getting Started](./01-getting-started.md) — getting the bot's attention and where it replies.
- [Chatting](./02-chat.md) — conversations, vision, web links, and chat buttons.
- [Memory & Privacy](./04-memory-and-privacy.md) — what the bot remembers and how to opt out.
- [FAQ](./05-faq.md) — quick troubleshooting answers.