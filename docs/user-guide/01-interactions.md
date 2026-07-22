# User Guide

This guide covers how to interact with Musebot in Discord — no configuration or server setup required. If you're looking for setup instructions, see [Introduction](../introduction.md).

## Basic Interaction

Musebot responds when you **mention** it at the start of a message:

```
@Musebot tell me a joke
```

Depending on how your server admin configured the bot, it will either chat with you or generate media from your prompt. Some servers may require mention; others may respond without it — check with your admin if unsure.

---

## Chat Mode

When Musebot is configured in **chat mode**, it converses with you using a local large language model (via Ollama).

### What You Can Do

* **Chat naturally** — Ask questions, brainstorm ideas, or have casual conversations. The bot maintains context within the current channel conversation.
* **Send images** — If your admin enabled [Vision](01-ollama.md#vision), the bot can see and describe images you send.
* **Share links** — Web links in your messages are automatically fetched and summarized, so the bot can reference their content.

### Buttons After Every Response

After Musebot responds, you'll see buttons below its message:

| Button | Name | What It Does |
|--------|------|-------------|
| 🆑 | **Clear Context** | Clears the bot's memory of this conversation thread. Useful if the conversation has gone off-track or you want to start fresh. Requires confirmation via follow-up buttons (✅ Confirm / ❌ Cancel). |
| ❔ | **Help** | Shows a summary of what the bot can do, including button descriptions and slash commands. |

### Long-Term Memory

If your admin enabled long-term memory, the bot can remember information from past conversations — even across different channels and servers. This is **opt-in per user**.

| Slash Command | What It Does |
|--------------|-------------|
| `/memory remember` | Opt in to long-term memory. The bot will backfill your message history from all accessible channels, then passively store messages going forward. If the bot restarts mid-backfill, run this command again to resume. |
| `/memory forget` | Opt out of long-term memory. **Permanently deletes** all stored memories associated with you across all servers. Cannot be undone. |

::: tip
Long-term memory is server-scoped for retrieval (the bot only uses memories from the current server) but consent is global (opting in applies everywhere the bot is present).
:::

---

## Media Mode

When Musebot is configured in **media mode**, it generates images, video, audio, or music using ComfyUI.

### Generating Media

Mention the bot with a description of what you want:

```
@Musebot a cyberpunk city at sunset, neon lights, rain
```

The bot will generate media and respond with the result plus interactive buttons.

### Buttons After Generation

After Musebot generates media, you'll see buttons below its response. The exact buttons depend on your admin's configuration, but here are the common ones:

| Button | Name | What It Does |
|--------|------|-------------|
| 🔄 | **Retry** | Regenerates with the same prompt but a different seed, giving you a new variation. |
| 📃 | **Expand Prompt** | Sends your prompt through an LLM to add detail and creativity before generating. Requires chat mode (Ollama) to also be configured. |
| 🎲 | **Randomize** | Generates a completely random prompt with the LLM and creates media from it. Fun for surprises. Requires chat mode too. |
| ➕ | **Increase Guidance Scale** | Makes the bot follow your prompt more strictly. Use this if results are too abstract or stray from what you asked for. |
| ➖ | **Decrease Guidance Scale** | Gives the model more creative freedom. Use this if results look too rigid or oversaturated. |
| `{ }` | **Show Source** | Reveals the full JSON prompt used to generate the media, including seed, guidance scale, and workflow settings. You can paste this back as a new prompt to fine-tune any parameter (use `-1` as the seed for random). |

### Tips for Better Results

* **Be specific** — Include details about style, lighting, composition, and mood in your prompts.
* **Use Expand Prompt** 📃 — If your result isn't quite right, try expanding first before tweaking parameters.
* **Adjust guidance iteratively** — Start with the default scale, then use ➕ or ➖ to nudge results in the direction you want.
* **Save good seeds** — When Show Source reveals a result you like, note the seed value and reuse it for similar generations.

---

## Common Questions

**Why isn't the bot responding?** It may require an @mention, be offline, or be queued up behind other requests. Check if your admin has configured response rate limits.

**Can I use slash commands in media mode?** Only `/memory remember` and `/memory forget` are available (if LTM is enabled). Media mode doesn't have additional slash commands — interaction is through mentions and buttons.

**How long does generation take?** Depends on the type of media and server hardware. Images typically take seconds, video and audio can take several minutes.
