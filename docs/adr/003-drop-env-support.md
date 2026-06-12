# ADR 003: Drop .env Support — Single Configuration Format

## Status

Proposed

## Context

Musebot currently supports two competing configuration formats simultaneously:

1. **Environment variables** (`.env` file with `MUSEBOT_*` prefix) - loaded by `EnvironmentSettings`
2. **JSON configuration** (`config.json` or `config.jsonc`) - loaded by `ConfigLoader` using the `json5` package

This creates complexity, confusion, and maintenance overhead:
- Users must understand and maintain two different format schemas
- Unclear precedence when both files exist
- Validation logic duplicated across both formats
- Risk of accidentally committing secrets with .env files
- Inconsistent configuration validation and error messages

**Current environment variable examples:**
```env
MUSEBOT_FUNCTION=chat
MUSEBOT_DISCORD_TOKEN=12345
MUSEBOT_OLLAMA_HOSTS=http://host1:11434/,http://host2:11434/
```

**Current config.json examples:**
```json
{
  "botFunction": "chat",
  "discordToken": "12345",
  "ollamaHosts": ["http://host1:11434/", "http://host2:11434/"]
}
```

## Decision

Drop `.env` support entirely and standardize on a unified JSON-based configuration system:

1. **Remove `.env` file processing** — No more `MUSEBOT_*` environment variables in code
2. **Unified JSON configuration** — Use `config.json` (preferred) or `config.jsonc` (with comments support)
3. **Single configuration source** — Remove `#read*` and `#parseDelimitedList` methods from `EnvironmentSettings`
4. **Configuration validation at startup** — Fail fast with clear error messages for invalid configurations
5. **Mode property** — Rename `botFunction` enum to simpler `mode` property

## Rationale

**Simplicity:** Single configuration format reduces complexity and maintenance burden

**Clarity:** JSON is easier to understand and edit with modern IDE support (autocomplete, linting, formatting)

**Schema validation:** Can add JSON schema or runtime validators for complete structure checking

**Security:** Less risk of accidentally committing secrets with JSON files (though still should never commit actual secrets)

**Documentation:** Easier to document a single format clearly

**Tooling support:** Excellent IDE and editor support for JSON configuration; YAML and other formats can be added later if needed

## Consequences

### Positive

- **Reduced confusion:** Users only need to learn one configuration format
- **Better tooling:** IDE autocomplete, validation, and refactoring for JSON
- **Simpler code:** Remove ~150 lines of environment variable parsing code
- **Clearer errors:** Single validation path with consistent error messages
- **Better security:** No risk of .env files being committed to version control

### Negative

- **Migration burden:** Users currently using .env files must manually migrate to JSON
- **Breaking change:** Existing deployments will break unless they update configuration
- **Development friction:** Missing some configuration options in JSON during development
- **Increased complexity for multi-bot:** New `IBotSettings` interface adds configuration nesting

### Neutral

- **No performance impact:** Configuration is only loaded at startup (once)
- **Configuration size:** JSON files may be slightly larger but more readable
- **IDE requirements:** Requires a code editor with JSON support (standard for modern development)

## Implementation Plan

### Phase 1: New Configuration Schema

**Create new interfaces:** `IBotSettings.ts`, `IBotMode.ts`

1. **`BotMode` enum** (new file)
   ```typescript
   export enum BotMode {
       Chat = 'chat',
       Media = 'media'
   }
   ```

2. **`IBotSettings` interface** (new file)
   ```typescript
   export interface IBotSettings {
       botId: string;
       nodeEnvironment: string;
       mode: BotMode;

       discord: {
           token: string;
           channels: string[];
           privateMessageUsers: string[];
       };

       chatApis: {
           discord: {
               token: string;
               channels: string[];
               privateMessageUsers: string[];
           };
       };

       comfyUi: {
           hosts: string[];
       };

       ollama: {
           hosts: string[];
           models: string[];
           systemPrompt: string;
           streamsResponse: boolean;
       };

       multiModal?: {
           randomPrompts: string[];
       };

       taskQueue?: {
           numAttempts?: number;
           retryDelayMs?: number;
           strategy?: TaskQueueStrategy;
           forceSerialAcrossHosts?: boolean;
       };
   }
   ```

3. **New `IBotConfig` interface** (update existing file)
   ```typescript
   export interface IBotConfig {
       bots: IBotSettings[];
   }
   ```

4. **Update `IGlobalSettings` interface**
   ```typescript
   export interface IGlobalSettings {
       taskQueue: {
           numAttempts: number;
           retryDelayMs: number;
           strategy: TaskQueueStrategy;
           forceSerialAcrossHosts: boolean;
       }
   }
   ```

### Phase 2: Code Migration

**Files to modify:**

1. **`src/services/environment-settings/IBotConfig.ts`**
   - Replace old structure with `bots: IBotSettings[]`
   - Remove old properties that will move to per-bot settings

2. **`src/services/environment-settings/IBotSettings.ts`** (create new)
   - Define the complete `IBotSettings` interface

3. **`src/services/environment-settings/IBotMode.ts`** (create new)
   - Export `BotMode` enum

