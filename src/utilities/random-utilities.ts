export function getRandomInt(minValue, maxValue) {
    const minCeiled = Math.ceil(minValue);
    // Add one to maxSeedValue since this excludes the ceiling value.
    const maxFloored = Math.floor(maxValue + 1);

    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}
