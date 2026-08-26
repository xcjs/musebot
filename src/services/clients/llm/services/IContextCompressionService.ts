export interface ITokenCountSample {
  promptTokenCount: number;
  responseTokenCount: number;
}

export interface IContextCompressionService {
  compressIfNeeded(channelId: string, tokenCountSample?: ITokenCountSample): Promise<void>;
}