4. **`src/services/environment-settings/IGlobalSettings.ts`**
   - Add `taskQueue` property to structure

5. **`src/services/environment-settings/IEnvironmentSettings.ts`**
   - Add `botMode: BotMode` properties (instead of `botFunction`)
   - Add method to get active bot settings based on botId
   - Add methods to extract settings from per-bot config

6. **`src/services/environment-settings/EnvironmentSettings.ts`**
   - **Remove sections 145-155**: `.env` loading logic (`if(this.nodeEnvironment !== NodeEnvironment.Test)` check)
   - **Remove methods** (lines 287-486):
     - `#readEnum<T>()`
     - `#readDefaultableNumber()`
     - `#readRequiredString()`
     - `#readDefaultableString()`
     - `#parseDelimitedList()` 
     - `#readDelimitedList()`
     - `#normalizeConfigValue()` (deprecated)
     - `#readBoolean()`
     - `#readDefaultableInteger()`
     - `#readDefaultableRangedInteger()`
     - `#mapLegacyFunctionsToCurrent()`
   - **Replace with** direct mapping from config object to properties
   - **Add validation** for `MUSEBOT_*` environment variables (throw if detected)
   - **Add priority logic**: if both `config.json` and `config.jsonc` exist, log warning and use `config.jsonc`

7. **`src/services/environment-settings/ConfigLoader.ts`**
   - Keep config.json vs config.jsonc priority logic (lines 12-29)
   - Add warning if both files exist (lines 20-23): log at debug level

8. **`src/services/ServiceContainer.ts`**
   - Update to create `IBotSettings` from loaded config
   - Add method to get bot ID
   - Update method to get active bot settings

9. **`src/app.ts`**
   - Update config loading flow
   - Pass bot settings to EnvironmentSettings constructor
   - Iterate over bots from config

### Phase 3: Validation & Error Handling

**Startup validation:**

1. **Missing config files:**
   ```
   Error: config.jsonc could not be found or accessed.
   ```

2. **Both config files exist:**
   - Warning log:
   ```
   [ConfigLoader] Warning: Both config.json and config.jsonc exist. Loading config.jsonc (with comments support).
   ```

3. **Invalid JSON syntax:**
   ```
   Error: config.jsonc exists, but cannot be parsed. Does it contain syntax errors?
   ```

4. **Configuration validation:**
   - If mode is 'media' → check `comfyUi.hosts` has at least one value, else throw:
   ```
   Error: Media mode requires at least one ComfyUI host configured in bot.comfyUi.hosts.
   ```
   - If mode is 'chat' → check `ollama.hosts` and `ollama.models` have at least one value, else throw:
   ```
   Error: Chat mode requires at least one Ollama host configured in bot.ollama.hosts.
   Error: Chat mode requires at least one Ollama model configured in bot.ollama.models.
   ```
   - If `ollama.models` is empty → warning:
   ```
   Warning: Bot 12345 has no Ollama models configured. Model selection not yet supported.
   ```

5. **Environment variable detection:**
   - At startup, iterate through `process.env` looking for `MUSEBOT_*` keys
   - If found, throw error with guidance:
   ```
   [EnvironmentSettings] FATAL ERROR: .env support has been removed. Please migrate all environment variables to config.jsonc format.
    
    Migration guide: docs/migration-from-env-to-jsonc.md
   ```

6. **Invalid mode:**
   ```
   Error: bot.mode must be one of: 'chat', 'media'
   ```

7. **Missing required fields:**
   ```typescript
   {
     "botId": "required" → throw: botId is required
     "discord.token" → throw: discord token is required in chat mode
     "comfyUi.hosts" → throw: ComfyUI hosts are required in media mode
     "ollama.hosts" → throw: Ollama hosts are required in chat mode
     "ollama.models" → throw: Ollama models are required in chat mode
   }
   ```

### Phase 4: Migration Path for Users

**Documentation to create:**

1. **`docs/migration-from-env-to-jsonc.md`** (new)
   - Step-by-step migration guide
   - Examples showing `.env` → `config.jsonc` mappings
   - Common configuration scenarios
   - Troubleshooting section

2. **`config.example.jsonc`** (new)
   - Minimal working example with all options documented
   - Comments explaining each setting

3. **`docs/configuration.md`** (update existing)
   - Complete configuration reference
   - Explain new structure with diagrams
   - Show examples for different bot modes
   - Document all configurable options

**Example migration:**

```env
# .env (old)
MUSEBOT_FUNCTION=chat
MUSEBOT_DISCORD_TOKEN=12345
MUSEBOT_DISCORD_CHANNELS=1343757467854704732
MUSEBOT_OLLAMA_HOSTS=http://host1:11434/,http://host2:11434/
MUSEBOT_OLLAMA_MODELS=model1,model2
MUSEBOT_OLLAMA_SYSTEM_PROMPT=You are a helpful assistant

# config.jsonc (new)
{
  "botSettings": {
    "botId": "bot-1",
    "nodeEnvironment": "development",
    "mode": "chat",
    "discord": {
      "token": "12345"
    },
    "chatApis": {
      "discord": {
        "channels": ["1343757467854704732"]
      }
    },
    "ollama": {
      "hosts": ["http://host1:11434/", "http://host2:11434/"],
      "models": ["model1", "model2"],
      "systemPrompt": "You are a helpful assistant"
    }
  }
}
```

