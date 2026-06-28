import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './db';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "CodeVector Backend API is running 🚀",
    version: "2.0",
    endpoints: {
      products: "/api/products",
      categories: "/api/categories",
      simulateAdd: "POST /api/products/simulate-add",
      simulateUpdate: "POST /api/products/simulate-update"
    }
  });
});

// Helper to encode a cursor to base64
function encodeCursor(createdAt: Date, id: string): string {
  const jsonStr = JSON.stringify({ createdAt: createdAt.toISOString(), id });
  return Buffer.from(jsonStr).toString('base64');
}

// Helper to decode a cursor from base64
function decodeCursor(cursorStr: string): { createdAt: Date; id: string } | null {
  try {
    const jsonStr = Buffer.from(cursorStr, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (parsed.createdAt && parsed.id) {
      return { createdAt: new Date(parsed.createdAt), id: parsed.id };
    }
    return null;
  } catch (err) {
    return null;
  }
}

// 1. GET /api/products - Paginated product feed
app.get('/api/products', async (req: Request, res: Response): Promise<void> => {
  console.log("GET /api/products called");
  const category = req.query.category as string | undefined;
  const cursorStr = req.query.cursor as string | undefined;
  const limit = parseInt(req.query.limit as string) || 20;

  // We query for limit + 1 items to see if there is a next page
  const fetchLimit = limit + 1;
  const cursor = cursorStr ? decodeCursor(cursorStr) : null;

  let sql = '';
  const params: any[] = [];
  
  const startTime = process.hrtime();

  try {
    if (category) {
      params.push(category);
      if (cursor) {
        // Keyset pagination query with category filter
        params.push(cursor.createdAt, cursor.id, fetchLimit);
        sql = `
          SELECT id::text, uuid, name, category, price::float, created_at, updated_at
          FROM products
          WHERE category = $1 
            AND ((created_at < $2) OR (created_at = $2 AND id < $3))
          ORDER BY created_at DESC, id DESC
          LIMIT $4;
        `;
      } else {
        // Page 1 with category filter
        params.push(fetchLimit);
        sql = `
          SELECT id::text, uuid, name, category, price::float, created_at, updated_at
          FROM products
          WHERE category = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2;
        `;
      }
    } else {
      if (cursor) {
        // Keyset pagination query (general)
        params.push(cursor.createdAt, cursor.id, fetchLimit);
        sql = `
          SELECT id::text, uuid, name, category, price::float, created_at, updated_at
          FROM products
          WHERE (created_at < $1) OR (created_at = $1 AND id < $2)
          ORDER BY created_at DESC, id DESC
          LIMIT $3;
        `;
      } else {
        // Page 1 (general)
        params.push(fetchLimit);
        sql = `
          SELECT id::text, uuid, name, category, price::float, created_at, updated_at
          FROM products
          ORDER BY created_at DESC, id DESC
          LIMIT $1;
        `;
      }
    }

    const dbResult = await query(sql, params);
    const endTime = process.hrtime(startTime);
    const executionTimeMs = parseFloat((endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2));

    const rows = dbResult.rows;
    const hasMore = rows.length > limit;
    
    // If we fetched limit + 1 rows, pop the last row
    const paginatedRows = hasMore ? rows.slice(0, limit) : rows;
    
    // Generate next cursor from the last item in the page
    let nextCursor: string | null = null;
    if (hasMore && paginatedRows.length > 0) {
      const lastItem = paginatedRows[paginatedRows.length - 1];
      nextCursor = encodeCursor(new Date(lastItem.created_at), lastItem.id);
    }

    res.json({
      success: true,
      products: paginatedRows,
      nextCursor,
      count: paginatedRows.length,
      executionTimeMs,
    });
  } catch (err: any) {
  console.error("GET /api/products failed");
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Failed to fetch products",
    error: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined
  });
  }
});

// 2. GET /api/categories - Get distinct categories
app.get('/api/categories', async (req: Request, res: Response) => {
  const startTime = process.hrtime();
  try {
    // Standard SELECT DISTINCT is fast because category is indexed composite-ly
    const dbResult = await query('SELECT DISTINCT category FROM products ORDER BY category;');
    const endTime = process.hrtime(startTime);
    const executionTimeMs = parseFloat((endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2));

    const categories = dbResult.rows.map(row => row.category);
    res.json({ success: true, categories, executionTimeMs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/products/simulate-add - Simulate 50 new product additions
app.post('/api/products/simulate-add', async (req: Request, res: Response) => {
  const CATEGORIES = ['Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Sports & Outdoors', 'Beauty & Personal Care', 'Automotive', 'Toys & Games'];
  const ADJECTIVES = ['Premium', 'Wireless', 'Ergonomic', 'Smart', 'Eco-Friendly', 'Portable', 'Durable', 'Classic', 'Modern', 'Ultra'];
  const NOUNS = ['Headphones', 'Chair', 'Watch', 'Blender', 'Backpack', 'Lamp', 'Speaker', 'Keyboard', 'Bottle', 'Desk'];

  try {
    const values: any[] = [];
    const valueRows: string[] = [];
    
    // We insert with created_at = current time (newest)
    const now = new Date();

    for (let i = 0; i < 50; i++) {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      const name = `${adj} ${noun} (Simulated New #${Math.floor(Math.random() * 9000 + 1000)})`;
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      const price = parseFloat((Math.random() * 995 + 5).toFixed(2));
      
      const valIdx = i * 5;
      valueRows.push(`($${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, $${valIdx + 4}, $${valIdx + 5})`);
      values.push(name, category, price, now, now);
    }

    const sql = `
      INSERT INTO products (name, category, price, created_at, updated_at)
      VALUES ${valueRows.join(', ')}
      RETURNING id::text, uuid, name, category, price::float, created_at, updated_at;
    `;

    const dbResult = await query(sql, values);
    res.json({ success: true, message: 'Successfully added 50 simulated products', added: dbResult.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/products/simulate-update - Simulate updating 50 random products
app.post('/api/products/simulate-update', async (req: Request, res: Response) => {
  try {
    // 1. Fetch 50 random product IDs
    const selectRes = await query('SELECT id::text FROM products ORDER BY random() LIMIT 50;');
    const ids = selectRes.rows.map(row => row.id);

    if (ids.length === 0) {
       res.json({ success: true, message: 'No products to update', updatedCount: 0 });
       return;
    }

    // 2. Update them - change name suffix and update price slightly
    const now = new Date();
    
    // We can do it in a single transaction or query to be fast
    // We'll update their names to start with "Updated" and update their price
    // Since created_at is NOT updated, they will not shift position if we sort by created_at.
    const sql = `
      UPDATE products
      SET name = CONCAT('Updated ', name),
          price = price * 1.05,
          updated_at = $1
      WHERE id = ANY($2)
      RETURNING id::text, name, category, price::float, created_at, updated_at;
    `;

    const updateRes = await query(sql, [now, ids]);
    res.json({ 
      success: true, 
      message: `Successfully updated ${updateRes.rowCount} products`, 
      updated: updateRes.rows 
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

console.log("================================");
console.log("🚀 CodeVector Backend Started");
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Port: ${port}`);
console.log("================================");

// Start the server
app.listen(port, () => {
  console.log(`✅ Server listening on port ${port}`);
});
