import express from "express"
import bcrypt from "bcryptjs"
import db from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"
import { body, validationResult } from "express-validator"

const router = express.Router()

// Middleware global d’authentification
router.use(authenticateToken)

// 📌 GET /profile – Récupérer le profil de l'utilisateur
router.get("/profile", (req, res, next) => {
  try {
    const userId = req.user.id

    const user = db.prepare(`
      SELECT id, firstName, lastName, email, phone, city, profession, createdAt, updatedAt
      FROM users WHERE id = ?
    `).get(userId)

    if (!user) {
      return res.status(404).json({
        error: "Utilisateur non trouvé",
        code: "USER_NOT_FOUND",
      })
    }

    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM accounts WHERE userId = ?) as accountCount,
        (SELECT COUNT(*) FROM transactions WHERE userId = ?) as transactionCount,
        (SELECT COUNT(*) FROM budgets WHERE userId = ?) as budgetCount,
        (SELECT COUNT(*) FROM goals WHERE userId = ?) as goalCount,
        (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE userId = ?) as totalBalance
    `).get(userId, userId, userId, userId, userId)

    res.json({
      success: true,
      data: {
        ...user,
        stats,
      },
    })
  } catch (error) {
    next(error)
  }
})

// 📌 PUT /profile – Mettre à jour le profil utilisateur
router.put("/profile", [
  body("firstName").trim().isLength({ min: 2, max: 50 }).withMessage("Prénom invalide"),
  body("lastName").trim().isLength({ min: 2, max: 50 }).withMessage("Nom invalide"),
  body("phone").matches(/^\+?[1-9]\d{1,14}$/).withMessage("Téléphone invalide"),
  body("city").trim().isLength({ min: 2, max: 100 }).withMessage("Ville invalide"),
  body("profession").trim().isLength({ min: 2, max: 100 }).withMessage("Profession invalide"),
], (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Données invalides",
        code: "VALIDATION_ERROR",
        details: errors.array(),
      })
    }

    const userId = req.user.id
    const { firstName, lastName, phone, city, profession } = req.body

    db.prepare(`
      UPDATE users 
      SET firstName = ?, lastName = ?, phone = ?, city = ?, profession = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(firstName, lastName, phone, city, profession, userId)

    const updatedUser = db.prepare(`
      SELECT id, firstName, lastName, email, phone, city, profession, createdAt, updatedAt
      FROM users WHERE id = ?
    `).get(userId)

    res.json({
      success: true,
      message: "Profil mis à jour avec succès",
      data: updatedUser,
    })
  } catch (error) {
    next(error)
  }
})

// 📌 PUT /password – Changer le mot de passe
router.put("/password", [
  body("currentPassword").notEmpty().withMessage("Mot de passe actuel requis"),
  body("newPassword").isLength({ min: 6 }).withMessage("Nouveau mot de passe trop court"),
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Données invalides",
        code: "VALIDATION_ERROR",
        details: errors.array(),
      })
    }

    const userId = req.user.id
    const { currentPassword, newPassword } = req.body

    const user = db.prepare("SELECT password FROM users WHERE id = ?").get(userId)
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Mot de passe actuel incorrect",
        code: "INVALID_CURRENT_PASSWORD",
      })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    db.prepare(`
      UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `).run(hashedNewPassword, userId)

    res.json({
      success: true,
      message: "Mot de passe modifié avec succès",
    })
  } catch (error) {
    next(error)
  }
})

// 📌 DELETE /account – Supprimer le compte utilisateur
router.delete("/account", [
  body("password").notEmpty().withMessage("Mot de passe requis")
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Mot de passe requis",
        code: "VALIDATION_ERROR",
        details: errors.array()
      })
    }

    const userId = req.user.id
    const { password } = req.body

    const user = db.prepare("SELECT password FROM users WHERE id = ?").get(userId)
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Mot de passe incorrect",
        code: "INVALID_PASSWORD",
      })
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(userId)

    res.json({
      success: true,
      message: "Compte supprimé avec succès"
    })
  } catch (error) {
    next(error)
  }
})

// ✅ Export par défaut du router
export default router
