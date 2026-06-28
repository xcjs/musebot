import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const UserConsent = sqliteTable('UserConsent', {
    userId: text('userId').primaryKey(),
    consentedAt: text('consentedAt').notNull(),
    backfillCompleted: integer('backfillCompleted', { mode: 'boolean' }).notNull().default(false)
});

export const LlmChatMessageRecord = sqliteTable('LlmChatMessage', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('userId').notNull(),
    serverId: text('serverId'),
    content: text('content').notNull(),
    messageText: text('messageText').notNull(),
    isBot: integer('isBot', { mode: 'boolean' }).notNull(),
    embeddingModel: text('embeddingModel').notNull(),
    discordMessageId: text('discordMessageId'),
    createdAt: text('createdAt').notNull()
});