const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
require("dotenv").config()

// Import des modèles
const User = require("../models/User")
const Account = require("../models/Account")
const Category = require("../models/Category")
const Transaction = require("../models/Transaction")
const Budget = require("../models/Budget")
const Goal = require("../models/Goal")

// Connexion à MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log("✅ Connecté à MongoDB pour le seeding")
  } catch (error) {
    console.error("❌ Erreur de connexion MongoDB:", error)
    process.exit(1)
  }
}

// Fonction pour générer des données aléatoires
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)]
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const getRandomAmount = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// Données de base
const senegalBanks = ["CBAO", "SGBS", "BOA", "Ecobank", "UBA", "BHS", "BICIS", "Banque Atlantique"]
const senegalMerchants = [
  "Auchan Dakar",
  "Marché Sandaga",
  "Orange Money",
  "Wave",
  "Pharmacie du Plateau",
  "Station Total",
  "Boulangerie Moderne",
  "Restaurant Teranga",
  "Taxi Dakar Dem Dikk",
  "Marché Tilène",
  "Supermarché Casino",
  "Clinique Pasteur",
  "École Française",
  "Garage Auto Plus",
  "Boutique Mode",
  "Marché Kermel",
  "Pharmacie Nationale",
]

// Utilisateurs à créer
const usersData = [
  {
    firstName: "Aminata",
    lastName: "Fall",
    email: "aminata.fall@email.com",
    phone: "+221701234567",
    password: "password123",
    city: "Dakar",
    profession: "Enseignant(e)",
  },
  {
    firstName: "Moussa",
    lastName: "Diop",
    email: "moussa.diop@email.com",
    phone: "+221702345678",
    password: "password123",
    city: "Thiès",
    profession: "Commerçant(e)",
  },
  {
    firstName: "Fatou",
    lastName: "Seck",
    email: "fatou.seck@email.com",
    phone: "+221703456789",
    password: "password123",
    city: "Saint-Louis",
    profession: "Infirmier(ère)",
  },
  {
    firstName: "Ibrahima",
    lastName: "Ndiaye",
    email: "ibrahima.ndiaye@email.com",
    phone: "+221704567890",
    password: "password123",
    city: "Kaolack",
    profession: "Entrepreneur",
  },
  {
    firstName: "Aïssatou",
    lastName: "Ba",
    email: "aissatou.ba@email.com",
    phone: "+221705678901",
    password: "password123",
    city: "Ziguinchor",
    profession: "Fonctionnaire",
  },
  {
    firstName: "Ousmane",
    lastName: "Sarr",
    email: "ousmane.sarr@email.com",
    phone: "+221706789012",
    password: "password123",
    city: "Diourbel",
    profession: "Ingénieur",
  },
  {
    firstName: "Marième",
    lastName: "Cissé",
    email: "marieme.cisse@email.com",
    phone: "+221707890123",
    password: "password123",
    city: "Tambacounda",
    profession: "Médecin",
  },
  {
    firstName: "Cheikh",
    lastName: "Gueye",
    email: "cheikh.gueye@email.com",
    phone: "+221708901234",
    password: "password123",
    city: "Kolda",
    profession: "Chauffeur",
  },
]

