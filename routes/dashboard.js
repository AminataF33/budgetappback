import express from "express"
import db from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(authenticateToken)

// Données complètes du dashboard
router.get("/", (req, res, next) => {
  try {
    const userId = req.user.id

    // Informations utilisateur
    const user = db
      .prepare(`
      SELECT id, firstName, lastName, email, phone, city, profession, createdAt
      FROM users WHERE id = ?
    `)
      .get(userId)

    // Comptes avec soldes
    const accounts = db
      .prepare(`
      SELECT id, name, bank, type, balance, createdAt, updatedAt
      FROM accounts 
      WHERE userId = ?
      ORDER BY name ASC
    `)
      .all(userId)

    // Transactions récentes (10 dernières)
    const recentTransactions = db
      .prepare(`
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes,
        c.name as category, c.color as categoryColor,
        a.name as account, a.type as accountType
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.userId = ?
      ORDER BY t.date DESC, t.createdAt DESC
      LIMIT 10
    `)
      .all(userId)

    // Budgets actifs avec dépenses
    const budgets = db
      .prepare(`
      SELECT 
        b.id, b.amount as budget, b.period, b.startDate, b.endDate,
        c.name as category, c.color
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      WHERE b.userId = ? 
        AND b.startDate <= date('now') 
        AND b.endDate >= date('now')
      ORDER BY c.name ASC
    `)
      .all(userId)

    const budgetsWithSpending = budgets.map((budget) => {
      const spending = db
        .prepare(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as spent
        FROM transactions t
        WHERE t.userId = ? 
          AND t.categoryId = (SELECT id FROM categories WHERE name = ?)
          AND t.amount < 0
          AND t.date >= ? 
          AND t.date <= ?
      `)
        .get(userId, budget.category, budget.startDate, budget.endDate)

      return {
        ...budget,
        spent: spending.spent,
      }
    })

    // Objectifs avec progression
    const goals = db
      .prepare(`
      SELECT id, title, description, targetAmount, currentAmount, deadline, category, createdAt
      FROM goals 
      WHERE userId = ?
      ORDER BY deadline ASC, createdAt DESC
    `)
      .all(userId)

    // Statistiques générales
    const stats = {
      totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
      monthlyIncome: 0,
      monthlyExpenses: 0,
      savings: 0,
    }

    // Revenus et dépenses du mois
    const monthlyStats = db
      .prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses
      FROM transactions 
      WHERE userId = ? AND date >= date('now', 'start of month')
    `)
      .get(userId)

    stats.monthlyIncome = monthlyStats.income
    stats.monthlyExpenses = monthlyStats.expenses

    // Épargne (comptes d'épargne)
    stats.savings = accounts
      .filter((account) => account.type === "savings")
      .reduce((sum, account) => sum + account.balance, 0)

    res.json({
      success: true,
      data: {
        user,
        accounts,
        recentTransactions,
        budgets: budgetsWithSpending,
        goals,
        stats,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Statistiques rapides
router.get("/stats", (req, res, next) => {
  try {
    const userId = req.user.id
    const { period = "month" } = req.query

    let dateFilter = ""
    switch (period) {
      case "week":
        dateFilter = "AND date >= date('now', '-7 days')"
        break
      case "month":
        dateFilter = "AND date >= date('now', 'start of month')"
        break
      case "year":
        dateFilter = "AND date >= date('now', 'start of year')"
        break
      default:
        dateFilter = "AND date >= date('now', 'start of month')"
    }

    const stats = db
      .prepare(`
      SELECT 
        COUNT(*) as transactionCount,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as totalExpenses
      FROM transactions 
      WHERE userId = ? ${dateFilter}
    `)
      .get(userId)

    const totalBalance = db
      .prepare(`
      SELECT COALESCE(SUM(balance), 0) as total
      FROM accounts 
      WHERE userId = ?
    `)
      .get(userId)

    const activeGoals = db
      .prepare(`
      SELECT COUNT(*) as total
      FROM goals 
      WHERE userId = ? AND currentAmount < targetAmount
    `)
      .get(userId)

    const completedGoals = db
      .prepare(`
      SELECT COUNT(*) as total
      FROM goals 
      WHERE userId = ? AND currentAmount >= targetAmount
    `)
      .get(userId)

    res.json({
      success: true,
      data: {
        ...stats,
        totalBalance: totalBalance.total,
        netAmount: stats.totalIncome - stats.totalExpenses,
        activeGoals: activeGoals.total,
        completedGoals: completedGoals.total,
        period,
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
