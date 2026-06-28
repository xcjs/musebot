import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const UserConsent = sqliteTable('UserConsent', {
    userId: text('userId').primaryKey(),
    consentedAt: text('consentedAt').notNull()
});

export const LlmChatMessageRecord = sqliteTable('LlmChatMessage', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('userId').notNull(),
    serverId: text('serverId'),
    content: text('content').notNull(),
    messageText: text('messageText').notNull(),
    isBot: integer('isBot', { mode: 'boolean' }).notNull(),
    embeddingModel: text('embeddingModel').notNull(),
    createdAt: text('createdAt').notNull()
});