// Fonction pour créer les catégories par défaut
const createDefaultCategories = async () => {
  console.log("📂 Création des catégories par défaut...")

  const categories = [
    // Catégories de revenus
    { name: "Salaire", type: "income", color: "#10B981", icon: "Banknote", isDefault: true },
    { name: "Freelance", type: "income", color: "#059669", icon: "Laptop", isDefault: true },
    { name: "Investissements", type: "income", color: "#047857", icon: "TrendingUp", isDefault: true },
    { name: "Autres revenus", type: "income", color: "#065F46", icon: "Plus", isDefault: true },

    // Catégories de dépenses
    { name: "Alimentation", type: "expense", color: "#EF4444", icon: "UtensilsCrossed", isDefault: true },
    { name: "Transport", type: "expense", color: "#F97316", icon: "Car", isDefault: true },
    { name: "Logement", type: "expense", color: "#EAB308", icon: "Home", isDefault: true },
    { name: "Santé", type: "expense", color: "#EC4899", icon: "Heart", isDefault: true },
    { name: "Éducation", type: "expense", color: "#8B5CF6", icon: "GraduationCap", isDefault: true },
    { name: "Loisirs", type: "expense", color: "#06B6D4", icon: "Gamepad2", isDefault: true },
    { name: "Shopping", type: "expense", color: "#84CC16", icon: "ShoppingBag", isDefault: true },
    { name: "Factures", type: "expense", color: "#6366F1", icon: "Receipt", isDefault: true },
    { name: "Autres dépenses", type: "expense", color: "#64748B", icon: "MoreHorizontal", isDefault: true },
  ]

  for (const categoryData of categories) {
    await Category.findOneAndUpdate(
      { name: categoryData.name, type: categoryData.type, isDefault: true },
      categoryData,
      { upsert: true, new: true },
    )
  }

  console.log("✅ Catégories par défaut créées")
  return await Category.find({ isDefault: true })
}

// Fonction pour créer les utilisateurs
const createUsers = async () => {
  console.log("👥 Création des utilisateurs...")

  const createdUsers = []

  for (const userData of usersData) {
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ email: userData.email })
      if (existingUser) {
        console.log(`⚠️  Utilisateur ${userData.email} existe déjà`)
        createdUsers.push(existingUser)
        continue
      }

      const user = new User(userData)
      await user.save()
      createdUsers.push(user)
      console.log(`✅ Utilisateur créé: ${user.fullName}`)
    } catch (error) {
      console.error(`❌ Erreur création utilisateur ${userData.email}:`, error.message)
    }
  }

  return createdUsers
}

// Fonction pour créer les comptes
const createAccounts = async (users) => {
  console.log("🏦 Création des comptes bancaires...")

  const allAccounts = []

  for (const user of users) {
    try {
      // Vérifier si l'utilisateur a déjà des comptes
      const existingAccounts = await Account.find({ userId: user._id })
      if (existingAccounts.length > 0) {
        console.log(`⚠️  Comptes existent déjà pour ${user.fullName}`)
        allAccounts.push(...existingAccounts)
        continue
      }

      const accountsToCreate = [
        {
          userId: user._id,
          name: "Compte Principal",
          bank: getRandomElement(senegalBanks),
          type: "checking",
          balance: getRandomAmount(50000, 500000),
          color: "#3B82F6",
          icon: "CreditCard",
        },
      ]

      // 70% de chance d'avoir un compte épargne
      if (Math.random() > 0.3) {
        accountsToCreate.push({
          userId: user._id,
          name: "Épargne",
          bank: getRandomElement(senegalBanks),
          type: "savings",
          balance: getRandomAmount(100000, 1000000),
          color: "#10B981",
          icon: "PiggyBank",
        })
      }

      const userAccounts = await Account.insertMany(accountsToCreate)
      allAccounts.push(...userAccounts)
      console.log(`✅ ${userAccounts.length} compte(s) créé(s) pour ${user.fullName}`)
    } catch (error) {
      console.error(`❌ Erreur création comptes pour ${user.fullName}:`, error.message)
    }
  }

  return allAccounts
}

