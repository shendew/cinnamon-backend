import { timestamptz } from 'drizzle-orm/gel-core';
import { pgTable, serial, integer, numeric, text, date } from 'drizzle-orm/pg-core';

export const role = pgTable('role', {
  role_id: serial('role_id').primaryKey(),
  role_name: text('role_name').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
});

export const user = pgTable('user', {
  user_id: serial('user_id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
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
  nic: text('nic').notNull().unique(),
  address: text('address').notNull(),
  gender: text('gender').notNull(),
  date_of_birth: date('date_of_birth'),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});


export const farms = pgTable('farms', {
  farm_id: serial('farm_id').primaryKey(),
  farmer_id: serial('farmer_id').references(() => farmer_profile.farmer_id, { onDelete: 'cascade' }).notNull(),
  farm_name: text('farm_name').notNull(),
  gps_coordinates: text('gps_coordinates').notNull(),
  area_acres: numeric('area_acres').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const cultivation = pgTable('cultivation', {
  batch_id: serial('batch_id').primaryKey(),
  farm_id: serial('farm_id').references(() => farms.farm_id, { onDelete: 'cascade' }).notNull(),
  farmer_id: serial('farmer_id').references(() => farmer_profile.farmer_id, { onDelete: 'cascade' }).notNull(),
  date_of_planting: date('date_of_planting').notNull(),
  seeding_source: text('seeding_source').notNull(),
  type_of_fertilizer: text('type_of_fertilizer').notNull(),
  pesticides: text('pesticides').notNull(),
  organic_certification: text('organic_certification').notNull(),
  expected_harvest_date: date('expected_harvest_date').notNull(),
  no_of_trees: integer('no_of_trees').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const harvest = pgTable('harvest', {
  harvest_id: serial('harvest_id').primaryKey(),
  farm_id: serial('farm_id').references(() => farms.farm_id, { onDelete: 'cascade' }).notNull(),
  batch_id: serial('batch_id').references(() => cultivation.batch_id, { onDelete: 'cascade' }).notNull(),
  harvest_date: date('harvest_date').notNull(),
  harvest_method: text('harvest_method').notNull(),
  quantity: numeric('quantity').notNull(),
  moisture_content: numeric('moisture_content').notNull(),
  flagged: text('flagged').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});