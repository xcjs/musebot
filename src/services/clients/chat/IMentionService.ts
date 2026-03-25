export interface IMentionService<UserType> {
    mention(user: UserType | null | undefined): string;

    getMessageWithoutBotMentions(message: string, botMention: string, botRoleMention: string): string;
}
