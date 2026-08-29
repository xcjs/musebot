import { Client as DiscordClient, GuildTextBasedChannel, Message as DiscordMessage } from 'discord.js';

import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IFeatureService } from '../../../../features/IFeatureService.js';
import { DiscordAttachmentService } from '../services/DiscordAttachmentService.js';

const attachmentService = new DiscordAttachmentService();

export function collectBackfillChannels(client: DiscordClient, disallowedChannelIds: string[]): GuildTextBasedChannel[] {
  const channels: GuildTextBasedChannel[] = [];

  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isTextBased() || channel.isVoiceBased()) {
        continue;
      }

      if (disallowedChannelIds.includes(channel.id)) {
        continue;
      }

      if (!(channel as GuildTextBasedChannel).viewable) {
        continue;
      }

      channels.push(channel as GuildTextBasedChannel);
    }
  }

  return channels;
}

export function isBackfillParticipant(message: DiscordMessage, userId: string, botId: string): boolean {
  if (message.author.id !== userId && message.author.id !== botId) {
    return false;
  }

  if (message.author.bot && message.author.id !== botId) {
    return false;
  }

  return true;
}

export function isStorableMessage(message: DiscordMessage, featureService: IFeatureService): boolean {
  const hasText = message.content.trim().length > 0;
  const hasImages = featureService.hasFeature(SupportedFeature.Vision)
    && attachmentService.getImageAttachments(message).length > 0;

  return hasText || hasImages;
}