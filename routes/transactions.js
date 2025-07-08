import express from "express"
import db from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"
import { validateTransaction, validateTransactionQuery, validateId } from "../middleware/validation.js"

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(authenticateToken)

// Récupérer les transactions avec filtres avancés
router.get("/", validateTransactionQuery, (req, res, next) => {
  try {
    const {
      category,
      search,
      limit = 50,
      offset = 0,
      startDate,
      endDate,
      accountId,
      type, // income ou expense
      sortBy = "date",
      sortOrder = "desc",
    } = req.query
    const userId = req.user.id

    let query = `
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes, t.createdAt, t.updatedAt,
        c.name as category, c.color as categoryColor, c.type as categoryType,
        a.name as account, a.type as accountType, a.bank
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.userId = ?
    `
    const params = [userId]

    // Filtres
    if (category && category !== "all") {
      query += " AND c.name = ?"
      params.push(category)
    }

    if (accountId) {
      query += " AND t.accountId = ?"
      params.push(accountId)
    }

    if (type) {
      if (type === "income") {
        query += " AND t.amount > 0"
      } else if (type === "expense") {
        query += " AND t.amount < 0"
      }
    }

    if (search) {
      query += " AND (t.description LIKE ? OR t.notes LIKE ?)"
      params.push(`%${search}%`, `%${search}%`)
    }

    if (startDate) {
      query += " AND t.date >= ?"
      params.push(startDate)
    }

    if (endDate) {
      query += " AND t.date <= ?"
      params.push(endDate)
    }

    // Tri
    const validSortFields = ["date", "amount", "description", "category", "account"]
    const validSortOrders = ["asc", "desc"]

    const sortField = validSortFields.includes(sortBy) ? sortBy : "date"
    const order = validSortOrders.includes(sortOrder) ? sortOrder : "desc"

    if (sortField === "category") {
      query += ` ORDER BY c.name ${order}, t.date DESC`
    } else if (sortField === "account") {
      query += ` ORDER BY a.name ${order}, t.date DESC`
    } else {
      query += ` ORDER BY t.${sortField} ${order}`
      if (sortField !== "date") {
        query += ", t.date DESC"
      }
    }

    query += " LIMIT ? OFFSET ?"
    params.push(Number.parseInt(limit), Number.parseInt(offset))

    const transactions = db.prepare(query).all(...params)

    // Compter le total pour la pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.userId = ?
    `
    const countParams = [userId]

    // Appliquer les mêmes filtres pour le count
    if (category && category !== "all") {
      countQuery += " AND c.name = ?"
      countParams.push(category)
    }

    if (accountId) {
      countQuery += " AND t.accountId = ?"
      countParams.push(accountId)
    }

    if (type) {
      if (type === "income") {
        countQuery += " AND t.amount > 0"
      } else if (type === "expense") {
        countQuery += " AND t.amount < 0"
      }
    }

    if (search) {
      countQuery += " AND (t.description LIKE ? OR t.notes LIKE ?)"
      countParams.push(`%${search}%`, `%${search}%`)
    }

    if (startDate) {
      countQuery += " AND t.date >= ?"
      countParams.push(startDate)
    }

    if (endDate) {
      countQuery += " AND t.date <= ?"
      countParams.push(endDate)
    }

    const { total } = db.prepare(countQuery).get(...countParams)

    // Calculer les statistiques pour les transactions filtrées
    let statsQuery = `
      SELECT 
        COUNT(*) as transactionCount,
        COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as totalExpenses,
        COALESCE(AVG(CASE WHEN t.amount > 0 THEN t.amount END), 0) as avgIncome,
        COALESCE(AVG(CASE WHEN t.amount < 0 THEN ABS(t.amount) END), 0) as avgExpense
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.userId = ?
    `

    // Appliquer les mêmes filtres pour les stats
    const statsParams = [...countParams]
    if (category && category !== "all") {
      statsQuery += " AND c.name = ?"
    }
    if (accountId) {
      statsQuery += " AND t.accountId = ?"
    }
    if (type) {
      if (type === "income") {
        statsQuery += " AND t.amount > 0"
      } else if (type === "expense") {
        statsQuery += " AND t.amount < 0"
      }
    }
    if (search) {
      statsQuery += " AND (t.description LIKE ? OR t.notes LIKE ?)"
    }
    if (startDate) {
      statsQuery += " AND t.date >= ?"
    }
    if (endDate) {
      statsQuery += " AND t.date <= ?"
    }

    const stats = db.prepare(statsQuery).get(...statsParams)

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        limit: Number.parseInt(limit),
        offset: Number.parseInt(offset),
        hasMore: Number.parseInt(offset) + Number.parseInt(limit) < total,
        page: Math.floor(Number.parseInt(offset) / Number.parseInt(limit)) + 1,
        totalPages: Math.ceil(total / Number.parseInt(limit)),
      },
      stats: {
        ...stats,
        netAmount: stats.totalIncome - stats.totalExpenses,
      },
      filters: {
        category,
        accountId,
        type,
        search,
        startDate,
        endDate,
        sortBy: sortField,
        sortOrder: order,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Ajouter une transaction
router.post("/", validateTransaction, (req, res, next) => {
  try {
    const { description, amount, categoryId, accountId, date, notes } = req.body
    const userId = req.user.id

    // Vérifier que le compte appartient à l'utilisateur
    const account = db
      .prepare(`
      SELECT id, name, balance, type FROM accounts WHERE id = ? AND userId = ?
    `)
      .get(accountId, userId)

    if (!account) {
      return res.status(404).json({
        error: "Compte non trouvé",
        code: "ACCOUNT_NOT_FOUND",
      })
    }

    // Vérifier que la catégorie existe
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

    // Vérifier la cohérence entre le type de transaction et la catégorie
    const isIncome = amount > 0
    const isExpense = amount < 0

    if (isIncome && category.type !== "income") {
      return res.status(400).json({
        error: "Une transaction de revenu doit utiliser une catégorie de type 'income'",
        code: "CATEGORY_TYPE_MISMATCH",
      })
    }

    if (isExpense && category.type !== "expense") {
      return res.status(400).json({
        error: "Une transaction de dépense doit utiliser une catégorie de type 'expense'",
        code: "CATEGORY_TYPE_MISMATCH",
      })
    }

    // Vérifier si le compte a suffisamment de fonds pour une dépense (sauf pour les comptes de crédit)
    if (isExpense && account.type !== "credit") {
      const newBalance = account.balance + amount // amount est négatif pour les dépenses
      if (newBalance < 0) {
        return res.status(400).json({
          error: "Solde insuffisant pour cette transaction",
          code: "INSUFFICIENT_FUNDS",
          details: {
            currentBalance: account.balance,
            transactionAmount: amount,
            resultingBalance: newBalance,
          },
        })
      }
    }

    // Transaction de base de données
    const transaction = db.transaction(() => {
      // Insérer la transaction
      const insertTransaction = db.prepare(`
        INSERT INTO transactions (userId, accountId, categoryId, description, amount, date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const result = insertTransaction.run(userId, accountId, categoryId, description, amount, date, notes || null)

      // Mettre à jour le solde du compte
      const updateBalance = db.prepare(`
        UPDATE accounts 
        SET balance = balance + ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `)
      updateBalance.run(amount, accountId)

      return result.lastInsertRowid
    })

    const transactionId = transaction()

    // Récupérer la transaction créée avec toutes les informations
    const newTransaction = db
      .prepare(`
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes, t.createdAt,
        c.name as category, c.color as categoryColor, c.type as categoryType,
        a.name as account, a.type as accountType, a.bank
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.id = ?
    `)
      .get(transactionId)

    res.status(201).json({
      success: true,
      message: "Transaction ajoutée avec succès",
      data: newTransaction,
    })
  } catch (error) {
    next(error)
  }
})

