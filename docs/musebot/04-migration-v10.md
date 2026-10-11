# Migration Guide: v9 → v10 (LLM Provider Migration)

Musebot v10 replaces the Ollama-specific client with a provider-neutral
**LLM client** that speaks the OpenAI-compatible protocol
(`/v1/chat/completions`, `/v1/embeddings`). Ollama remains fully supported —
it's just no longer the only option. llama.cpp's `llama-server` (router and
single-model modes) and hosted OpenAI-compatible APIs now work too.

## What Changed

* The `ollama` config block is now the **`llm`** config block.
* `llm.hosts` entries are now **objects** (`{ "url": ... }`) instead of bare
  strings, with optional `token` and `isLocal` fields.
* New optional `llm.visionModels` setting declares vision-capable models on
  non-Ollama hosts (Ollama still auto-detects vision).
* Internal accessors were renamed (e.g., `ollamaHosts` → `llmHosts`,
  `OllamaClient` → `LlmClient`). If you only configure via `config.jsonc`
  this is invisible to you.
* The bot now probes each host at startup to detect its platform (Ollama,
  llama.cpp router, llama.cpp single-model, or generic) and picks the right
  model lifecycle behavior automatically.

## Before / After

```jsonc
// v9 — before
"ollama": {
  "hosts": ["http://localhost:11434"],
  "models": ["gemma4:12b"],
  "systemPrompt": "You are a helpful assistant.",
  "streamsResponse": false,
  "embeddingModel": "nomic-embed-text",
  "topK": 5
}
```

```jsonc
// v10 — after
"llm": {
  "hosts": [{ "url": "http://localhost:11434" }],
  "models": ["gemma4:12b"],
  "systemPrompt": "You are a helpful assistant.",
  "streamsResponse": false,
  "embeddingModel": "nomic-embed-text",
  "topK": 5,
  "visionModels": []
}
```

For a hosted provider, add the token to the host object:

```jsonc
"llm": {
  "hosts": [{ "url": "https://api.examplerator.com", "token": "sk-..." }],
  "models": ["some-model-name"],
  "visionModels": ["some-model-name"],
  "contextWindow": 8192
}
```

## Breaking Change: Bare-String Hosts Rejected

A v9 config with `"hosts": ["http://localhost:11434"]` fails at startup with:

```
Bare-string hosts are no longer supported; wrap each host as { "url": "..." }.
See docs/musebot/04-migration-v10.md.
```

Wrap each host URL in an object: `{ "url": "http://localhost:11434" }`.

## Tokens (Authentication)

* The optional `token` field is configured **per host**: `{ "url": "...", "token": "sk-..." }`.
* The token is sent as an `Authorization: Bearer <token>` header on every
  request to that host, and only when a token is set.
* Credentials live only in `config.jsonc` — never commit that file. As per
  [ADR 003](../adr/003-drop-env-support.md), `MUSEBOT_*` environment variables
  hard-fail at startup; there is no env-based alternative.

## isLocal Auto-Detection

Musebot only manages model lifecycle (loading/unloading) on **local** hosts;
non-local hosts get a no-op strategy and their models are never touched.
A host is considered local when:

* The hostname is `localhost`, starts with `127.`, or is `::1`; **or**
* A DNS lookup resolves the hostname to a private address:
  * RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  * Tailscale CGNAT: `100.64.0.0/10`
  * Link-local: `169.254.0.0/16`
  * IPv6 unique-local: `fc00::/7`
  * IPv6 link-local: `fe80::/10`
* A hostname that cannot be resolved is conservatively treated as local.

The explicit `"isLocal": true` / `"isLocal": false` flag on a host object
**always wins** over the automatic detection. Set it when a reverse proxy or
split-DNS makes the automatic check unreliable.

## llama.cpp Guidance

llama.cpp's `llama-server` is supported in two modes:

### Router Mode (recommended)

Launch **without** `-m` and point `--models-dir` at a directory of GGUFs:

```bash
llama-server --models-dir ./models --models-max 4 --api-key sk-your-key
```

* Musebot unloads models on demand via `POST /models/unload` with
  `{"model": "<name>"}` and verifies the unload via `GET /models`
  (per-model status).
* Instances inherit the router's API key — set `--api-key` and configure the
  same key as the host's `token`.
* `--models-max` (default `4`) bounds how many models stay resident.
* Vision models must be listed in `llm.visionModels`; there is no
  context-window detection, so set `llm.contextWindow` manually.

### Single-Model Mode

Launch with a single `-m model.gguf`. This mode has **no on-demand unload** —
the only way to release the model's RAM is idle sleep:

```bash
llama-server -m ./models/gemma.gguf --sleep-idle-seconds 300
```

After `N` idle seconds, the model and its KV cache are unloaded from RAM and
automatically reload on the next request. Musebot watches for `is_sleeping` in
`GET /props`. **Without `--sleep-idle-seconds`, Musebot's post-task unload
wait never terminates** — make sure the flag is set.

As with router mode, vision and context window come from `llm.visionModels`
and `llm.contextWindow`.

## Where to Go Next

* Full LLM configuration reference: [Configuration](./02-configuration.md)
* Provider capabilities matrix and details: [LLM Providers](../chat/01-llm.md)