import { timestamptz } from 'drizzle-orm/gel-core';
import { pgTable, serial, text, date } from 'drizzle-orm/pg-core';

export const role = pgTable('role', {
  role_id: serial('role_id').primaryKey(),
  role_name: text('role_name').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
});

export const user = pgTable('user', {
  user_id: serial('user_id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  password_hash: text('password_hash').notNull(),
  phone: text('phone').notNull(),
  role_id: serial('role_id').references(() => role.role_id),
  status: text('status').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});


export const farmer_profile = pgTable('farmer_profile', {
  farmer_id: serial('farmer_id').primaryKey(),
  user_id: serial('user_id').references(() => user.user_id, { onDelete: 'cascade' }).notNull(),
  nic: text('nic').notNull(),
  address: text('address').notNull(),
  gender: text('gender').notNull(),
  date_of_birth: date('date_of_birth'),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

