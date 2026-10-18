import { describe, expect, it } from '@jest/globals';

import { LlmRole } from './LlmRole.js';

describe('LlmRole', () => {
  it('matches OpenAI role strings', (): void => {
    expect(LlmRole.User).toBe('user');
    expect(LlmRole.System).toBe('system');
    expect(LlmRole.Assistant).toBe('assistant');
  });
});