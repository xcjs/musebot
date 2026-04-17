export function getRandomInt(minValue: number, maxValue: number): number {
    const minCeiled = Math.ceil(minValue);
    // Add one to maxSeedValue since this excludes the ceiling value.
    const maxFloored = Math.floor(maxValue + 1);

    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

export function getRandomArrayEntry<T>(items: Array<T>): T | null {
    if (items.length === 0) {
        return null;
    }
    const model = items[getRandomInt(0, items.length - 1)];

    return model;
}
