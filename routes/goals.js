import express from "express"
import db from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"
import { validateGoal, validateId } from "../middleware/validation.js"

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(authenticateToken)

// Récupérer tous les objectifs de l'utilisateur
router.get("/", (req, res, next) => {
  try {
    const userId = req.user.id
    const { status, category } = req.query

    let query = `
      SELECT id, title, description, targetAmount, currentAmount, deadline, category, createdAt, updatedAt
      FROM goals 
      WHERE userId = ?
    `
    const params = [userId]

    if (category) {
      query += " AND category = ?"
      params.push(category)
    }

    query += " ORDER BY deadline ASC, createdAt DESC"

    const goals = db.prepare(query).all(...params)

    // Calculer les statistiques pour chaque objectif
    const goalsWithStats = goals.map((goal) => {
      const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
      const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
      const isCompleted = goal.currentAmount >= goal.targetAmount

      let goalStatus = "active"
      if (isCompleted) {
        goalStatus = "completed"
      } else if (goal.deadline && new Date(goal.deadline) < new Date()) {
        goalStatus = "expired"
      }

      return {
        ...goal,
        progress: Math.min(100, progress),
        remaining,
        isCompleted,
        status: goalStatus,
      }
    })

    // Filtrer par statut si demandé
    const filteredGoals = status ? goalsWithStats.filter((goal) => goal.status === status) : goalsWithStats

    res.json({
      success: true,
      data: filteredGoals,
    })
  } catch (error) {
    next(error)
  }
})

// Récupérer un objectif spécifique
router.get("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const goal = db
      .prepare(`
      SELECT id, title, description, targetAmount, currentAmount, deadline, category, createdAt, updatedAt
      FROM goals 
      WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!goal) {
      return res.status(404).json({
        error: "Objectif non trouvé",
        code: "GOAL_NOT_FOUND",
      })
    }

    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
    const isCompleted = goal.currentAmount >= goal.targetAmount

    let status = "active"
    if (isCompleted) {
      status = "completed"
    } else if (goal.deadline && new Date(goal.deadline) < new Date()) {
      status = "expired"
    }

    res.json({
      success: true,
      data: {
        ...goal,
        progress: Math.min(100, progress),
        remaining,
        isCompleted,
        status,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Créer un nouvel objectif
router.post("/", validateGoal, (req, res, next) => {
  try {
    const { title, description, targetAmount, currentAmount = 0, deadline, category } = req.body
    const userId = req.user.id

    const insertGoal = db.prepare(`
      INSERT INTO goals (userId, title, description, targetAmount, currentAmount, deadline, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const result = insertGoal.run(
      userId,
      title,
      description || null,
      targetAmount,
      currentAmount,
      deadline || null,
      category,
    )

    const newGoal = db
      .prepare(`
      SELECT id, title, description, targetAmount, currentAmount, deadline, category, createdAt
      FROM goals WHERE id = ?
    `)
      .get(result.lastInsertRowid)

    const progress = newGoal.targetAmount > 0 ? (newGoal.currentAmount / newGoal.targetAmount) * 100 : 0
    const remaining = Math.max(0, newGoal.targetAmount - newGoal.currentAmount)
    const isCompleted = newGoal.currentAmount >= newGoal.targetAmount

    res.status(201).json({
      success: true,
      message: "Objectif créé avec succès",
      data: {
        ...newGoal,
        progress: Math.min(100, progress),
        remaining,
        isCompleted,
        status: isCompleted ? "completed" : "active",
      },
    })
  } catch (error) {
    next(error)
  }
})

// Mettre à jour un objectif
router.put("/:id", validateId, validateGoal, (req, res, next) => {
  try {
    const { id } = req.params
    const { title, description, targetAmount, currentAmount, deadline, category } = req.body
    const userId = req.user.id

    // Vérifier que l'objectif existe
    const existingGoal = db
      .prepare(`
      SELECT id FROM goals WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!existingGoal) {
      return res.status(404).json({
        error: "Objectif non trouvé",
        code: "GOAL_NOT_FOUND",
      })
    }

    const updateGoal = db.prepare(`
      UPDATE goals 
      SET title = ?, description = ?, targetAmount = ?, currentAmount = ?, deadline = ?, category = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND userId = ?
    `)

    updateGoal.run(title, description || null, targetAmount, currentAmount, deadline || null, category, id, userId)

    const updatedGoal = db
      .prepare(`
      SELECT id, title, description, targetAmount, currentAmount, deadline, category, createdAt, updatedAt
      FROM goals WHERE id = ?
    `)
      .get(id)

    const progress = updatedGoal.targetAmount > 0 ? (updatedGoal.currentAmount / updatedGoal.targetAmount) * 100 : 0
    const remaining = Math.max(0, updatedGoal.targetAmount - updatedGoal.currentAmount)
    const isCompleted = updatedGoal.currentAmount >= updatedGoal.targetAmount

    let status = "active"
    if (isCompleted) {
      status = "completed"
    } else if (updatedGoal.deadline && new Date(updatedGoal.deadline) < new Date()) {
      status = "expired"
    }

    res.json({
      success: true,
      message: "Objectif mis à jour avec succès",
      data: {
        ...updatedGoal,
        progress: Math.min(100, progress),
        remaining,
        isCompleted,
        status,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Supprimer un objectif
router.delete("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Vérifier que l'objectif existe
    const existingGoal = db
      .prepare(`
      SELECT id, title FROM goals WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!existingGoal) {
      return res.status(404).json({
        error: "Objectif non trouvé",
        code: "GOAL_NOT_FOUND",
      })
    }

    const deleteGoal = db.prepare("DELETE FROM goals WHERE id = ? AND userId = ?")
    deleteGoal.run(id, userId)

    res.json({
      success: true,
      message: "Objectif supprimé avec succès",
    })
  } catch (error) {
    next(error)
  }
})

// Ajouter une contribution à un objectif
router.post("/:id/contribute", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const { amount } = req.body
    const userId = req.user.id

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: "Le montant de la contribution doit être positif",
        code: "INVALID_CONTRIBUTION_AMOUNT",
      })
    }

    // Vérifier que l'objectif existe
    const goal = db
      .prepare(`
      SELECT id, title, targetAmount, currentAmount
      FROM goals WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!goal) {
      return res.status(404).json({
        error: "Objectif non trouvé",
        code: "GOAL_NOT_FOUND",
      })
    }

    const newCurrentAmount = goal.currentAmount + amount

    // Mettre à jour l'objectif
    const updateGoal = db.prepare(`
      UPDATE goals 
      SET currentAmount = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND userId = ?
    `)

    updateGoal.run(newCurrentAmount, id, userId)

    const updatedGoal = db
      .prepare(`
      SELECT id, title, description, targetAmount, currentAmount, deadline, category, createdAt, updatedAt
      FROM goals WHERE id = ?
    `)
      .get(id)

    const progress = updatedGoal.targetAmount > 0 ? (updatedGoal.currentAmount / updatedGoal.targetAmount) * 100 : 0
    const remaining = Math.max(0, updatedGoal.targetAmount - updatedGoal.currentAmount)
    const isCompleted = updatedGoal.currentAmount >= updatedGoal.targetAmount

    res.json({
      success: true,
      message: `Contribution de ${amount.toLocaleString()} CFA ajoutée avec succès`,
      data: {
        ...updatedGoal,
        progress: Math.min(100, progress),
        remaining,
        isCompleted,
        status: isCompleted ? "completed" : "active",
        contribution: amount,
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
