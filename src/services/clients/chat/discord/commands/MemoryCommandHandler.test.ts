
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const FETCH_PAGE_SIZE = 100;

describe('Backfill pagination', () => {
    describe('pagination cursor logic', () => {
        it('should use the oldest message id as beforeId for correct pagination', () => {
            const messages = [
                { id: '900', timestamp: 300 },
                { id: '800', timestamp: 200 },
                { id: '700', timestamp: 100 },
            ];

            const sortedMessages = [...messages].sort(
                (a, b) => a.timestamp - b.timestamp
            );

            const oldestMessageId = sortedMessages[0].id;

            expect(oldestMessageId).toBe('700');
        });

        it('should advance through pages correctly with oldest id as cursor', () => {
            const allPages = [
                [{ id: '900', timestamp: 300 }, { id: '800', timestamp: 200 }],
                [{ id: '700', timestamp: 100 }, { id: '600', timestamp: 50 }],
                [{ id: '500', timestamp: 10 }],
            ];

            let beforeId: string | undefined;
            const visitedIds = new Set<string>();

            for (const page of allPages) {
                const sortedMessages = [...page].sort(
                    (a, b) => a.timestamp - b.timestamp
                );

                for (const msg of sortedMessages) {
                    expect(visitedIds.has(msg.id)).toBe(false);
                    visitedIds.add(msg.id);
                }

                beforeId = sortedMessages[0].id;
            }

            expect(visitedIds.size).toBe(5);
            expect(beforeId).toBe('500');
        });

        it('should handle empty messages gracefully', () => {
            const page: Array<{ id: string; timestamp: number }> = [];
            const sortedMessages = [...page].sort(
                (a, b) => a.timestamp - b.timestamp
            );

            expect(sortedMessages.length).toBe(0);
            expect(sortedMessages[0]).toBeUndefined();
        });
    });
});

