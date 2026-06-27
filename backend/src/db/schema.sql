-- Drop table if exists (for resetting)
DROP TABLE IF EXISTS products;

-- Create products table
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for general browsing sorted by newest first
CREATE INDEX idx_products_created_at_id ON products (created_at DESC, id DESC);

-- Index for category-filtered browsing sorted by newest first
CREATE INDEX idx_products_category_created_at_id ON products (category, created_at DESC, id DESC);
