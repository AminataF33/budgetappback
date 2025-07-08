import express from "express"
import db from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(authenticateToken)

// Analyses générales
router.get("/", (req, res, next) => {
  try {
    const userId = req.user.id
    const { period = "month" } = req.query

    // Calculer les dates selon la période
    let dateFilter = ""
    let periodLabel = ""

    switch (period) {
      case "week":
        dateFilter = "AND t.date >= date('now', '-7 days')"
        periodLabel = "Cette semaine"
        break
      case "month":
        dateFilter = "AND t.date >= date('now', '-1 month')"
        periodLabel = "Ce mois"
        break
      case "quarter":
        dateFilter = "AND t.date >= date('now', '-3 months')"
        periodLabel = "Ce trimestre"
        break
      case "year":
        dateFilter = "AND t.date >= date('now', '-1 year')"
        periodLabel = "Cette année"
        break
      default:
        dateFilter = "AND t.date >= date('now', '-1 month')"
        periodLabel = "Ce mois"
    }

    // Statistiques générales
    const generalStats = db
      .prepare(`
      SELECT 
        COUNT(*) as totalTransactions,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as totalExpenses,
        COALESCE(AVG(CASE WHEN amount > 0 THEN amount END), 0) as avgIncome,
        COALESCE(AVG(CASE WHEN amount < 0 THEN ABS(amount) END), 0) as avgExpense
      FROM transactions t
      WHERE t.userId = ? ${dateFilter}
    `)
      .get(userId)

    // Dépenses par catégorie
    const expensesByCategory = db
      .prepare(`
      SELECT 
        c.name as category,
        c.color,
        COUNT(*) as transactionCount,
        SUM(ABS(t.amount)) as totalAmount,
        AVG(ABS(t.amount)) as avgAmount
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ? AND t.amount < 0 ${dateFilter}
      GROUP BY c.id, c.name, c.color
      ORDER BY totalAmount DESC
    `)
      .all(userId)

    // Revenus par catégorie
    const incomeByCategory = db
      .prepare(`
      SELECT 
        c.name as category,
        c.color,
        COUNT(*) as transactionCount,
        SUM(t.amount) as totalAmount,
        AVG(t.amount) as avgAmount
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ? AND t.amount > 0 ${dateFilter}
      GROUP BY c.id, c.name, c.color
      ORDER BY totalAmount DESC
    `)
      .all(userId)

    // Évolution mensuelle (6 derniers mois)
    const monthlyTrends = db
      .prepare(`
      SELECT 
        strftime('%Y-%m', t.date) as month,
        COUNT(*) as transactionCount,
        COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as expenses
      FROM transactions t
      WHERE t.userId = ? AND t.date >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', t.date)
      ORDER BY month ASC
    `)
      .all(userId)

    // Répartition par compte
    const accountBreakdown = db
      .prepare(`
      SELECT 
        a.name as account,
        a.type as accountType,
        a.bank,
        COUNT(*) as transactionCount,
        COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as totalExpenses
      FROM transactions t
      JOIN accounts a ON t.accountId = a.id
      WHERE t.userId = ? ${dateFilter}
      GROUP BY a.id, a.name, a.type, a.bank
      ORDER BY (totalIncome + totalExpenses) DESC
    `)
      .all(userId)

    // Calculs dérivés
    const netAmount = generalStats.totalIncome - generalStats.totalExpenses
    const savingsRate = generalStats.totalIncome > 0 ? (netAmount / generalStats.totalIncome) * 100 : 0

    res.json({
      success: true,
      data: {
        period: {
          value: period,
          label: periodLabel,
        },
        summary: {
          ...generalStats,
          netAmount,
          savingsRate,
        },
        breakdown: {
          expensesByCategory,
          incomeByCategory,
          accountBreakdown,
        },
        trends: {
          monthly: monthlyTrends,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

// Analyse des budgets
router.get("/budgets", (req, res, next) => {
  try {
    const userId = req.user.id

    // Budgets actifs avec leurs performances
    const activeBudgets = db
      .prepare(`
      SELECT 
        b.id, b.amount as budgetAmount, b.period, b.startDate, b.endDate,
        c.name as category, c.color
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      WHERE b.userId = ? 
        AND b.startDate <= date('now') 
        AND b.endDate >= date('now')
      ORDER BY c.name ASC
    `)
      .all(userId)

    const budgetPerformance = activeBudgets.map((budget) => {
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

      const percentage = budget.budgetAmount > 0 ? (spending.spent / budget.budgetAmount) * 100 : 0
      const remaining = budget.budgetAmount - spending.spent
      const isOverBudget = spending.spent > budget.budgetAmount

      return {
        ...budget,
        spent: spending.spent,
        remaining: Math.max(0, remaining),
        percentage: Math.min(100, percentage),
        isOverBudget,
        status: isOverBudget ? "over" : percentage > 80 ? "warning" : "good",
      }
    })

    // Statistiques globales des budgets
    const totalBudgeted = budgetPerformance.reduce((sum, b) => sum + b.budgetAmount, 0)
    const totalSpent = budgetPerformance.reduce((sum, b) => sum + b.spent, 0)
    const overBudgetCount = budgetPerformance.filter((b) => b.isOverBudget).length

    res.json({
      success: true,
      data: {
        budgets: budgetPerformance,
        summary: {
          totalBudgets: budgetPerformance.length,
          totalBudgeted,
          totalSpent,
          totalRemaining: Math.max(0, totalBudgeted - totalSpent),
          overBudgetCount,
          averageUsage: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

// Analyse des objectifs
router.get("/goals", (req, res, next) => {
  try {
    const userId = req.user.id

    const goals = db
      .prepare(`
      SELECT id, title, targetAmount, currentAmount, deadline, category, createdAt
      FROM goals 
      WHERE userId = ?
      ORDER BY deadline ASC
    `)
      .all(userId)

    const goalsWithProgress = goals.map((goal) => {
      const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
      const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
      const isCompleted = goal.currentAmount >= goal.targetAmount

      let status = "active"
      if (isCompleted) {
        status = "completed"
      } else if (goal.deadline && new Date(goal.deadline) < new Date()) {
        status = "expired"
      }

      // Calculer le temps restant
      let timeRemaining = null
      if (goal.deadline && !isCompleted) {
        const now = new Date()
        const deadline = new Date(goal.deadline)
        const diffTime = deadline - now
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        timeRemaining = diffDays
      }

      return {
        ...goal,
        progress: Math.min(100, progress),
        remaining,
        isCompleted,
        status,
        timeRemaining,
      }
    })

    // Statistiques globales
    const totalGoals = goalsWithProgress.length
    const completedGoals = goalsWithProgress.filter((g) => g.isCompleted).length
    const totalTargetAmount = goalsWithProgress.reduce((sum, g) => sum + g.targetAmount, 0)
    const totalCurrentAmount = goalsWithProgress.reduce((sum, g) => sum + g.currentAmount, 0)

    res.json({
      success: true,
      data: {
        goals: goalsWithProgress,
        summary: {
          totalGoals,
          completedGoals,
          activeGoals: totalGoals - completedGoals,
          completionRate: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0,
          totalTargetAmount,
          totalCurrentAmount,
          totalRemaining: Math.max(0, totalTargetAmount - totalCurrentAmount),
          overallProgress: totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

// Prédictions et insights
router.get("/insights", (req, res, next) => {
  try {
    const userId = req.user.id

    // Analyse des tendances de dépenses
    const spendingTrends = db
      .prepare(`
      SELECT 
        strftime('%Y-%m', t.date) as month,
        SUM(ABS(t.amount)) as totalExpenses
      FROM transactions t
      WHERE t.userId = ? AND t.amount < 0 AND t.date >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', t.date)
      ORDER BY month ASC
    `)
      .all(userId)

    // Catégories les plus dépensières
    const topExpenseCategories = db
      .prepare(`
      SELECT 
        c.name as category,
        SUM(ABS(t.amount)) as totalAmount,
        COUNT(*) as transactionCount,
        AVG(ABS(t.amount)) as avgAmount
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ? AND t.amount < 0 AND t.date >= date('now', '-3 months')
      GROUP BY c.id, c.name
      ORDER BY totalAmount DESC
      LIMIT 5
    `)
      .all(userId)

    // Jours de la semaine les plus dépensiers
    const spendingByDayOfWeek = db
      .prepare(`
      SELECT 
        CASE strftime('%w', t.date)
          WHEN '0' THEN 'Dimanche'
          WHEN '1' THEN 'Lundi'
          WHEN '2' THEN 'Mardi'
          WHEN '3' THEN 'Mercredi'
          WHEN '4' THEN 'Jeudi'
          WHEN '5' THEN 'Vendredi'
          WHEN '6' THEN 'Samedi'
        END as dayOfWeek,
        strftime('%w', t.date) as dayNumber,
        SUM(ABS(t.amount)) as totalAmount,
        COUNT(*) as transactionCount
      FROM transactions t
      WHERE t.userId = ? AND t.amount < 0 AND t.date >= date('now', '-3 months')
      GROUP BY strftime('%w', t.date)
      ORDER BY dayNumber ASC
    `)
      .all(userId)

    // Calcul de prédictions simples
    let monthlyPrediction = null
    if (spendingTrends.length >= 3) {
      const recentMonths = spendingTrends.slice(-3)
      const avgSpending = recentMonths.reduce((sum, month) => sum + month.totalExpenses, 0) / recentMonths.length
      monthlyPrediction = avgSpending
    }

    // Insights personnalisés
    const insights = []

    // Insight sur les budgets
    const overBudgetCount = db
      .prepare(`
      SELECT COUNT(*) as count
      FROM budgets b
      WHERE b.userId = ? 
        AND b.startDate <= date('now') 
        AND b.endDate >= date('now')
        AND (
          SELECT COALESCE(SUM(ABS(amount)), 0)
          FROM transactions t
          WHERE t.userId = b.userId 
            AND t.categoryId = b.categoryId
            AND t.amount < 0
            AND t.date >= b.startDate 
            AND t.date <= b.endDate
        ) > b.amount
    `)
      .get(userId)

    if (overBudgetCount.count > 0) {
      insights.push({
        type: "warning",
        title: "Budgets dépassés",
        message: `Vous avez ${overBudgetCount.count} budget(s) dépassé(s) ce mois.`,
        action: "Consultez vos budgets pour ajuster vos dépenses.",
      })
    }

    // Insight sur les objectifs
    const nearDeadlineGoals = db
      .prepare(`
      SELECT COUNT(*) as count
      FROM goals
      WHERE userId = ? 
        AND deadline IS NOT NULL
        AND deadline >= date('now')
        AND deadline <= date('now', '+30 days')
        AND currentAmount < targetAmount
    `)
      .get(userId)

    if (nearDeadlineGoals.count > 0) {
      insights.push({
        type: "info",
        title: "Objectifs bientôt dus",
        message: `${nearDeadlineGoals.count} objectif(s) arrivent à échéance dans les 30 prochains jours.`,
        action: "Augmentez vos contributions pour les atteindre à temps.",
      })
    }

    res.json({
      success: true,
      data: {
        trends: {
          monthly: spendingTrends,
          byCategory: topExpenseCategories,
          byDayOfWeek: spendingByDayOfWeek,
        },
        predictions: {
          nextMonthExpenses: monthlyPrediction,
        },
        insights,
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
