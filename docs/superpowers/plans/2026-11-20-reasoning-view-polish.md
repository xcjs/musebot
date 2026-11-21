# Reasoning View Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the streaming reasoning view: rename the label to `🤔 *Thinking…*`, remove the stray inline ellipsis (`…>` glued to the first quote line), cap the visible quote lines by a new configurable value (default 25), and derive the character guard from `DiscordConstants.ContentMaxLength` instead of a literal.

**Architecture:** Two vertical slices: (1) config plumbing for `llm.reasoningViewLines` in the environment-settings layer (typed config interface + implementation + user-facing docs), (2) the `#renderReasoningView` renderer change in `LlmMessageTask` that consumes the new config and fixes label/ellipsis/char-guard behavior. Slice 2 is safe to land after slice 1; the renderer reads the property through `this.configurationService`.

**Tech Stack:** TypeScript (ES2022, ESM with `.js` import extensions), Jest 30 + ts-jest, Discord.js chat layer.

**Spec:** `docs/superpowers/specs/2026-11-20-reasoning-view-design.md`
(User added after design approval: the character guard must reference `DiscordConstants.ContentMaxLength`, not stay a hard-coded `1800`.)

## Global Constraints

- Label is exactly `🤔 *Thinking…*` (emoji 🤔, typographic U+2026 `…`, asterisks, no trailing period).
- View body format: `` `${reasoningLabel}\n\n${quoted}` `` — NO `overflow` ellipsis anywhere (the old `\u2026` overflow marker is deleted entirely).
- Line cap value comes from `IConfigurationService.llmReasoningViewLines: number`, default `25` in the getter; cap applies inside the existing tail loop condition.
- Character guard: `maxReasoningViewChars = DiscordConstants.ContentMaxLength - 200` (margin documented inline). `DiscordConstants` is already imported in `LlmMessageTask.ts` (line 11) — do not add an import.
- Constants per existing literals: `maxReasoningViewChars` is the only char-level guard; per-line `600`-char slice and `budget` loop stay unchanged except where the plan says.
- Project conventions: ESM `.js` import extensions, explicit function return types, `#`-private class fields, ESLint `simple-import-sort`, `npm test` green, `npm run lint` clean, `npm run build` clean.

## Review Focus

- Cap boundary: with more lines than the cap, exactly `maxReasoningViewLines` quoted lines render (loop stops at `tailLines.length < max`, not before) — pinned by Task 2's cap test.
- Small override with short reasoning (fewer lines than cap) shows every line — pinned by the existing finalize test (3 lines < cap).
- Config without an `llm` block (or without `reasoningViewLines`) resolves to the default `25` — pinned by Task 1's default test.
- The label ellipsis must remain typographic `…` (not ASCII `...`) — pinned by exact-label assertions in both label tests.
- Empty reasoning never reaches `#renderReasoningView` — the streaming loop guards at `LlmMessageTask.ts:176-178` (`reasoning.length === 0 → continue`) and the finalize path at `:217` (`reasoning.length > 0`). The renderer's own empty-string early return stays as defensive code; do not remove it, and do not try to test it directly (ES `#`-private methods cannot be bracket-accessed).

---

### Task 1: Config plumbing — `llm.reasoningViewLines` (default 25)

**Files:**
- Modify: `src/services/environment-settings/IBotConfig.ts:30-41` (llm block; add after `contextCompressionThreshold?: number;` at line 40)
- Modify: `src/services/environment-settings/IConfigurationService.ts` (llm property group; add beside `llmTopK`/`llmContextCompressionThreshold`)
- Modify: `src/services/environment-settings/ConfigurationService.ts:211-214` (getter; add after `llmEmbeddingInputLimit`) and `:313` (log line; add after the embeddingInputLimit log)
- Modify: `AGENTS.md` (config table; add one row near `bots[].llm.embeddingInputLimit`)
- Test: `src/services/environment-settings/ConfigurationService.test.ts` (mirror the paired `llmContextWindow` tests at lines 288-322 under `describe('properties')`)