### Phase 5: Testing Strategy

**Test files to update/create:**

1. **`src/services/environment-settings/EnvironmentSettings.test.ts`**
   - Remove tests for env variable reading
   - Add tests for config object mapping
   - Add tests for mode validation
   - Add tests for missing config files
   - Add tests for both config files existing (warning expected)
   - Add tests for invalid JSON syntax

2. **`src/services/environment-settings/ConfigLoader.test.ts`**
   - Update for new config format
   - Add tests for both config files priority
   - Add tests for config.jsonc priority

3. **`src/app.test.ts`**
   - Update config loading flow tests
   - Add tests for bot settings initialization

4. **`src/services/ServiceContainer.test.ts`**
   - Update for new bot settings structure
   - Add tests for per-bot config extraction

5. **Create new integration tests:**
   - Test complete configuration flow from file to bot services
   - Test validation logic
   - Test error messages

**Test cases:**

1. Config only exists at `config.jsonc`
2. Both config files exist (expect warning, use config.jsonc)
3. Config only exists at `config.json`
4. Invalid JSON syntax (catch and throw)
5. Missing config files (throw with clear message)
6. Invalid mode value (throw with list of valid options)
7. Mode is 'media', no ComfyUI hosts configured (throw)
8. Mode is 'chat', no Ollama hosts configured (throw)
9. Mode is 'chat', no Ollama models configured (warning + log)
10. Environment variable detected (throw with migration guide)
11. Full valid configuration loads successfully
12. All bot-specific settings are accessible

### Phase 6: Cleanup

**Files to remove:**

1. **`.env` file** — Users will delete manually (document in migration guide)
2. **`.env.example`** — Replace with `config.example.jsonc`
3. **`src/services/environment-settings/constants/EnvironmentKey.ts`** — No longer needed
4. **Remove `.env` example file reference** from documentation

**Update documentation:**

1. **README.md**
   - Remove `.env` configuration instructions
   - Add JSON configuration instructions
   - Add link to migration guide

2. **docs/configuration.md** (update)
   - Remove all `.env` examples
   - Add JSON examples
   - Document new `IBotSettings` structure

3. **docs/getting-started.md** (update)
   - Remove `.env` setup instructions
   - Add `config.jsonc` setup instructions
   - Include minimal example

4. **Any installation/setup guides**
   - Update to reflect new configuration format

## Risks

1. **User migration burden:** Users currently using .env must manually migrate
   - **Mitigation:** Comprehensive migration guide with automated helpers, step-by-step instructions, examples for common scenarios, clear error messages during migration

2. **Breaking change:** Existing deployments will break
   - **Mitigation:** Clear error messages, extensive documentation, rollback instructions, extensive test coverage

3. **Development friction:** Developers missing some config options in JSON
   - **Mitigation:** Use `config.jsonc` for development with comments, comprehensive examples in documentation, IDE autocomplete provides guidance

4. **Configuration complexity:** New multi-bot support adds complexity
   - **Mitigation:** Document bot configuration thoroughly, provide examples, clear error messages for misconfiguration

5. **Tooling dependency:** Requires JSON editor support
   - **Mitigation:** JSON is standard format with excellent support in VS Code, JetBrains, and other modern editors

## Future Considerations

- **JSON Schema Validation:** Add schema validation for runtime checks (optional)
- **Multiple Configuration Formats:** Consider supporting `config.yaml`, `config.toml`, or other formats in the future (optional)
- **Configuration Validators:** Add custom validation service for per-bot specific rules
- **Automatic Migration Tool:** Create CLI tool to convert .env to config.jsonc automatically (optional)
- **Hot Reload:** Detect config file changes and reload configuration at runtime (future enhancement)
- **Configuration Versioning:** Track config format version and validate compatibility (future)

## Success Criteria

- ✅ `.env` file processing removed from codebase (EnvironmentSettings.ts lines 145-155 removed)
- ✅ `MUSEBOT_*` environment variables trigger error at startup with clear message
- ✅ All functionality works with JSON configuration only
- ✅ Both config files logged warning but config.jsonc is loaded (priority)
- ✅ Configuration validation catches missing/invalid settings at startup
- ✅ Users can migrate from .env with clear documentation and examples
- ✅ All tests pass with new configuration system (expecting ~269 tests)
- ✅ No breaking changes to internal bot functionality
- ✅ Migration guide completed and published
- ✅ `config.example.jsonc` created with complete examples

## Related

- ADR 001: Multi-Instance Support via Container Hierarchy
- ADR 002: Config Format Compatibility (complementary, not dependent)
- Configuration documentation (`docs/configuration.md`)
- Migration guide (`docs/migration-from-env-to-jsonc.md`)
- `config.json` schema
- `IBotConfig` interface
- `EnvironmentSettings` implementation
- `ConfigLoader` utility