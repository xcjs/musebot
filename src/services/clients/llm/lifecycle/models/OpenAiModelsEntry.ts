export interface OpenAiModelsEntry {
  id?: string;
  context_length?: number;
  architecture?: { input_modalities?: string[] | string };
}