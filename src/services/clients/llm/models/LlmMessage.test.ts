import { describe, expect, it } from '@jest/globals';

import { LlmRole } from '../enums/LlmRole.js';
import { LlmMessage } from './LlmMessage.js';

describe('LlmMessage', () => {
  it('accepts role, content, and optional base64 images', (): void => {
    const message: LlmMessage = { role: LlmRole.User, content: 'hi', images: ['aGk='] };
    expect(message.role).toBe('user');
    expect(message.content).toBe('hi');
    expect(message.images).toEqual(['aGk=']);
  });
});