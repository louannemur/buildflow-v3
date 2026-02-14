import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

const sql = neon(connectionString ?? "postgresql://placeholder:placeholder@localhost/placeholder");

export const db = drizzle(sql, { schema });

export type Database = typeof db;
