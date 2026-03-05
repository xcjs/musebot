import { describe, expect, it } from '@jest/globals';

import { NoOpTaskChannelPostProcessor } from './NoOpTaskChannelPostProcessor.js';

describe('NoOpTaskChannelPostProcessor', () => {
    describe('postProcess()', () => {
        it('should return a promise that resolves to void', async () => {
            const processor = new NoOpTaskChannelPostProcessor();
            
            const result = await processor.postProcess();
            
            expect(result).toBeUndefined();
        });

        it('should return a promise (not a value directly)', () => {
            const processor = new NoOpTaskChannelPostProcessor();
            
            const result = processor.postProcess();
            
            expect(result).toBeInstanceOf(Promise);
        });

        it('should be callable multiple times', async () => {
            const processor = new NoOpTaskChannelPostProcessor();
            
            await processor.postProcess();
            await processor.postProcess();
            await processor.postProcess();
            
            // Should not throw
        });
    });
});
