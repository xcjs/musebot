export interface IContextCompressionService {
  compressIfNeeded(channelId: string): Promise<void>;
  compressNow(channelId: string): Promise<void>;
}