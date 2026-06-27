import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// We will parse the DATABASE_URL to connect to the 'postgres' default database first
// so we can create the 'products_db' if it doesn't exist.
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/products_db';

// Extract connection details and point to 'postgres' system database
const urlObj = new URL(dbUrl);
const originalDbName = urlObj.pathname.substring(1);
urlObj.pathname = '/postgres';
const systemDbUrl = urlObj.toString();

async function checkAndCreateDb() {
  console.log(`Connecting to database system at: ${urlObj.host} as ${urlObj.username}...`);
  
  const client = new Client({
    connectionString: systemDbUrl,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL system database.');

    // Check if target database exists
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [originalDbName]);
    
    if (res.rowCount === 0) {
      console.log(`Database '${originalDbName}' does not exist. Creating it...`);
      // CREATE DATABASE cannot run inside a transaction block, pg does not start transaction by default for single queries
      await client.query(`CREATE DATABASE "${originalDbName}"`);
      console.log(`Database '${originalDbName}' created successfully!`);
    } else {
      console.log(`Database '${originalDbName}' already exists.`);
    }
  } catch (err: any) {
    console.error('Failed to connect or create database:');
    console.error(err.message);
    console.error('\nTIP: Please verify the connection credentials (username/password) in backend/.env');
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkAndCreateDb();
