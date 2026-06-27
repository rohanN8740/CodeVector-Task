import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is missing.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString,
  max: 20, // max number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
