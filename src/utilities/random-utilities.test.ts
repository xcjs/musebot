import { describe, expect, it } from '@jest/globals';

import { getRandomArrayEntry, getRandomInt } from './random-utilities.js';

describe('random-utilities', () => {
    describe('getRandomInt()', () => {
        it('should return a number within the range', () => {
            for (let i = 0; i < 100; i++) {
                const result = getRandomInt(1, 10);
                expect(result).toBeGreaterThanOrEqual(1);
                expect(result).toBeLessThanOrEqual(10);
            }
        });

        it('should return the minimum value when min equals max', () => {
            const result = getRandomInt(5, 5);
            expect(result).toBe(5);
        });

        it('should handle negative numbers', () => {
            for (let i = 0; i < 100; i++) {
                const result = getRandomInt(-10, -5);
                expect(result).toBeGreaterThanOrEqual(-10);
                expect(result).toBeLessThanOrEqual(-5);
            }
        });

        it('should handle range including zero', () => {
            for (let i = 0; i < 100; i++) {
                const result = getRandomInt(-5, 5);
                expect(result).toBeGreaterThanOrEqual(-5);
                expect(result).toBeLessThanOrEqual(5);
            }
        });

        it('should work with large ranges', () => {
            const result = getRandomInt(0, 1000000);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(1000000);
        });

        it('should include both min and max values over many calls', () => {
            const results = new Set<number>();
            for (let i = 0; i < 1000; i++) {
                results.add(getRandomInt(1, 3));
            }
            // With 1000 calls, we should get all values 1, 2, and 3
            expect(results.has(1)).toBe(true);
            expect(results.has(2)).toBe(true);
            expect(results.has(3)).toBe(true);
        });
    });

    describe('getRandomArrayEntry()', () => {
        it('should return an element from the array', () => {
            const arr = [1, 2, 3, 4, 5];
            for (let i = 0; i < 100; i++) {
                const result = getRandomArrayEntry(arr);
                expect(arr).toContain(result);
            }
        });

        it('should return null for empty array', () => {
            const result = getRandomArrayEntry<number>([]);
            expect(result).toBeNull();
        });

        it('should return the only element for single-element array', () => {
            const result = getRandomArrayEntry([42]);
            expect(result).toBe(42);
        });

        it('should work with string arrays', () => {
            const arr = ['apple', 'banana', 'cherry'];
            for (let i = 0; i < 100; i++) {
                const result = getRandomArrayEntry(arr);
                expect(arr).toContain(result);
            }
        });

        it('should work with object arrays', () => {
            const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
            for (let i = 0; i < 100; i++) {
                const result = getRandomArrayEntry(arr);
                expect(arr).toContainEqual(result);
            }
        });

        it('should return different values over multiple calls', () => {
            const arr = [1, 2, 3, 4, 5];
            const results = new Set<number>();
            
            for (let i = 0; i < 100; i++) {
                results.add(getRandomArrayEntry(arr));
            }
            
            // With 100 calls on a 5-element array, we should see multiple different values
            expect(results.size).toBeGreaterThan(1);
        });
    });
});
