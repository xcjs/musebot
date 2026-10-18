export interface ILlmLifecycleStrategy {
  free(): Promise<boolean>;
  isModelLoaded(): Promise<boolean>;
  waitForModelUnload(intervalMs?: number): Promise<boolean>;
  getContextWindow(): Promise<number | null>;
  hasVisionCapability(model?: string): Promise<boolean>;
}