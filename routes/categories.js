import express from "express"
import db from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"
import { validateCategory, validateId } from "../middleware/validation.js"

const router = express.Router()

// Récupérer toutes les catégories (publique)
router.get("/", (req, res, next) => {
  try {
    const { type } = req.query

    let query = "SELECT id, name, type, color, createdAt FROM categories"
    const params = []

    if (type && ["income", "expense"].includes(type)) {
      query += " WHERE type = ?"
      params.push(type)
    }

    query += " ORDER BY name ASC"

    const categories = db.prepare(query).all(...params)

    res.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    next(error)
  }
})

// Récupérer une catégorie spécifique
router.get("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params

    const category = db
      .prepare(`
      SELECT id, name, type, color, createdAt
      FROM categories WHERE id = ?
    `)
      .get(id)

    if (!category) {
      return res.status(404).json({
        error: "Catégorie non trouvée",
        code: "CATEGORY_NOT_FOUND",
      })
    }

    res.json({
      success: true,
      data: category,
    })
  } catch (error) {
    next(error)
  }
})

// Créer une nouvelle catégorie (admin seulement pour l'instant)
router.post("/", authenticateToken, validateCategory, (req, res, next) => {
  try {
    const { name, type, color = "#3B82F6" } = req.body

    // Vérifier si la catégorie existe déjà
    const existingCategory = db.prepare("SELECT id FROM categories WHERE name = ?").get(name)
    if (existingCategory) {
      return res.status(409).json({
        error: "Une catégorie avec ce nom existe déjà",
        code: "CATEGORY_ALREADY_EXISTS",
      })
    }

    const insertCategory = db.prepare(`
      INSERT INTO categories (name, type, color)
      VALUES (?, ?, ?)
    `)

    const result = insertCategory.run(name, type, color)

    const newCategory = db
      .prepare(`
      SELECT id, name, type, color, createdAt
      FROM categories WHERE id = ?
    `)
      .get(result.lastInsertRowid)

    res.status(201).json({
      success: true,
      message: "Catégorie créée avec succès",
      data: newCategory,
    })
  } catch (error) {
    next(error)
  }
})

// Mettre à jour une catégorie
router.put("/:id", authenticateToken, validateId, validateCategory, (req, res, next) => {
  try {
    const { id } = req.params
    const { name, type, color } = req.body

    // Vérifier si la catégorie existe
    const existingCategory = db.prepare("SELECT id FROM categories WHERE id = ?").get(id)
    if (!existingCategory) {
      return res.status(404).json({
        error: "Catégorie non trouvée",
        code: "CATEGORY_NOT_FOUND",
      })
    }

    // Vérifier si le nouveau nom existe déjà (sauf pour cette catégorie)
    const duplicateCategory = db.prepare("SELECT id FROM categories WHERE name = ? AND id != ?").get(name, id)
    if (duplicateCategory) {
      return res.status(409).json({
        error: "Une catégorie avec ce nom existe déjà",
        code: "CATEGORY_ALREADY_EXISTS",
      })
    }

    const updateCategory = db.prepare(`
      UPDATE categories 
      SET name = ?, type = ?, color = ?
      WHERE id = ?
    `)

    updateCategory.run(name, type, color, id)

    const updatedCategory = db
      .prepare(`
      SELECT id, name, type, color, createdAt
      FROM categories WHERE id = ?
    `)
      .get(id)

    res.json({
      success: true,
      message: "Catégorie mise à jour avec succès",
      data: updatedCategory,
    })
  } catch (error) {
    next(error)
  }
})

// Supprimer une catégorie
router.delete("/:id", authenticateToken, validateId, (req, res, next) => {
  try {
    const { id } = req.params

    // Vérifier si la catégorie existe
    const existingCategory = db.prepare("SELECT id, name FROM categories WHERE id = ?").get(id)
    if (!existingCategory) {
      return res.status(404).json({
        error: "Catégorie non trouvée",
        code: "CATEGORY_NOT_FOUND",
      })
    }

    // Vérifier si la catégorie est utilisée dans des transactions
    const transactionCount = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE categoryId = ?").get(id)
    if (transactionCount.count > 0) {
      return res.status(409).json({
        error: "Impossible de supprimer une catégorie utilisée dans des transactions",
        code: "CATEGORY_IN_USE",
        details: {
          transactionCount: transactionCount.count,
        },
      })
    }

    // Vérifier si la catégorie est utilisée dans des budgets
    const budgetCount = db.prepare("SELECT COUNT(*) as count FROM budgets WHERE categoryId = ?").get(id)
    if (budgetCount.count > 0) {
      return res.status(409).json({
        error: "Impossible de supprimer une catégorie utilisée dans des budgets",
        code: "CATEGORY_IN_USE",
        details: {
          budgetCount: budgetCount.count,
        },
      })
    }

    const deleteCategory = db.prepare("DELETE FROM categories WHERE id = ?")
    deleteCategory.run(id)

    res.json({
      success: true,
      message: "Catégorie supprimée avec succès",
    })
  } catch (error) {
    next(error)
  }
})

// Statistiques d'utilisation des catégories
router.get("/:id/stats", authenticateToken, validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Vérifier si la catégorie existe
    const category = db.prepare("SELECT id, name, type FROM categories WHERE id = ?").get(id)
    if (!category) {
      return res.status(404).json({
        error: "Catégorie non trouvée",
        code: "CATEGORY_NOT_FOUND",
      })
    }

    // Statistiques des transactions
    const transactionStats = db
      .prepare(`
      SELECT 
        COUNT(*) as transactionCount,
        COALESCE(SUM(amount), 0) as totalAmount,
        COALESCE(AVG(amount), 0) as averageAmount,
        MIN(date) as firstTransaction,
        MAX(date) as lastTransaction
      FROM transactions 
      WHERE categoryId = ? AND userId = ?
    `)
      .get(id, userId)

    // Transactions par mois (6 derniers mois)
    const monthlyStats = db
      .prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        COUNT(*) as transactionCount,
        SUM(amount) as totalAmount
      FROM transactions 
      WHERE categoryId = ? AND userId = ? 
        AND date >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month DESC
    `)
      .all(id, userId)

    // Budget actuel pour cette catégorie
    const currentBudget = db
      .prepare(`
      SELECT amount, period, startDate, endDate
      FROM budgets 
      WHERE categoryId = ? AND userId = ? 
        AND startDate <= date('now') AND endDate >= date('now')
      ORDER BY createdAt DESC
      LIMIT 1
    `)
      .get(id, userId)

    res.json({
      success: true,
      data: {
        category,
        stats: transactionStats,
        monthlyStats,
        currentBudget,
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
