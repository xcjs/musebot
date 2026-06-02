# ADR 002: Config Format Compatibility

## Status

Proposed

## Context

Musebot uses two configuration file formats: `.env` and `config.json`.

**`.env` format (comma-separated strings):**
```env
DISCORD_CHANNELS=1343757467854704732,1343757467854704733
OLLAMA_HOSTS=http://host1:11434/,http://host2:11434/
OLLAMA_MODELS=model1,model2,model3
```

**`config.json` format (native arrays):**
```json
{
  "discordChannels": ["1343757467854704732", "1343757467854704733"],
  "ollamaHosts": ["http://host1:11434/", "http://host2:11434/"],
  "ollamaModels": ["model1", "model2", "model3"]
}
```

The current implementation supports only the `.env` format through `EnvironmentSettings`. The `IBotConfig` interface expects strings for delimited values, which prevents using the modern JSON array format from `config.json`.

## Decision

Allow both `.env` (comma-separated strings) and `config.json` (native arrays) formats for delimited configuration values by:

1. Updating `IBotConfig` types to accept `string | string[]` for delimited fields
2. Adding `#normalizeConfigValue()` helper method to `EnvironmentSettings` that converts both formats to arrays
3. Updating the constructor to normalize all delimited fields using this helper

This approach maintains full backward compatibility with `.env` files while supporting the modern JSON array format.

## Rationale

**Maintains Backward Compatibility**
Existing `.env` configurations continue to work without modification.

**Improves Developer Experience**
JSON arrays provide better IDE autocomplete, type safety, and are more intuitive for configuration editors.

**Future-Proof**
Allows configuration to evolve without breaking changes. New fields can use arrays by default, while older `.env` files can continue using comma-separated strings.

**Consistent API**
All delimited configuration values are normalized to arrays before use, ensuring a single source of truth within the codebase.

**Type Safety**
TypeScript interface updates prevent type mismatches and provide better compile-time error checking.

## Consequences

### Positive

- Developers can use either `.env` or `config.json` format
- IDE autocomplete and validation for array-based configuration
- Cleaner, more maintainable configuration files
- No breaking changes to existing `.env` files

### Negative

- Slightly more complex `IBotConfig` type definitions
- Additional normalization logic in constructor
- Documentation must clarify both supported formats

### Neutral

- No performance impact (normalization happens once at startup)
- No API changes for consuming code
- Configuration loading behavior is transparent to users

## Implementation

### Type Changes

Update `IBotConfig` interface to accept both `string` and `string[]` types for delimited fields:

```typescript
export interface IBotConfig {
    discordChannels?: string | string[];
    discordChannelsDisallowed?: string | string[];
    botPrivateMessageUsers?: string | string[];
    stableDiffusionHosts?: string | string[];
    ollamaHosts?: string | string[];
    ollamaModels?: string | string[];
    stableDiffusionOllamaPrompts?: string | string[];
    // ... other fields
}
```

### Method Addition

Add helper method to `EnvironmentSettings`:

```typescript
/**
 * Normalizes a configuration value to an array.
 * Accepts both comma-separated strings and native arrays.
 *
 * @param value - The value to normalize (string or string[])
 * @param separator - The separator used if the value is a string (default: ',')
 * @returns An array of strings
 */
#normalizeConfigValue<T extends string>(
    value: T | T[],
    separator: string = ','
): string[] {
    if (Array.isArray(value)) {
        return value;
    }
    return this.#parseDelimitedList(value, separator);
}
```

### Constructor Updates

Update delimited field assignments:

```typescript
// Before
this.#discordChannels = config?.discordChannels
    ? this.#parseDelimitedList(config.discordChannels, ',')
    : this.#readDelimitedList(EnvironmentKey.ChatChannels, ',');

// After
this.#discordChannels = config?.discordChannels
    ? this.#normalizeConfigValue(config.discordChannels, ',')
    : this.#readDelimitedList(EnvironmentKey.ChatChannels, ',');
```

Apply similar updates to:
- `discordChannelsDisallowed`
- `botPrivateMessageUsers`
- `stableDiffusionHosts`
- `ollamaHosts`
- `ollamaModels`
- `stableDiffusionOllamaPrompts`

## Testing

Existing test coverage should verify both formats work correctly. New tests may be added for:

1. String input normalization
2. Array input normalization
3. Empty string handling
4. Mixed whitespace trimming
5. Backward compatibility with `.env` files

## Related

- ADR 001: Initial Service Container Design
- `.env` file format documentation
- `config.json` schema
- `IBotConfig` interface
- `EnvironmentSettings` implementation