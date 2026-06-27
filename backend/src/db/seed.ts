import fs from 'fs';
import path from 'path';
import { pool } from './index';

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Kitchen',
  'Books',
  'Sports & Outdoors',
  'Beauty & Personal Care',
  'Automotive',
  'Toys & Games'
];

const ADJECTIVES = ['Premium', 'Wireless', 'Ergonomic', 'Smart', 'Eco-Friendly', 'Portable', 'Durable', 'Classic', 'Modern', 'Ultra'];
const NOUNS = ['Headphones', 'Chair', 'Watch', 'Blender', 'Backpack', 'Lamp', 'Speaker', 'Keyboard', 'Bottle', 'Desk'];

function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Reading schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    console.log('Resetting schema and recreating tables/indexes...');
    await client.query(schemaSql);
    console.log('Schema reset complete.');

    console.log('Starting seed generation...');
    const totalRecords = 200000;
    const batchSize = 4000; // 4000 rows * 5 parameters = 20,000 parameters (well under PG parameter limits)
    const startTime = Date.now();

    let insertedCount = 0;
    const now = new Date();

    for (let i = 0; i < totalRecords; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalRecords - i);
      const valueRows: string[] = [];
      const values: any[] = [];
      
      for (let j = 0; j < currentBatchSize; j++) {
        const index = i + j;
        const name = `${generateName()} #${index + 1}`;
        const category = CATEGORIES[index % CATEGORIES.length];
        const price = parseFloat((Math.random() * 995 + 5).toFixed(2));
        
        // Spread out created_at timestamps.
        // Product 0 is created "now".
        // Product i is created i minutes ago.
        const createdAt = new Date(now.getTime() - index * 60000); 
        const updatedAt = createdAt;

        const valIdx = j * 5;
        valueRows.push(`($${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, $${valIdx + 4}, $${valIdx + 5})`);
        values.push(name, category, price, createdAt, updatedAt);
      }

      const queryText = `
        INSERT INTO products (name, category, price, created_at, updated_at) 
        VALUES ${valueRows.join(', ')}
      `;

      await client.query(queryText, values);
      insertedCount += currentBatchSize;
      
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`Inserted ${insertedCount}/${totalRecords} products (${elapsedSeconds}s)...\r`);
    }

    console.log(`\nSuccessfully seeded ${insertedCount} products in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds!`);
  } catch (err) {
    console.error('\nError during seeding:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
