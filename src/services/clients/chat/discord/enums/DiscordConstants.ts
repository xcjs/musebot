export class DiscordConstants {
  public static readonly ContentMaxLength = 2000;
  public static readonly InviteLink = 'https://discord.gg/qZMzFA8Apd';
  public static readonly MaxAttachmentDescriptionLength = 1024;
  public static readonly MaxAttachmentsPerMessage = 10;
  public static readonly MaxMediaAttachmentsPerMessage = 10;
  public static readonly StateFileName = 'Prompt.dat';
  public static readonly MaxButtonsPerActionRow = 5;

  /**
   * Discord's message-edit bucket allows 5 edits per 5 seconds per channel
   * (~1 edit per second sustained). Streaming LLM output paced above this
   * rate accumulates a 429 backlog inside discord.js, which stalls each
   * awaited edit and manifests as the stream freezing mid-response.
   */
  public static readonly MaxStreamingEditsPerSecond = 1;

  public static readonly ShardCountAuto = 'auto';
}
