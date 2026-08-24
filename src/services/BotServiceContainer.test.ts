import { describe, expect, it } from '@jest/globals';

import { BotInteraction } from '../enums/BotInteraction.js';
import { createMockServiceContainer } from '../test-utils/mockBotServiceContainer.js';
import { BotServiceContainer } from './BotServiceContainer.js';
import type { IWorkflow } from './clients/media/comfy-ui/models/IWorkflow.js';
import { SupportedFeature } from './features/enum/SupportedFeature.js';

describe('BotServiceContainer.getWorkflowMutator', () => {
  it('throws when zero mutators match the interaction/type pair', (): void => {
    const mockContainer = createMockServiceContainer() as unknown as BotServiceContainer;

    expect(() => {
      void BotServiceContainer.prototype.getWorkflowMutator.call(
        mockContainer,
        'NonExistentInteraction' as unknown as BotInteraction,
        { type: SupportedFeature.Img2Img, name: 'workflow' } as IWorkflow
      );
    }).toThrow(/not supported by your current configuration/);
  });
});