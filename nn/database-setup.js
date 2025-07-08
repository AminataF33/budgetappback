import Database from "better-sqlite3"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Créer la base de données
const db = new Database(join(__dirname, "../database.db"))

// Activer les clés étrangères
db.pragma("foreign_keys = ON")

console.log("🗄️ Création de la base de données...")

// Table des utilisateurs
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    password TEXT NOT NULL,
    city TEXT NOT NULL,
    profession TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Table des comptes bancaires
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    name TEXT NOT NULL,
    bank TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'mobile')),
    balance REAL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )
`)

// Table des catégories
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    color TEXT DEFAULT '#3B82F6',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Table des transactions
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    accountId INTEGER NOT NULL,
    categoryId INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id)
  )
`)

// Table des budgets
db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    categoryId INTEGER NOT NULL,
    amount REAL NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('monthly', 'weekly', 'yearly')),
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id)
  )
`)

// Table des objectifs d'épargne
db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    targetAmount REAL NOT NULL,
    currentAmount REAL DEFAULT 0,
    deadline DATE,
    category TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )
`)

console.log("✅ Tables créées avec succès !")

// Insérer les catégories par défaut
const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO categories (name, type, color) VALUES (?, ?, ?)
`)

const defaultCategories = [
  // Catégories de revenus
  ["Salaire", "income", "#10B981"],
  ["Freelance", "income", "#059669"],
  ["Investissements", "income", "#047857"],
  ["Autres revenus", "income", "#065F46"],

  // Catégories de dépenses
  ["Alimentation", "expense", "#EF4444"],
  ["Transport", "expense", "#F97316"],
  ["Logement", "expense", "#8B5CF6"],
  ["Santé", "expense", "#EC4899"],
  ["Loisirs", "expense", "#06B6D4"],
  ["Éducation", "expense", "#84CC16"],
  ["Vêtements", "expense", "#F59E0B"],
  ["Transfert", "expense", "#6366F1"],
  ["Épargne", "expense", "#10B981"],
  ["Autres", "expense", "#6B7280"],
]

defaultCategories.forEach(([name, type, color]) => {
  insertCategory.run(name, type, color)
})

console.log("✅ Catégories par défaut ajoutées !")

db.close()
console.log("🎉 Base de données initialisée avec succès !")