// Fonction pour créer les transactions
const createTransactions = async (users, accounts, categories) => {
  console.log("💳 Création des transactions...")

  const incomeCategories = categories.filter((c) => c.type === "income")
  const expenseCategories = categories.filter((c) => c.type === "expense")

  for (const user of users) {
    try {
      const userAccounts = accounts.filter((a) => a.userId.equals(user._id))
      if (userAccounts.length === 0) continue

      // Créer 20-40 transactions sur les 90 derniers jours
      const transactionCount = getRandomNumber(20, 40)
      const transactions = []

      for (let i = 0; i < transactionCount; i++) {
        const isIncome = Math.random() > 0.7 // 30% de revenus, 70% de dépenses
        const selectedCategories = isIncome ? incomeCategories : expenseCategories
        const category = getRandomElement(selectedCategories)
        const account = getRandomElement(userAccounts)

        // Date aléatoire dans les 90 derniers jours
        const daysAgo = getRandomNumber(0, 90)
        const transactionDate = new Date()
        transactionDate.setDate(transactionDate.getDate() - daysAgo)

        let amount
        if (isIncome) {
          // Revenus: 50,000 à 500,000 CFA
          amount = getRandomAmount(50000, 500000)
        } else {
          // Dépenses: 1,000 à 100,000 CFA
          amount = getRandomAmount(1000, 100000)
        }

        const transaction = {
          userId: user._id,
          accountId: account._id,
          categoryId: category._id,
          type: category.type,
          amount,
          description: isIncome
            ? `${category.name} - ${transactionDate.toLocaleDateString("fr-FR", { month: "long" })}`
            : `Achat ${category.name.toLowerCase()}`,
          date: transactionDate,
          merchant: isIncome ? null : getRandomElement(senegalMerchants),
          paymentMethod: getRandomElement(["cash", "card", "mobile_money", "transfer"]),
          currency: "CFA",
          status: "completed",
        }

        transactions.push(transaction)
      }

      await Transaction.insertMany(transactions)
      console.log(`✅ ${transactions.length} transactions créées pour ${user.fullName}`)
    } catch (error) {
      console.error(`❌ Erreur création transactions pour ${user.fullName}:`, error.message)
    }
  }
}

// Fonction pour créer les budgets
const createBudgets = async (users, categories) => {
  console.log("📊 Création des budgets...")

  const expenseCategories = categories.filter((c) => c.type === "expense")

  for (const user of users) {
    try {
      // Créer 3-5 budgets par utilisateur
      const budgetCount = getRandomNumber(3, 5)
      const selectedCategories = expenseCategories.sort(() => 0.5 - Math.random()).slice(0, budgetCount)

      const budgets = []

      for (const category of selectedCategories) {
        const startDate = new Date()
        startDate.setDate(1) // Premier jour du mois

        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + 1)
        endDate.setDate(0) // Dernier jour du mois

        const budget = {
          userId: user._id,
          categoryId: category._id,
          name: `Budget ${category.name}`,
          amount: getRandomAmount(50000, 300000),
          spent: getRandomAmount(10000, 150000),
          period: "monthly",
          startDate,
          endDate,
          alertThreshold: getRandomNumber(70, 90),
          color: category.color,
          isActive: true,
        }

        budgets.push(budget)
      }

      await Budget.insertMany(budgets)
      console.log(`✅ ${budgets.length} budgets créés pour ${user.fullName}`)
    } catch (error) {
      console.error(`❌ Erreur création budgets pour ${user.fullName}:`, error.message)
    }
  }
}

