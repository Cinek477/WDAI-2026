import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('records',{id:text('id').notNull(),kind:text('kind').notNull(),data:text('data').notNull(),position:integer('position').notNull()},table=>[primaryKey({columns:[table.kind,table.id]})]);
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const messages=sqliteTable('messages',{id:text('id').primaryKey(),email:text('email').notNull(),category:text('category').notNull(),details:text('details').notNull(),message:text('message').notNull(),created:text('created').notNull(),is_read:integer('is_read').notNull().default(0),mail_status:text('mail_status').notNull().default('not_configured'),sender:text('sender').notNull()});
