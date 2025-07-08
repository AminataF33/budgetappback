import Database from "better-sqlite3"
import bcrypt from "bcryptjs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const db = new Database(join(__dirname, "../database.db"))

console.log("🎭 Ajout des données de démonstration...")

// Créer un utilisateur de démonstration
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (firstName, lastName, email, phone, password, city, profession) 
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const hashedPassword = await bcrypt.hash("demo123", 12)

const demoUser = insertUser.run(
  "Amadou",
  "Diop",
  "demo@monbudget.sn",
  "+221771234567",
  hashedPassword,
  "Dakar",
  "Développeur",
)

if (demoUser.changes > 0) {
  console.log("✅ Utilisateur de démonstration créé !")
  const userId = demoUser.lastInsertRowid

  // Ajouter des comptes pour l'utilisateur démo
  const insertAccount = db.prepare(`
    INSERT INTO accounts (userId, name, bank, type, balance) VALUES (?, ?, ?, ?, ?)
  `)

  const demoAccounts = [
    [userId, "BOA Sénégal", "BOA", "checking", 1250500],
    [userId, "Livret SGBS", "SGBS", "savings", 4375000],
    [userId, "Carte CBAO", "CBAO", "credit", -160375],
    [userId, "Orange Money", "Orange", "mobile", 85000],
  ]

  const accountIds = []
  demoAccounts.forEach((account) => {
    const result = insertAccount.run(...account)
    accountIds.push(result.lastInsertRowid)
  })

  console.log("✅ Comptes de démonstration créés !")

  // Récupérer les IDs des catégories
  const categories = db.prepare("SELECT id, name, type FROM categories").all()
  const categoryMap = {}
  categories.forEach((cat) => {
    categoryMap[cat.name] = cat.id
  })

  // Ajouter des transactions de démonstration
  const insertTransaction = db.prepare(`
    INSERT INTO transactions (userId, accountId, categoryId, description, amount, date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const demoTransactions = [
    // Revenus
    [userId, accountIds[0], categoryMap["Salaire"], "Salaire mensuel", 850000, "2024-01-01", "Salaire de janvier"],
    [userId, accountIds[0], categoryMap["Freelance"], "Projet web", 250000, "2024-01-05", "Développement site web"],
    [userId, accountIds[1], categoryMap["Investissements"], "Dividendes", 45000, "2024-01-10", "Actions SONATEL"],

    // Dépenses
    [userId, accountIds[0], categoryMap["Logement"], "Loyer", -350000, "2024-01-01", "Loyer mensuel"],
    [userId, accountIds[0], categoryMap["Alimentation"], "Courses", -85000, "2024-01-02", "Supermarché"],
    [userId, accountIds[3], categoryMap["Transport"], "Essence", -25000, "2024-01-03", "Station Total"],
    [userId, accountIds[0], categoryMap["Santé"], "Pharmacie", -15000, "2024-01-04", "Médicaments"],
    [userId, accountIds[0], categoryMap["Loisirs"], "Restaurant", -35000, "2024-01-05", "Dîner en famille"],
    [userId, accountIds[0], categoryMap["Vêtements"], "Vêtements", -65000, "2024-01-06", "Habits pour le travail"],
    [userId, accountIds[1], categoryMap["Épargne"], "Épargne mensuelle", -200000, "2024-01-07", "Épargne automatique"],

    // Février
    [userId, accountIds[0], categoryMap["Salaire"], "Salaire mensuel", 850000, "2024-02-01", "Salaire de février"],
    [userId, accountIds[0], categoryMap["Logement"], "Loyer", -350000, "2024-02-01", "Loyer mensuel"],
    [userId, accountIds[0], categoryMap["Alimentation"], "Courses", -95000, "2024-02-03", "Marché + supermarché"],
    [userId, accountIds[3], categoryMap["Transport"], "Transport", -30000, "2024-02-05", "Taxi + bus"],
    [userId, accountIds[0], categoryMap["Loisirs"], "Cinéma", -12000, "2024-02-10", "Sortie cinéma"],

    // Mars (mois en cours)
    [userId, accountIds[0], categoryMap["Salaire"], "Salaire mensuel", 850000, "2024-03-01", "Salaire de mars"],
    [userId, accountIds[0], categoryMap["Logement"], "Loyer", -350000, "2024-03-01", "Loyer mensuel"],
    [userId, accountIds[0], categoryMap["Alimentation"], "Courses", -45000, "2024-03-05", "Courses de la semaine"],
    [userId, accountIds[3], categoryMap["Transport"], "Carburant", -28000, "2024-03-07", "Plein d'essence"],
  ]

  demoTransactions.forEach((transaction) => {
    insertTransaction.run(...transaction)
  })

  console.log("✅ Transactions de démonstration créées !")

  // Ajouter des budgets de démonstration
  const insertBudget = db.prepare(`
    INSERT INTO budgets (userId, categoryId, amount, period, startDate, endDate)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const demoBudgets = [
    [userId, categoryMap["Alimentation"], 120000, "monthly", "2024-03-01", "2024-03-31"],
    [userId, categoryMap["Transport"], 50000, "monthly", "2024-03-01", "2024-03-31"],
    [userId, categoryMap["Loisirs"], 80000, "monthly", "2024-03-01", "2024-03-31"],
    [userId, categoryMap["Vêtements"], 100000, "monthly", "2024-03-01", "2024-03-31"],
  ]

  demoBudgets.forEach((budget) => {
    insertBudget.run(...budget)
  })

  console.log("✅ Budgets de démonstration créés !")

  // Ajouter des objectifs de démonstration
  const insertGoal = db.prepare(`
    INSERT INTO goals (userId, title, description, targetAmount, currentAmount, deadline, category)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const demoGoals = [
    [userId, "Voyage à Paris", "Économiser pour un voyage en famille", 2500000, 850000, "2024-12-31", "Voyage"],
    [userId, "Nouvelle voiture", "Acheter une voiture d'occasion", 8000000, 2100000, "2025-06-30", "Transport"],
    [userId, "Fonds d'urgence", "Constituer un fonds d'urgence", 5000000, 4375000, "2024-08-31", "Épargne"],
    [userId, "Formation en ligne", "Cours de développement avancé", 500000, 150000, "2024-05-31", "Éducation"],
  ]

  demoGoals.forEach((goal) => {
    insertGoal.run(...goal)
  })

  console.log("✅ Objectifs de démonstration créés !")
} else {
  console.log("ℹ️ Utilisateur de démonstration existe déjà")
}

db.close()
console.log("🎉 Données de démonstration ajoutées avec succès !")