**Interfaces:**
- Consumes: nothing (leaf slice).
- Produces: `IConfigurationService.llmReasoningViewLines: number` — read by Task 2's renderer as `this.configurationService.llmReasoningViewLines`; user config key is `llm.reasoningViewLines` (optional, no default in IBotConfig).

- [ ] **Step 1: Write the failing tests**

In `ConfigurationService.test.ts`, following the exact construction pattern of the `llmContextWindow` paired tests (build a config whose `llm` block spreads `validChatBotConfig.llm` then adds/deletes the key):

```ts
it('should default llmReasoningViewLines to 25 when not set', (): void => {
  // config: llm = { ...validChatBotConfig.llm } with no reasoningViewLines key
  expect(service.llmReasoningViewLines).toBe(25);
});

it('should return configured reasoningViewLines when set', (): void => {
  // config: llm = { ...validChatBotConfig.llm, reasoningViewLines: 12 }
  expect(service.llmReasoningViewLines).toBe(12);
});
```

- [ ] **Step 2: Run the test file to verify both fail**

Run: `npx jest src/services/environment-settings/ConfigurationService.test.ts --silent`
Expected: FAIL ×2 — `service.llmReasoningViewLines` is `undefined` (property not on the interface), the remaining suites pass.

- [ ] **Step 3: Implement**

- `IBotConfig.ts` llm block: add `reasoningViewLines?: number;` after line 40 with a one-line doc comment above it (visible reasoning view line cap).
- `IConfigurationService.ts`: add `llmReasoningViewLines: number;` in the llm property group.
- `ConfigurationService.ts`: after the `llmEmbeddingInputLimit` getter (line 214) add:

```ts
get llmReasoningViewLines(): number {
  return this.#botConfig.llm?.reasoningViewLines
    ?? 25;
}
```

- `ConfigurationService.ts` log lines: after line 313 add `this.#log.info(`bots[].llm.reasoningViewLines: ${this.llmReasoningViewLines}`);`
- `AGENTS.md` config table: add row `bots[].llm.reasoningViewLines` — `Visible reasoning view line cap (default 25)`.

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx jest src/services/environment-settings/ConfigurationService.test.ts --silent`
Expected: all suites/tests PASS (0 failures).

- [ ] **Step 5: Commit**

```bash
git add src/services/environment-settings/IBotConfig.ts src/services/environment-settings/IConfigurationService.ts src/services/environment-settings/ConfigurationService.ts src/services/environment-settings/ConfigurationService.test.ts AGENTS.md
git commit -m "feat(llm): configurable reasoning view line cap — llm.reasoningViewLines (default 25)"
```

---

### Task 2: Renderer — Thinking label, no stray ellipsis, line cap, constant-derived char guard

**Files:**
- Modify: `src/services/clients/llm/tasks/LlmMessageTask.ts:265-299` (`#renderReasoningView`)
- Modify: `src/services/clients/llm/tasks/LlmMessageTask.test.ts:397,446` (existing label assertions) and `buildMockServices` (`:48`, `:105-136`) plus new tests in the same describe
- Modify: `docs/superpowers/specs/2026-11-20-reasoning-view-design.md` (renderer bullet: char guard now `DiscordConstants.ContentMaxLength - 200`; strays-ellipsis bullet updated to 'removed entirely')

**Interfaces:**
- Consumes: `IConfigurationService.llmReasoningViewLines: number` (Task 1), `DiscordConstants.ContentMaxLength` (already imported in `LlmMessageTask.ts` line 11).
- Produces: `#renderReasoningView(reasoning: string): string` — unchanged signature; view = `` `${reasoningLabel}\n\n${quoted}` `` with at most `llmReasoningViewLines` quoted `> `-prefixed lines.

- [ ] **Step 1: Update `buildMockServices` and write the failing tests**

In `LlmMessageTask.test.ts`:

