// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Dictionary<Key extends keyof any, Value> = {
    [key in Key]: Value; // Mapped types syntax
};
