// config/database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestionbudget',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Initialize database (create tables if they don't exist)
async function initializeDatabase() {
  try {
    // Create users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstName VARCHAR(255) NOT NULL,
        lastName VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        city VARCHAR(255),
        profession VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create budgets table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        period VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create transactions table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        budget_id INT,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        type ENUM('income', 'expense') NOT NULL,
        category VARCHAR(255),
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE SET NULL
      )
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

// Helper function to execute queries (similar to SQLite's db.prepare())
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
}

// Helper function to get a single row (similar to SQLite's get())
async function get(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results[0] || null;
  } catch (error) {
    console.error('Get query error:', error.message);
    throw error;
  }
}

// Helper function to get all rows (similar to SQLite's all())
async function all(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('All query error:', error.message);
    throw error;
  }
}

// Helper function to run insert/update/delete queries (similar to SQLite's run())
async function run(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return {
      insertId: results.insertId,
      affectedRows: results.affectedRows,
      changedRows: results.changedRows
    };
  } catch (error) {
    console.error('Run query error:', error.message);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connection...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connection...');
  await pool.end();
  process.exit(0);
});

// Export the pool and utility functions
export { pool, testConnection, initializeDatabase, query, get, all, run };
export default pool;