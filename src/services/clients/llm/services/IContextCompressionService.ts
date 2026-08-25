export interface IContextCompressionService {
  compressIfNeeded(channelId: string): Promise<void>;
}