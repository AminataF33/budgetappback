import express from "express"
import db from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"
import { validateAccount, validateId } from "../middleware/validation.js"

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(authenticateToken)

// Récupérer tous les comptes de l'utilisateur
router.get("/", (req, res, next) => {
  try {
    const userId = req.user.id

    const accounts = db
      .prepare(`
      SELECT id, name, bank, type, balance, createdAt, updatedAt
      FROM accounts 
      WHERE userId = ?
      ORDER BY name ASC
    `)
      .all(userId)

    // Calculer le solde total
    const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)

    res.json({
      success: true,
      data: accounts,
      summary: {
        totalAccounts: accounts.length,
        totalBalance,
        accountTypes: {
          checking: accounts.filter((a) => a.type === "checking").length,
          savings: accounts.filter((a) => a.type === "savings").length,
          credit: accounts.filter((a) => a.type === "credit").length,
          mobile: accounts.filter((a) => a.type === "mobile").length,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

// Récupérer un compte spécifique
router.get("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const account = db
      .prepare(`
      SELECT id, name, bank, type, balance, createdAt, updatedAt
      FROM accounts 
      WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!account) {
      return res.status(404).json({
        error: "Compte non trouvé",
        code: "ACCOUNT_NOT_FOUND",
      })
    }

    // Récupérer les dernières transactions de ce compte
    const recentTransactions = db
      .prepare(`
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes,
        c.name as category, c.color as categoryColor
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      WHERE t.accountId = ? AND t.userId = ?
      ORDER BY t.date DESC, t.createdAt DESC
      LIMIT 10
    `)
      .all(id, userId)

    // Statistiques du compte
    const stats = db
      .prepare(`
      SELECT 
        COUNT(*) as transactionCount,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as totalExpenses
      FROM transactions 
      WHERE accountId = ? AND userId = ?
    `)
      .get(id, userId)

    res.json({
      success: true,
      data: {
        ...account,
        recentTransactions,
        stats,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Créer un nouveau compte
router.post("/", validateAccount, (req, res, next) => {
  try {
    const { name, bank, type, balance = 0 } = req.body
    const userId = req.user.id

    // Vérifier si un compte avec ce nom existe déjà pour cet utilisateur
    const existingAccount = db
      .prepare(`
      SELECT id FROM accounts WHERE name = ? AND userId = ?
    `)
      .get(name, userId)

    if (existingAccount) {
      return res.status(409).json({
        error: "Un compte avec ce nom existe déjà",
        code: "ACCOUNT_NAME_EXISTS",
      })
    }

    const insertAccount = db.prepare(`
      INSERT INTO accounts (userId, name, bank, type, balance)
      VALUES (?, ?, ?, ?, ?)
    `)

    const result = insertAccount.run(userId, name, bank, type, balance)

    const newAccount = db
      .prepare(`
      SELECT id, name, bank, type, balance, createdAt, updatedAt
      FROM accounts WHERE id = ?
    `)
      .get(result.lastInsertRowid)

    res.status(201).json({
      success: true,
      message: "Compte créé avec succès",
      data: newAccount,
    })
  } catch (error) {
    next(error)
  }
})

// Mettre à jour un compte
router.put("/:id", validateId, validateAccount, (req, res, next) => {
  try {
    const { id } = req.params
    const { name, bank, type, balance } = req.body
    const userId = req.user.id

    // Vérifier si le compte existe et appartient à l'utilisateur
    const existingAccount = db
      .prepare(`
      SELECT id, balance FROM accounts WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!existingAccount) {
      return res.status(404).json({
        error: "Compte non trouvé",
        code: "ACCOUNT_NOT_FOUND",
      })
    }

    // Vérifier si le nouveau nom existe déjà (sauf pour ce compte)
    const duplicateAccount = db
      .prepare(`
      SELECT id FROM accounts WHERE name = ? AND userId = ? AND id != ?
    `)
      .get(name, userId, id)

    if (duplicateAccount) {
      return res.status(409).json({
        error: "Un compte avec ce nom existe déjà",
        code: "ACCOUNT_NAME_EXISTS",
      })
    }

    const updateAccount = db.prepare(`
      UPDATE accounts 
      SET name = ?, bank = ?, type = ?, balance = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND userId = ?
    `)

    updateAccount.run(name, bank, type, balance, id, userId)

    const updatedAccount = db
      .prepare(`
      SELECT id, name, bank, type, balance, createdAt, updatedAt
      FROM accounts WHERE id = ?
    `)
      .get(id)

    res.json({
      success: true,
      message: "Compte mis à jour avec succès",
      data: updatedAccount,
    })
  } catch (error) {
    next(error)
  }
})

// Supprimer un compte
router.delete("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Vérifier si le compte existe et appartient à l'utilisateur
    const existingAccount = db
      .prepare(`
      SELECT id, name FROM accounts WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!existingAccount) {
      return res.status(404).json({
        error: "Compte non trouvé",
        code: "ACCOUNT_NOT_FOUND",
      })
    }

    // Vérifier si le compte a des transactions
    const transactionCount = db
      .prepare(`
      SELECT COUNT(*) as count FROM transactions WHERE accountId = ? AND userId = ?
    `)
      .get(id, userId)

    if (transactionCount.count > 0) {
      return res.status(409).json({
        error: "Impossible de supprimer un compte avec des transactions",
        code: "ACCOUNT_HAS_TRANSACTIONS",
        details: {
          transactionCount: transactionCount.count,
        },
      })
    }

    const deleteAccount = db.prepare("DELETE FROM accounts WHERE id = ? AND userId = ?")
    deleteAccount.run(id, userId)

    res.json({
      success: true,
      message: "Compte supprimé avec succès",
    })
  } catch (error) {
    next(error)
  }
})

// Récupérer l'historique des soldes d'un compte
router.get("/:id/balance-history", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { period = "month" } = req.query

    // Vérifier si le compte existe
    const account = db
      .prepare(`
      SELECT id, name, balance FROM accounts WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!account) {
      return res.status(404).json({
        error: "Compte non trouvé",
        code: "ACCOUNT_NOT_FOUND",
      })
    }

    // Calculer la période
    let dateFilter = ""
    switch (period) {
      case "week":
        dateFilter = "AND t.date >= date('now', '-7 days')"
        break
      case "month":
        dateFilter = "AND t.date >= date('now', '-1 month')"
        break
      case "quarter":
        dateFilter = "AND t.date >= date('now', '-3 months')"
        break
      case "year":
        dateFilter = "AND t.date >= date('now', '-1 year')"
        break
      default:
        dateFilter = "AND t.date >= date('now', '-1 month')"
    }

    // Récupérer les transactions pour calculer l'historique
    const transactions = db
      .prepare(`
      SELECT date, amount, description
      FROM transactions t
      WHERE t.accountId = ? AND t.userId = ? ${dateFilter}
      ORDER BY t.date ASC, t.createdAt ASC
    `)
      .all(id, userId)

    // Calculer l'historique des soldes
    const runningBalance = account.balance
    const history = []

    // Calculer le solde initial (avant la période)
    const initialTransactions = db
      .prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalAmount
      FROM transactions 
      WHERE accountId = ? AND userId = ? ${dateFilter.replace(">=", "<")}
    `)
      .get(id, userId)

    const initialBalance = account.balance - initialTransactions.totalAmount

    // Construire l'historique jour par jour
    const balanceByDate = new Map()
    let currentBalance = initialBalance

    transactions.forEach((transaction) => {
      currentBalance += transaction.amount
      balanceByDate.set(transaction.date, currentBalance)
    })

    // Convertir en tableau pour la réponse
    for (const [date, balance] of balanceByDate) {
      history.push({ date, balance })
    }

    res.json({
      success: true,
      data: {
        account: {
          id: account.id,
          name: account.name,
          currentBalance: account.balance,
        },
        history,
        period,
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
