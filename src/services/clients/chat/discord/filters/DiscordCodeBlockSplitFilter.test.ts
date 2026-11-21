import { describe, expect, it } from '@jest/globals';

import { IChatMessage } from '../../IChatMessage.js';
import { DiscordCodeBlockSplitFilter } from './DiscordCodeBlockSplitFilter.js';

describe('DiscordCodeBlockSplitFilter', (): void => {
  it('keeps reopened code-block continuations within the Discord message length limit', async (): Promise<void> => {
    // A code block straddling a split boundary: the continuation chunk is
    // long enough that prepending the reopened fence pushes it past
    // DiscordConstants.ContentMaxLength (1997 + 14 = 2011 chars).
    const filter = new DiscordCodeBlockSplitFilter();
    const messages: IChatMessage[] = [
      { content: '```typescript\n' + 'x'.repeat(1990), attachments: [] },
      { content: 'y'.repeat(1997), attachments: [] },
    ];

    const result = await filter.process(messages);

    for (const message of result) {
      expect(message.content.length).toBeLessThanOrEqual(2000);
    }
  });
});
