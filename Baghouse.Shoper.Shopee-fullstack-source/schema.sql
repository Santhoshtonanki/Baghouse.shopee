CREATE DATABASE IF NOT EXISTS baghouse
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE baghouse;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  mrp DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  category_id INT,
  brand_id INT,
  image_url VARCHAR(500),
  sku VARCHAR(100) UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_product_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  shipping_address TEXT NOT NULL,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'COD',
  status ENUM('PLACED','CONFIRMED','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PLACED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS service_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id INT,
  product_id INT,
  service_type VARCHAR(100) NOT NULL,
  issue_description TEXT NOT NULL,
  status ENUM('OPEN','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_service_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_service_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

INSERT IGNORE INTO categories (name, slug) VALUES
('Luggage / Travel Bags','luggage'),
('Backpacks','backpacks'),
('School Bags','school-bags'),
('Laptop Bags','laptop-bags'),
('Office Bags','office-bags'),
('Wallets','wallets'),
('Leather Belts','belts'),
('Umbrellas','umbrellas'),
('Bottles','bottles'),
('Key Chains','key-chains'),
('Comic / Character Idols','comic-idols'),
('Rucksack Bags','rucksack'),
('Service & Repair','service');

INSERT IGNORE INTO brands (name, slug) VALUES
('American Tourister','american-tourister'),
('VIP','vip'),
('Skybags','skybags'),
('Safari','safari'),
('Wildcraft','wildcraft'),
('Samsonite','samsonite');

INSERT IGNORE INTO products
(name, slug, description, price, mrp, stock, category_id, brand_id, image_url, sku)
SELECT
'American Tourister Backpack 28L',
'american-tourister-backpack-28l',
'Lightweight branded backpack with laptop compartment.',
2499, 3499, 25,
(SELECT id FROM categories WHERE slug='backpacks'),
(SELECT id FROM brands WHERE slug='american-tourister'),
'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80',
'AT-BP-28L'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='american-tourister-backpack-28l');

INSERT IGNORE INTO products
(name, slug, description, price, mrp, stock, category_id, brand_id, image_url, sku)
SELECT
'VIP Hardcase Trolley 68cm',
'vip-hardcase-trolley-68cm',
'Durable travel trolley with smooth wheels.',
3999, 5499, 18,
(SELECT id FROM categories WHERE slug='luggage'),
(SELECT id FROM brands WHERE slug='vip'),
'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&w=700&q=80',
'VIP-TROL-68'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='vip-hardcase-trolley-68cm');

INSERT IGNORE INTO products
(name, slug, description, price, mrp, stock, category_id, brand_id, image_url, sku)
SELECT
'Skybags School Backpack',
'skybags-school-backpack',
'Comfortable school backpack with multiple compartments.',
1499, 1999, 30,
(SELECT id FROM categories WHERE slug='school-bags'),
(SELECT id FROM brands WHERE slug='skybags'),
'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=700&q=80',
'SKY-SCH-01'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug='skybags-school-backpack');
