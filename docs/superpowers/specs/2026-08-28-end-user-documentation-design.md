# End-User Documentation Design

**Date:** 2026-08-28
**Status:** Approved
**Scope:** Fresh end-user documentation for Discord server members, plus navigation wiring. No source code changes, no admin-doc rewrites, no porting of the legacy guide on `feature/long-term-memory-improvements`.

## Goals

- Give Discord server members (not bot admins) accurate, code-verified instructions for using Musebot: chatting, generating media, long-term memory, and troubleshooting.
- Document only behaviors that exist in `src/` on this branch, using exact Discord labels and conditional phrasing where behavior depends on admin configuration or enabled features.

## Non-Goals

- Porting `docs/user-guide/01-interactions.md` from the other branch (content is referenced for phrasing only; this is a fresh write).
- Explaining bot hosting, configuration files, or CLI usage — that stays in the admin-facing docs (`musebot/`, `chat/`, `media/` sections).
- Fixing the pre-existing broken link warning (`introduction.md` → `integrations/swarm-ui.md`).

## Structure

New docs section `docs/user-guide/` with five pages, ordered by numeric prefix (existing convention):

| File                       | Title              | Purpose                                                                                                                                                    |
| -------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-getting-started.md`    | Getting Started    | What Musebot is from a member's perspective; getting it into a server; getting its attention (mentions, response rate, typing indicator, allowed channels) |
| `02-chat.md`               | Chatting           | Conversational replies, streaming, vision (image attachments), web links, emoji-reaction replies, Clear Context (with confirm/cancel), Help button         |
| `03-media.md`              | Generating Media   | Prompt → render flow; per-generation-type button rows; per-button semantics; img2img/img2vid via attachments; admin-defined workflow buttons               |
| `04-memory-and-privacy.md` | Memory & Privacy   | Opt-in long-term memory; `/memory remember` / `/memory forget`; backfill; permanent deletion; link to admin setup docs                                     |
| `05-faq.md`                | FAQ                | Troubleshooting Q&A; each answer links to the relevant page                                                                                                |

## Navigation Wiring

- `docs/.vuepress/config.ts`: navbar gains a **User Guide** dropdown (prefix `user-guide`, children `01-…` through `05-…`), placed after Introduction.
- `docs/README.md`: home actions gain a **User Guide** secondary action linking to `/user-guide/01-getting-started.md`, placed before Source Code.

## Page Content

### 01 — Getting Started

- What Musebot is: a Discord bot connecting Ollama (LLM chat) and ComfyUI (media generation), run by the server admin.
- Getting it into a server: via the admin's invite; members don't configure anything.
- Getting its attention:
  - When the bot requires mentions, @mention the bot (or its role).
  - When mentions are not required, it replies probabilistically per the admin's response-rate setting.
  - The typing indicator means the bot is processing.
  - Channel access is governed by the admin's allow/disallow lists.
- Cross-links to Chat, Generating Media, Memory & Privacy.

### 02 — Chatting

- Conversational replies; responses stream progressively when the admin enables streaming.
- Vision: attach images and mention the bot; multimodal models interpret them.
- Web links: pasting a URL causes the bot to read and summarize the article.
- Emoji reactions: reacting to the bot's message prompts a conversational reply about the reaction.
- Buttons (chat mode action row): **Clear Context** (asks for confirmation; Confirm/Cancel pair) resets the conversation memory; **Help** re-sends the button guide.
- Conditional phrasing: features above depend on the model capabilities the admin enabled (vision) and configuration (streaming).

### 03 — Generating Media

- Prompt the bot in a media-mode channel to render images, video, music, or audio.
- Button availability differs by generation type (verified action-row composition):
  - Stateful image: Retry, Guidance Scale −, Guidance Scale +, Show Source, Help, Expand Prompt, Randomize.
  - Stateful audio: Retry, Guidance Scale −, Guidance Scale +, Show Source, Help (no Expand Prompt / Randomize).
  - Stateless image: Randomize, Help.
  - Stateless audio: Help.
- Per-button semantics:
  - **Retry** — same prompt, different output.
  - **Expand Prompt** — an LLM enriches the prompt, then the render uses the expanded version (images/video only, chat-capable bots).
  - **Randomize** — an LLM invents a fresh, unrelated prompt and renders it.
  - **Guidance Scale ±** — how strictly the render follows the prompt; bounded by admin-configured min/max and interval.
  - **Show Source `{ }`** — reveals the render JSON; it can be pasted back as a prompt to customize (seed `-1` randomizes the seed).
- img2img / img2vid: attach an image (or reference a recent message with one); one render per attachment. One button appears per admin-defined workflow, labeled by the workflow's name; buttons depend on the admin's img2img workflows.

### 04 — Memory & Privacy

- Long-term memory is opt-in per user and only present when the admin enables the feature.
- `/memory remember` — opts in; the bot backfills accessible message history and reports progress/results.
- `/memory forget` — opts out; deletes everything stored about the user, permanently, across servers.
- Consent persists across sessions; re-running remember when already consented reports status instead of duplicating work.
- If the feature is disabled, the command replies that long-term memory is not enabled on this bot.
- Links to `../chat/02-long-term-memory.md` for admin-side setup.

### 05 — FAQ

Q&A entries, each linking to the detailed page:

- "The bot isn't replying to me" — mention requirement, response-rate chance, channel allow/disallow.
- "Why don't I see Retry / Expand Prompt / …?" — buttons depend on generation type, bot features, and whether the generation is stateful.
- "What does the `{ }` button do?" — Show Source; paste-back customization; seed `-1`.
- "The bot says long-term memory is not enabled" — admin feature; see Memory & Privacy.
- "How do I get a different result?" — Retry, or customize via Show Source with seed `-1`.
- "Can the bot see images and links?" — vision and web reading behaviors.

## Tone, Format & Conventions

- Second person ("you"); plain language for non-technical readers.
- Admin-owned settings framed as "your server admin configures…" — no config-file or CLI references.
- Frontmatter `title` per page; `##` sections; tables for button references.
- Exact Discord labels: Retry, Expand Prompt, Randomize, Increase/Decrease Guidance Scale, Show Source, Clear Context, Help, `/memory`.
- Conditional behavior stated explicitly ("if the bot requires mentions…", "depending on which features the admin enabled…").
- Relative cross-links (`./02-chat.md`); Memory page links to admin docs with `../chat/02-long-term-memory.md`.

## Verification

- Every behavioral claim traces to the code-verified facts gathered during design (button support conditions, action-row composition, `/memory` handler responses, reply-filter logic).
- `npm run docs:build` succeeds with no new broken-link warnings (pre-existing `integrations/swarm-ui.md` warning is out of scope).
- Visual check against the local docs server: new home action, navbar dropdown, and rendered pages.

## Out of Scope

- Any change under `src/`.
- Porting or deleting the legacy guide on other branches.
- Rewriting admin-facing documentation.