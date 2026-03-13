export type Dictionary<Key extends keyof unknown, Value> = {
    [key in Key]: Value; // Mapped types syntax
};
