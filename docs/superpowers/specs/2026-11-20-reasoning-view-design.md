# Reasoning view polish — design (small change)

Date: 2026-11-20
Feature touched: `9d1ef0c6` — sliding reasoning view for streaming reasoning models.

## Intent

Two fixes requested while watching the reasoning scroll in Discord:

1. The first quoted line renders as `…>` — the overflow ellipsis is inlined
   with no newline before the quote block in `#renderReasoningView` (line 298
   of `LlmMessageTask.ts`). **Remove the overflow ellipsis entirely** — no
   overflow marker; the view is label + quote block only. The
   label already conveys "thinking in progress"; a second, stray ellipsis at
   the top of nearly every view is clutter.
2. Cap how many reasoning lines are visible, ~20–30, **configurable**:
   `bots[].llm.reasoningViewLines`, default **25** (middle of the requested
   range).
3. Rename the label `🤔 *Reasoning…*` → `🤔 *Thinking…*` (emoji unchanged;
   typographic ellipsis kept for consistency with the existing style).

## Goals / non-goals

- Goals: clean first line under the label; bounded, tunable window size;
  hard Discord 2000-char limit still respected.
- Non-goals: no change to pacing/edit cadence, no change to how reasoning
  is captured, no new filters.

## Approaches considered

- **Line cap + config (chosen)** — slots into the existing tail loop
  (`tailLines.length < maxReasoningViewLines` in the loop condition). The
  char budget (`DiscordConstants.ContentMaxLength - 200`) and 600-char
  per-line slice stay as hard guards because 25 long lines can exceed the
  char budget. Config knob matches
  existing `llm.*` patterns (`llm.timeoutMinutes`, `llm.embeddingInputLimit`).
- Hardcoded 25 — rejected: user chose configurable.
- Keep ellipsis but on its own quote line (`> …`) — rejected: explicitly
  requested removal.

## Changes

1. `src/services/environment-settings/IBotConfig.ts` — add optional
   `llm.reasoningViewLines?: number;` with doc comment.
2. `src/services/environment-settings/IConfigurationService.ts` — add
   `llmReasoningViewLines: number;` with doc comment.
3. `src/services/environment-settings/ConfigurationService.ts` — getter
   `this.#botConfig.llm?.reasoningViewLines ?? 25;` + log line next to the
   other llm knobs.
4. `src/services/clients/llm/tasks/LlmMessageTask.ts` `#renderReasoningView` —
   drop the `overflow` ellipsis; add the line cap to the loop condition,
   reading `this.configurationService.llmReasoningViewLines` (the task
   already holds `configurationService` via `BaseTask`); rename the label
   to `*Thinking…*`.
5. Tests: extend `LlmMessageTask.test.ts` (no stray ellipsis after the label;
   visible-quoted-line count ≤ configured limit, with a reasoning stream long
   enough to cut; label prefix assertions now use `*Thinking…*`) and
   `ConfigurationService.test.ts` (default 25 when unset, honors override).

## Builder notes

- View shape after the change: `{label}\n\n{quoted tail}` — nothing else
  between label and quote block.
- Config default: 25. Users may set any positive integer; values are
  additionally bounded by the char budget, so pathological one-line values
  (e.g. 1000) just collapse back to the char budget.
