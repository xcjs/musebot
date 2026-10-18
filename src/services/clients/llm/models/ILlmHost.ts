export interface ILlmHost {
  url: URL;
  token: string | null;
  isLocal: boolean | null;
}