// Récupérer une transaction spécifique
router.get("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const transaction = db
      .prepare(`
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes, t.createdAt, t.updatedAt,
        c.id as categoryId, c.name as category, c.color as categoryColor, c.type as categoryType,
        a.id as accountId, a.name as account, a.type as accountType, a.bank
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.id = ? AND t.userId = ?
    `)
      .get(id, userId)

    if (!transaction) {
      return res.status(404).json({
        error: "Transaction non trouvée",
        code: "TRANSACTION_NOT_FOUND",
      })
    }

    res.json({
      success: true,
      data: transaction,
    })
  } catch (error) {
    next(error)
  }
})

// Mettre à jour une transaction
router.put("/:id", validateId, validateTransaction, (req, res, next) => {
  try {
    const { id } = req.params
    const { description, amount, categoryId, accountId, date, notes } = req.body
    const userId = req.user.id

    // Vérifier que la transaction appartient à l'utilisateur
    const existingTransaction = db
      .prepare(`
      SELECT id, amount, accountId, categoryId, description, date, notes
      FROM transactions 
      WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!existingTransaction) {
      return res.status(404).json({
        error: "Transaction non trouvée",
        code: "TRANSACTION_NOT_FOUND",
      })
    }

    // Vérifier que le nouveau compte appartient à l'utilisateur
    const account = db
      .prepare(`
      SELECT id, name, balance, type FROM accounts WHERE id = ? AND userId = ?
    `)
      .get(accountId, userId)

    if (!account) {
      return res.status(404).json({
        error: "Compte non trouvé",
        code: "ACCOUNT_NOT_FOUND",
      })
    }

    // Vérifier que la nouvelle catégorie existe
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

    // Vérifier la cohérence entre le type de transaction et la catégorie
    const isIncome = amount > 0
    const isExpense = amount < 0

    if (isIncome && category.type !== "income") {
      return res.status(400).json({
        error: "Une transaction de revenu doit utiliser une catégorie de type 'income'",
        code: "CATEGORY_TYPE_MISMATCH",
      })
    }

    if (isExpense && category.type !== "expense") {
      return res.status(400).json({
        error: "Une transaction de dépense doit utiliser une catégorie de type 'expense'",
        code: "CATEGORY_TYPE_MISMATCH",
      })
    }

    // Transaction de base de données
    const transaction = db.transaction(() => {
      // Annuler l'ancien montant du compte précédent
      if (existingTransaction.accountId === accountId) {
        // Même compte : ajuster la différence
        const difference = amount - existingTransaction.amount
        const updateBalance = db.prepare(`
          UPDATE accounts 
          SET balance = balance + ?, updatedAt = CURRENT_TIMESTAMP 
          WHERE id = ?
        `)
        updateBalance.run(difference, accountId)
      } else {
        // Comptes différents : annuler de l'ancien et ajouter au nouveau
        const revertBalance = db.prepare(`
          UPDATE accounts 
          SET balance = balance - ?, updatedAt = CURRENT_TIMESTAMP 
          WHERE id = ?
        `)
        revertBalance.run(existingTransaction.amount, existingTransaction.accountId)

        const applyBalance = db.prepare(`
          UPDATE accounts 
          SET balance = balance + ?, updatedAt = CURRENT_TIMESTAMP 
          WHERE id = ?
        `)
        applyBalance.run(amount, accountId)
      }

      // Mettre à jour la transaction
      const updateTransaction = db.prepare(`
        UPDATE transactions 
        SET description = ?, amount = ?, categoryId = ?, accountId = ?, date = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND userId = ?
      `)
      updateTransaction.run(description, amount, categoryId, accountId, date, notes || null, id, userId)
    })

    transaction()

    // Récupérer la transaction mise à jour
    const updatedTransaction = db
      .prepare(`
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes, t.createdAt, t.updatedAt,
        c.name as category, c.color as categoryColor, c.type as categoryType,
        a.name as account, a.type as accountType, a.bank
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.id = ?
    `)
      .get(id)

    res.json({
      success: true,
      message: "Transaction mise à jour avec succès",
      data: updatedTransaction,
    })
  } catch (error) {
    next(error)
  }
})

// Supprimer une transaction
router.delete("/:id", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Vérifier que la transaction appartient à l'utilisateur
    const existingTransaction = db
      .prepare(`
      SELECT id, amount, accountId, description
      FROM transactions 
      WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!existingTransaction) {
      return res.status(404).json({
        error: "Transaction non trouvée",
        code: "TRANSACTION_NOT_FOUND",
      })
    }

    // Transaction de base de données
    const transaction = db.transaction(() => {
      // Annuler le montant du compte
      const revertBalance = db.prepare(`
        UPDATE accounts 
        SET balance = balance - ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `)
      revertBalance.run(existingTransaction.amount, existingTransaction.accountId)

      // Supprimer la transaction
      const deleteTransaction = db.prepare("DELETE FROM transactions WHERE id = ? AND userId = ?")
      deleteTransaction.run(id, userId)
    })

    transaction()

    res.json({
      success: true,
      message: "Transaction supprimée avec succès",
      data: {
        deletedTransaction: {
          id: existingTransaction.id,
          description: existingTransaction.description,
          amount: existingTransaction.amount,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

// Dupliquer une transaction
router.post("/:id/duplicate", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { date: newDate, description: newDescription } = req.body

    // Récupérer la transaction originale
    const originalTransaction = db
      .prepare(`
      SELECT description, amount, categoryId, accountId, notes
      FROM transactions 
      WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!originalTransaction) {
      return res.status(404).json({
        error: "Transaction non trouvée",
        code: "TRANSACTION_NOT_FOUND",
      })
    }

    // Vérifier que le compte existe toujours
    const account = db
      .prepare(`
      SELECT id, balance, type FROM accounts WHERE id = ? AND userId = ?
    `)
      .get(originalTransaction.accountId, userId)

    if (!account) {
      return res.status(404).json({
        error: "Le compte de la transaction originale n'existe plus",
        code: "ACCOUNT_NOT_FOUND",
      })
    }

    // Utiliser la date actuelle si aucune date n'est fournie
    const transactionDate = newDate || new Date().toISOString().split("T")[0]
    const description = newDescription || `${originalTransaction.description} (copie)`

    // Vérifier les fonds si c'est une dépense
    if (originalTransaction.amount < 0 && account.type !== "credit") {
      const newBalance = account.balance + originalTransaction.amount
      if (newBalance < 0) {
        return res.status(400).json({
          error: "Solde insuffisant pour dupliquer cette transaction",
          code: "INSUFFICIENT_FUNDS",
        })
      }
    }

    // Transaction de base de données
    const transaction = db.transaction(() => {
      // Insérer la nouvelle transaction
      const insertTransaction = db.prepare(`
        INSERT INTO transactions (userId, accountId, categoryId, description, amount, date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const result = insertTransaction.run(
        userId,
        originalTransaction.accountId,
        originalTransaction.categoryId,
        description,
        originalTransaction.amount,
        transactionDate,
        originalTransaction.notes,
      )

      // Mettre à jour le solde du compte
      const updateBalance = db.prepare(`
        UPDATE accounts 
        SET balance = balance + ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `)
      updateBalance.run(originalTransaction.amount, originalTransaction.accountId)

      return result.lastInsertRowid
    })

    const newTransactionId = transaction()

    // Récupérer la nouvelle transaction avec toutes les informations
    const newTransaction = db
      .prepare(`
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes, t.createdAt,
        c.name as category, c.color as categoryColor, c.type as categoryType,
        a.name as account, a.type as accountType, a.bank
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.id = ?
    `)
      .get(newTransactionId)

    res.status(201).json({
      success: true,
      message: "Transaction dupliquée avec succès",
      data: newTransaction,
    })
  } catch (error) {
    next(error)
  }
})

// Récupérer les transactions récurrentes (transactions similaires)
router.get("/:id/similar", validateId, (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { limit = 10 } = req.query

    // Récupérer la transaction de référence
    const referenceTransaction = db
      .prepare(`
      SELECT description, amount, categoryId, accountId
      FROM transactions 
      WHERE id = ? AND userId = ?
    `)
      .get(id, userId)

    if (!referenceTransaction) {
      return res.status(404).json({
        error: "Transaction non trouvée",
        code: "TRANSACTION_NOT_FOUND",
      })
    }

    // Chercher des transactions similaires
    const similarTransactions = db
      .prepare(`
      SELECT 
        t.id, t.description, t.amount, t.date, t.notes, t.createdAt,
        c.name as category, c.color as categoryColor,
        a.name as account, a.type as accountType
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.userId = ? 
        AND t.id != ?
        AND (
          t.description = ? 
          OR (t.categoryId = ? AND ABS(t.amount - ?) < ?)
          OR t.accountId = ?
        )
      ORDER BY 
        CASE 
          WHEN t.description = ? THEN 1
          WHEN t.categoryId = ? AND ABS(t.amount - ?) < ? THEN 2
          ELSE 3
        END,
        t.date DESC
      LIMIT ?
    `)
      .all(
        userId,
        id,
        referenceTransaction.description,
        referenceTransaction.categoryId,
        referenceTransaction.amount,
        Math.abs(referenceTransaction.amount) * 0.1, // 10% de tolérance
        referenceTransaction.accountId,
        referenceTransaction.description,
        referenceTransaction.categoryId,
        referenceTransaction.amount,
        Math.abs(referenceTransaction.amount) * 0.1,
        Number.parseInt(limit),
      )

    res.json({
      success: true,
      data: similarTransactions,
      reference: {
        id,
        description: referenceTransaction.description,
        amount: referenceTransaction.amount,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Statistiques des transactions par période
router.get("/stats/period", (req, res, next) => {
  try {
    const userId = req.user.id
    const { period = "month", groupBy = "category" } = req.query

    // Calculer les dates selon la période
    let dateFilter = ""
    let groupByClause = ""
    let selectClause = ""

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
      case "all":
        dateFilter = ""
        break
      default:
        dateFilter = "AND t.date >= date('now', '-1 month')"
    }

    // Définir le groupement
    switch (groupBy) {
      case "category":
        selectClause = "c.name as label, c.color, c.type"
        groupByClause = "GROUP BY c.id, c.name, c.color, c.type"
        break
      case "account":
        selectClause = "a.name as label, a.type, a.bank"
        groupByClause = "GROUP BY a.id, a.name, a.type, a.bank"
        break
      case "month":
        selectClause = "strftime('%Y-%m', t.date) as label, 'month' as type"
        groupByClause = "GROUP BY strftime('%Y-%m', t.date)"
        break
      case "day":
        selectClause = "t.date as label, 'day' as type"
        groupByClause = "GROUP BY t.date"
        break
      default:
        selectClause = "c.name as label, c.color, c.type"
        groupByClause = "GROUP BY c.id, c.name, c.color, c.type"
    }

    const stats = db
      .prepare(`
      SELECT 
        ${selectClause},
        COUNT(*) as transactionCount,
        COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as totalExpenses,
        COALESCE(SUM(t.amount), 0) as netAmount,
        COALESCE(AVG(CASE WHEN t.amount > 0 THEN t.amount END), 0) as avgIncome,
        COALESCE(AVG(CASE WHEN t.amount < 0 THEN ABS(t.amount) END), 0) as avgExpense
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      JOIN accounts a ON t.accountId = a.id
      WHERE t.userId = ? ${dateFilter}
      ${groupByClause}
      ORDER BY totalExpenses DESC, totalIncome DESC
    `)
      .all(userId)

    // Calculer les totaux généraux
    const totals = db
      .prepare(`
      SELECT 
        COUNT(*) as totalTransactions,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as totalExpenses,
        COALESCE(SUM(amount), 0) as netAmount
      FROM transactions 
      WHERE userId = ? ${dateFilter}
    `)
      .get(userId)

    res.json({
      success: true,
      data: stats,
      totals,
      period,
      groupBy,
    })
  } catch (error) {
    next(error)
  }
})

export default router