- Extend `buildMockServices` (line 48) to `function buildMockServices(streamsResponse: boolean, contextMessages: LlmMessage[] = [], reasoningViewLines: number = 25): MockServices` and add `llmReasoningViewLines: reasoningViewLines,` to the config literal near `llmTopK: 5` (line ~131). Existing callers stay valid via defaults.
- Line 397: `expect(lastView.startsWith('🤔 *Reasoning…*')).toBe(true);` → `expect(lastView.startsWith('🤔 *Thinking…*')).toBe(true);` and directly under it add `expect(lastView).not.toContain('\n\n…');` (pins the stray-ellipsis removal in a truncating view).
- Line 446: same rename → `expect(view.startsWith('🤔 *Thinking…*')).toBe(true);`
- Add two new tests in the same describe after the finalize test (line 448), following the `buildMockServices(true)` + `mockImplementationOnce` + `await task.process()` + `ShowReasoning.mock.calls[0][1]` pattern:

```ts
it('caps the reasoning view to the configured line count', async (): Promise<void> => {
  // stream yields 30 chunks with reasoning: `Thought ${i}.\n`, then done
  const mocks = buildMockServices(true, [], 10);  // line cap override 10
  await task.process();
  const view = mocks.llmStreamingReplyServiceShowReasoning.mock.calls[0][1] as string;
  const quotedLineCount = view.split('\n').filter((line) => line.startsWith('> ')).length;
  expect(quotedLineCount).toBe(10);            // exactly the cap, not fewer
  expect(view).toContain('> Thought 29.');     // most recent line kept
  expect(view).not.toContain('> Thought 0.');  // oldest lines cut
});
```

(No empty-reasoning test: the caller never invokes `showReasoning` with empty reasoning — see Review Focus.)

- [ ] **Step 2: Run the test file to verify the new/renamed assertions fail**

Run: `npx jest src/services/clients/llm/tasks/LlmMessageTask.test.ts --silent`
Expected: FAIL — label assertions see `🤔 *Reasoning…*`, stray-ellipsis `not.toContain('\n\n…')` catches the live `…>` artifact, cap test sees 30 quoted lines.

- [ ] **Step 3: Implement the renderer**

In `#renderReasoningView` (`LlmMessageTask.ts:265-299`):

```ts
#renderReasoningView(reasoning: string): string {
  const reasoningLabel = '🤔 *Thinking…*';
  // Reasoning must survive alongside the eventual answer, so hold a small
  // margin under Discord's message character limit.
  const maxReasoningViewChars = DiscordConstants.ContentMaxLength - 200;
  const maxReasoningViewLines = this.configurationService.llmReasoningViewLines;

  if (reasoning.length === 0) {
    return reasoningLabel;
  }

  // (fence neutralization, budget, tail loop unchanged, except the loop
  // condition gains the line cap:)
  for (let i = lines.length - 1; i >= 0 && budget > 0 && tailLines.length < maxReasoningViewLines; i -= 1) { /* unchanged body */ }

  // DELETE the `overflow` line entirely. Return:
  const quoted = tailLines.reverse().map((line) => `> ${line}`).join('\n');
  return `${reasoningLabel}\n\n${quoted}`;
}
```

Keep the existing comment block above the method; the budget derivation (`- reasoningLabel.length - 4`) and per-line 600-char slice are unchanged.

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx jest src/services/clients/llm/tasks/LlmMessageTask.test.ts --silent`
Expected: all suites/tests PASS (existing ~1300ms-pacing test at lines 353-416 still green — the cap 25 does not alter its window).

- [ ] **Step 5: Update the spec doc, full gates, commit**

- Edit `docs/superpowers/specs/2026-11-20-reasoning-view-design.md`: replace the literal `1800` character guard description with `DiscordConstants.ContentMaxLength - 200`, and the "overflow ellipsis above the tail" bullet with "no overflow marker; the view is label + quote block only".
- Full gates: `npm test` (all suites PASS), `npm run lint` (exit 0), `npm run build` (exit 0).

```bash
git add src/services/clients/llm/tasks/LlmMessageTask.ts src/services/clients/llm/tasks/LlmMessageTask.test.ts docs/superpowers/specs/2026-11-20-reasoning-view-design.md
git commit -m "feat(llm): reasoning view polish — Thinking label, configurable line cap, Discord limit"
```
