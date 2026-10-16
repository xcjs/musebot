import { describe, expect, it } from '@jest/globals';

import { LlmModality } from './LlmModality.js';

describe('LlmModality', () => {
  it('uses lowercase config values', (): void => {
    expect(LlmModality.Text).toBe('text');
    expect(LlmModality.Image).toBe('image');
    expect(LlmModality.Video).toBe('video');
    expect(LlmModality.Audio).toBe('audio');
  });
});