// Fonction pour créer les objectifs
const createGoals = async (users) => {
  console.log("🎯 Création des objectifs...")

  const goalCategories = [
    "emergency_fund",
    "vacation",
    "house",
    "car",
    "education",
    "retirement",
    "wedding",
    "business",
    "electronics",
    "health",
  ]

  const goalNames = {
    emergency_fund: "Fonds d'urgence",
    vacation: "Vacances à Dubai",
    house: "Achat maison",
    car: "Nouvelle voiture",
    education: "Formation professionnelle",
    retirement: "Retraite anticipée",
    wedding: "Mariage",
    business: "Création entreprise",
    electronics: "Nouveau laptop",
    health: "Assurance santé",
  }

  for (const user of users) {
    try {
      // Créer 1-3 objectifs par utilisateur
      const goalCount = getRandomNumber(1, 3)
      const selectedCategories = goalCategories.sort(() => 0.5 - Math.random()).slice(0, goalCount)

      const goals = []

      for (const category of selectedCategories) {
        const targetDate = new Date()
        targetDate.setMonth(targetDate.getMonth() + getRandomNumber(6, 24))

        const targetAmount = getRandomAmount(500000, 5000000)
        const currentAmount = getRandomAmount(50000, targetAmount * 0.6)

        const goal = {
          userId: user._id,
          name: goalNames[category],
          description: `Objectif d'épargne pour ${goalNames[category].toLowerCase()}`,
          targetAmount,
          currentAmount,
          targetDate,
          category,
          priority: getRandomElement(["low", "medium", "high"]),
          status: "active",
          color: getRandomElement(["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]),
          icon: "Target",
          contributions: [
            {
              amount: currentAmount,
              date: new Date(Date.now() - getRandomNumber(1, 30) * 24 * 60 * 60 * 1000),
              note: "Contribution initiale",
              source: "manual",
            },
          ],
        }

        // Ajouter des jalons
        const milestoneCount = getRandomNumber(2, 4)
        const milestones = []

        for (let i = 1; i <= milestoneCount; i++) {
          const milestoneAmount = (targetAmount / milestoneCount) * i
          milestones.push({
            name: `Étape ${i}`,
            amount: milestoneAmount,
            achieved: currentAmount >= milestoneAmount,
            achievedDate: currentAmount >= milestoneAmount ? new Date() : null,
            reward: `Récompense étape ${i}`,
          })
        }

        goal.milestones = milestones
        goals.push(goal)
      }

      await Goal.insertMany(goals)
      console.log(`✅ ${goals.length} objectif(s) créé(s) pour ${user.fullName}`)
    } catch (error) {
      console.error(`❌ Erreur création objectifs pour ${user.fullName}:`, error.message)
    }
  }
}

// Fonction principale de seeding
const seedDatabase = async () => {
  try {
    console.log("🌱 Début du seeding de la base de données...")

    await connectDB()

    // Nettoyer la base de données (optionnel)
    const shouldClean = process.argv.includes("--clean")
    if (shouldClean) {
      console.log("🧹 Nettoyage de la base de données...")
      await User.deleteMany({})
      await Account.deleteMany({})
      await Category.deleteMany({})
      await Transaction.deleteMany({})
      await Budget.deleteMany({})
      await Goal.deleteMany({})
      console.log("✅ Base de données nettoyée")
    }

    // Créer les données
    const categories = await createDefaultCategories()
    const users = await createUsers()
    const accounts = await createAccounts(users)
    await createTransactions(users, accounts, categories)
    await createBudgets(users, categories)
    await createGoals(users)

    console.log("\n🎉 Seeding terminé avec succès!")
    console.log("\n📊 Résumé:")
    console.log(`👥 Utilisateurs: ${users.length}`)
    console.log(`🏦 Comptes: ${accounts.length}`)
    console.log(`📂 Catégories: ${categories.length}`)

    const transactionCount = await Transaction.countDocuments()
    const budgetCount = await Budget.countDocuments()
    const goalCount = await Goal.countDocuments()

    console.log(`💳 Transactions: ${transactionCount}`)
    console.log(`📊 Budgets: ${budgetCount}`)
    console.log(`🎯 Objectifs: ${goalCount}`)

    console.log("\n🔑 Comptes de test:")
    for (const user of users) {
      console.log(`📧 ${user.email} | 🔒 password123`)
    }
  } catch (error) {
    console.error("❌ Erreur lors du seeding:", error)
  } finally {
    await mongoose.connection.close()
    console.log("✅ Connexion MongoDB fermée")
    process.exit(0)
  }
}

// Exécuter le seeding
if (require.main === module) {
  seedDatabase()
}

module.exports = { seedDatabase }
