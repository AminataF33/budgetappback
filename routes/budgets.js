import express from "express"
import db from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"
import { validateBudget, validateId } from "../middleware/validation.js"

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(authenticateToken)

// Récupérer tous les budgets de l'utilisateur
router.get("/", (req, res, next) => {
  try {
    const userId = req.user.id
    const { period, active } = req.query

    let query = `
      SELECT 
        b.id, b.amount, b.period, b.startDate, b.endDate, b.createdAt, b.updatedAt,
        c.id as categoryId, c.name as category, c.color as categoryColor, c.type as categoryType
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      WHERE b.userId = ?
    `
    const params = [userId]

    if (period) {
      query += " AND b.period = ?"
      params.push(period)
    }

    if (active === "true") {
      query += " AND b.startDate <= date('now') AND b.endDate >= date('now')"
    }

    query += " ORDER BY b.startDate DESC, c.name ASC"

    const budgets = db.prepare(query).all(...params)

    // Calculer les dépenses pour chaque budget
    const budgetsWithSpending = budgets.map((budget) => {
      const spending = db
        .prepare(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as spent
        FROM transactions t
        WHERE t.userId = ? 
          AND t.categoryId = ?
          AND t.amount < 0
          AND t.date >= ? 
          AND t.date <= ?
      `)
        .get(userId, budget.categoryId, budget.startDate, budget.endDate)

      const percentage = budget.amount > 0 ? (spending.spent / budget.amount) * 100 : 0
      const remaining = budget.amount - spending.spent
      const isOverBudget = spending.spent > budget.amount

      return {
        ...budget,
        spent: spending.spent,
        remaining: Math.max(0, remaining),
        percentage: Math.min(100, percentage),
        isOverBudget,
        status: isOverBudget ? "over" : percentage > 80 ? "warning" : "good",
      }
    })

    res.json({
      success: true,
      data: budgetsWithSpending,
    })
  } catch (error) {
    next(error)
  }
})

// Récupérer un budget spécifique
router.get("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const budget = db
      .prepare(`
      SELECT 
        b.id, b.amount, b.period, b.startDate, b.endDate, b.createdAt, b.updatedAt,
        c.id as categoryId, c.name as category, c.color as categoryColor, c.type as categoryType
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      WHERE b.id = ? AND b.userId = ?
    `)
      .get(id, userId)

    if (!budget) {
      return res.status(404).json({
        error: "Budget non trouvé",
        code: "BUDGET_NOT_FOUND",
      })
    }

    // Calculer les dépenses
    const spending = db
      .prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as spent
      FROM transactions t
      WHERE t.userId = ? 
        AND t.categoryId = ?
        AND t.amount < 0
        AND t.date >= ? 
        AND t.date <= ?
    `)
      .get(userId, budget.categoryId, budget.startDate, budget.endDate)

    // Récupérer les transactions de ce budget
    const transactions = db
      .prepare(`
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes,
        a.name as account, a.type as accountType
      FROM transactions t
      JOIN accounts a ON t.accountId = a.id
      WHERE t.userId = ? 
        AND t.categoryId = ?
        AND t.amount < 0
        AND t.date >= ? 
        AND t.date <= ?
      ORDER BY t.date DESC, t.createdAt DESC
    `)
      .all(userId, budget.categoryId, budget.startDate, budget.endDate)

    const percentage = budget.amount > 0 ? (spending.spent / budget.amount) * 100 : 0
    const remaining = budget.amount - spending.spent
    const isOverBudget = spending.spent > budget.amount

    res.json({
      success: true,
      data: {
        ...budget,
        spent: spending.spent,
        remaining: Math.max(0, remaining),
        percentage: Math.min(100, percentage),
        isOverBudget,
        status: isOverBudget ? "over" : percentage > 80 ? "warning" : "good",
        transactions,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Créer un nouveau budget
router.post("/", validateBudget, (req, res, next) => {
  try {
    const { categoryId, amount, period, startDate, endDate } = req.body
    const userId = req.user.id

    // Vérifier que la catégorie existe et est de type expense
    const category = db
      .prepare(`
      SELECT id, name, type FROM categories WHERE id = ?
    `)
      .get(categoryId)

    if (!category) {
      return res.status(404).json({
        error: "Catégorie non trouvée",
        code: "CATEGORY_NOT_FOUND",
      })
    }

    if (category.type !== "expense") {
      return res.status(400).json({
        error: "Un budget ne peut être créé que pour une catégorie de dépense",
        code: "INVALID_CATEGORY_TYPE",
      })
    }

    // Vérifier qu'il n'y a pas de budget qui se chevauche pour cette catégorie
    const overlappingBudget = db
      .prepare(`
      SELECT id FROM budgets 
      WHERE userId = ? AND categoryId = ?
        AND ((startDate <= ? AND endDate >= ?) 
          OR (startDate <= ? AND endDate >= ?)
          OR (startDate >= ? AND endDate <= ?))
    `)
      .get(userId, categoryId, startDate, startDate, endDate, endDate, startDate, endDate)

    if (overlappingBudget) {
      return res.status(409).json({
        error: "Un budget existe déjà pour cette catégorie sur cette période",
        code: "OVERLAPPING_BUDGET",
      })
    }

    const insertBudget = db.prepare(`
      INSERT INTO budgets (userId, categoryId, amount, period, startDate, endDate)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const result = insertBudget.run(userId, categoryId, amount, period, startDate, endDate)

    const newBudget = db
      .prepare(`
      SELECT 
        b.id, b.amount, b.period, b.startDate, b.endDate, b.createdAt,
        c.id as categoryId, c.name as category, c.color as categoryColor
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      WHERE b.id = ?
    `)
      .get(result.lastInsertRowid)

    res.status(201).json({
      success: true,
      message: "Budget créé avec succès",
      data: {
        ...newBudget,
        spent: 0,
        remaining: newBudget.amount,
        percentage: 0,
        isOverBudget: false,
        status: "good",
      },
    })
  } catch (error) {
    next(error)
  }
})

// Mettre à jour un budget
router.put("/:id", validateId, validateBudget, (req, res, next) => {
  try {
    const { id } = req.params
    const { categoryId, amount, period, startDate, endDate } = req.body
    const userId = req.user.id

    // Vérifier que le budget existe
    const existingBudget = db
      .prepare(`
      SELECT id, categoryId FROM budgets WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!existingBudget) {
      return res.status(404).json({
        error: "Budget non trouvé",
        code: "BUDGET_NOT_FOUND",
      })
    }

    // Vérifier que la catégorie existe et est de type expense
    const category = db
      .prepare(`
      SELECT id, name, type FROM categories WHERE id = ?
    `)
      .get(categoryId)

    if (!category) {
      return res.status(404).json({
        error: "Catégorie non trouvée",
        code: "CATEGORY_NOT_FOUND",
      })
    }

    if (category.type !== "expense") {
      return res.status(400).json({
        error: "Un budget ne peut être créé que pour une catégorie de dépense",
        code: "INVALID_CATEGORY_TYPE",
      })
    }

    // Vérifier qu'il n'y a pas de budget qui se chevauche (sauf celui-ci)
    const overlappingBudget = db
      .prepare(`
      SELECT id FROM budgets 
      WHERE userId = ? AND categoryId = ? AND id != ?
        AND ((startDate <= ? AND endDate >= ?) 
          OR (startDate <= ? AND endDate >= ?)
          OR (startDate >= ? AND endDate <= ?))
    `)
      .get(userId, categoryId, id, startDate, startDate, endDate, endDate, startDate, endDate)

    if (overlappingBudget) {
      return res.status(409).json({
        error: "Un budget existe déjà pour cette catégorie sur cette période",
        code: "OVERLAPPING_BUDGET",
      })
    }

    const updateBudget = db.prepare(`
      UPDATE budgets 
      SET categoryId = ?, amount = ?, period = ?, startDate = ?, endDate = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND userId = ?
    `)

    updateBudget.run(categoryId, amount, period, startDate, endDate, id, userId)

    const updatedBudget = db
      .prepare(`
      SELECT 
        b.id, b.amount, b.period, b.startDate, b.endDate, b.createdAt, b.updatedAt,
        c.id as categoryId, c.name as category, c.color as categoryColor
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      WHERE b.id = ?
    `)
      .get(id)

    // Calculer les dépenses
    const spending = db
      .prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as spent
      FROM transactions t
      WHERE t.userId = ? 
        AND t.categoryId = ?
        AND t.amount < 0
        AND t.date >= ? 
        AND t.date <= ?
    `)
      .get(userId, categoryId, startDate, endDate)

    const percentage = amount > 0 ? (spending.spent / amount) * 100 : 0
    const remaining = amount - spending.spent
    const isOverBudget = spending.spent > amount

    res.json({
      success: true,
      message: "Budget mis à jour avec succès",
      data: {
        ...updatedBudget,
        spent: spending.spent,
        remaining: Math.max(0, remaining),
        percentage: Math.min(100, percentage),
        isOverBudget,
        status: isOverBudget ? "over" : percentage > 80 ? "warning" : "good",
      },
    })
  } catch (error) {
    next(error)
  }
})

// Supprimer un budget
router.delete("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Vérifier que le budget existe
    const existingBudget = db
      .prepare(`
      SELECT id, amount FROM budgets WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!existingBudget) {
      return res.status(404).json({
        error: "Budget non trouvé",
        code: "BUDGET_NOT_FOUND",
      })
    }

    const deleteBudget = db.prepare("DELETE FROM budgets WHERE id = ? AND userId = ?")
    deleteBudget.run(id, userId)

    res.json({
      success: true,
      message: "Budget supprimé avec succès",
    })
  } catch (error) {
    next(error)
  }
})

export default router
