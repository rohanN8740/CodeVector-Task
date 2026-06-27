import { query } from './index';

async function runExplain() {
  console.log('Running EXPLAIN for general browsing...');
  const explainGeneral = await query(`
    EXPLAIN ANALYZE
    SELECT id::text, uuid, name, category, price::float, created_at, updated_at
    FROM products
    ORDER BY created_at DESC, id DESC
    LIMIT 20;
  `);
  console.log(explainGeneral.rows.map(r => r['QUERY PLAN']).join('\n'));

  console.log('\n----------------------------------------\n');

  console.log('Running EXPLAIN with a cursor...');
  // Let's simulate a cursor where created_at < some timestamp
  const explainCursor = await query(`
    EXPLAIN ANALYZE
    SELECT id::text, uuid, name, category, price::float, created_at, updated_at
    FROM products
    WHERE (created_at < $1) OR (created_at = $1 AND id < $2)
    ORDER BY created_at DESC, id DESC
    LIMIT 20;
  `, [new Date(), 100000]);
  console.log(explainCursor.rows.map(r => r['QUERY PLAN']).join('\n'));

  console.log('\n----------------------------------------\n');

  console.log('Running EXPLAIN with category filter and cursor...');
  const explainCategory = await query(`
    EXPLAIN ANALYZE
    SELECT id::text, uuid, name, category, price::float, created_at, updated_at
    FROM products
    WHERE category = $1 
      AND ((created_at < $2) OR (created_at = $2 AND id < $3))
    ORDER BY created_at DESC, id DESC
    LIMIT 20;
  `, ['Electronics', new Date(), 100000]);
  console.log(explainCategory.rows.map(r => r['QUERY PLAN']).join('\n'));
}

runExplain()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
