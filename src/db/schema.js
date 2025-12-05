import { timestamptz } from 'drizzle-orm/gel-core';
import { pgTable, serial, integer, numeric, text, date, boolean } from 'drizzle-orm/pg-core';

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
  role_id: integer('role_id').references(() => role.role_id),
  status: text('status').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const farmer_profile = pgTable('farmer_profile', {
  farmer_id: serial('farmer_id').primaryKey(),
  user_id: integer('user_id').references(() => user.user_id, { onDelete: 'cascade' }).notNull(),
  nic: text('nic').notNull().unique(),
  address: text('address').notNull(),
  gender: text('gender').notNull(),
  date_of_birth: date('date_of_birth'),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const farms = pgTable('farms', {
  farm_id: serial('farm_id').primaryKey(),
  farmer_id: integer('farmer_id').references(() => farmer_profile.farmer_id, { onDelete: 'cascade' }).notNull(),
  farm_name: text('farm_name').notNull(),
  gps_coordinates: text('gps_coordinates').notNull(),
  area_acres: numeric('area_acres').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const main = pgTable('main', {
  batch_no: text('batch_no').primaryKey(),
  farm_id: integer('farm_id').references(() => farms.farm_id, { onDelete: 'cascade' }),
  farmer_id: integer('farmer_id').references(() => farmer_profile.farmer_id, { onDelete: 'cascade' }),
  cultivation_id: integer('cultivation_id').references(() => cultivation.cultivation_id, { onDelete: 'cascade' }),
  is_harvested: boolean('is_harvested').default(false),
  harvest_id: integer('harvest_id').references(() => harvest.harvest_id, { onDelete: 'cascade' }),
  harvested_quantity: numeric('harvested_quantity'),
  collect_id: integer('collect_id').references(() => collect_table.collect_id, { onDelete: 'cascade' }),
  is_collected: boolean('is_collected').default(false),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const collect_table = pgTable('collect_table', {
  collect_id: serial('collect_id').primaryKey(),
  batch_no: text('batch_no').references(() => main.batch_no, { onDelete: 'cascade' }).notNull(),
  collector_id: integer('collector_id').references(() => collector_profile.collector_id, { onDelete: 'cascade' }).notNull(),
  collected_date: date('collected_date').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const harvest = pgTable('harvest', {
  harvest_id: serial('harvest_id').primaryKey(),
  batch_no: text('batch_no').references(() => main.batch_no, { onDelete: 'cascade' }),
  harvest_date: date('harvest_date'),
  harvest_method: text('harvest_method'),
  quantity: numeric('quantity'),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const cultivation = pgTable('cultivation', {
  cultivation_id: serial('cultivation_id').primaryKey(),
  batch_no: text('batch_no').references(() => main.batch_no, { onDelete: 'cascade' }),
  date_of_planting: date('date_of_planting'),
  seeding_source: text('seeding_source'),
  type_of_fertilizers: text('type_of_fertilizers'),
  pesticides: text('pesticides'),
  organic_certification: text('organic_certification'),
  expected_harvest_date: date('expected_harvest_date'),
  no_of_trees: integer('no_of_trees'),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});

export const collector_profile = pgTable('collector_profile', {
  collector_id: serial('collector_id').primaryKey(),
  user_id: integer('user_id').references(() => user.user_id, { onDelete: 'cascade' }).notNull(),
  center_name: text('center_name').notNull(),
  vehicle_id: text('vehicle_id').notNull(),
  location: text('location').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
  updated_at: timestamptz('updated_at').defaultNow()
});
