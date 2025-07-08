import express from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import db from "../config/database.js"
import { validateSignup, validateLogin } from "../middleware/validation.js"
import { authenticateToken } from "../middleware/auth.js"

const router = express.Router()

// Inscription
router.post("/signup", validateSignup, async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, city, profession } = req.body

    // Vérifier si l'utilisateur existe déjà
    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email)
    if (existingUser) {
      return res.status(409).json({
        error: "Un compte avec cet email existe déjà",
        code: "EMAIL_ALREADY_EXISTS",
      })
    }

    // Hasher le mot de passe
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Insérer l'utilisateur
    const insertUser = db.prepare(`
      INSERT INTO users (firstName, lastName, email, phone, password, city, profession)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const result = insertUser.run(firstName, lastName, email, phone, hashedPassword, city, profession)
    const userId = result.lastInsertRowid

    // Créer un token JWT
    const token = jwt.sign({ userId, email }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" })

    // Récupérer les données utilisateur (sans le mot de passe)
    const user = db
      .prepare(`
      SELECT id, firstName, lastName, email, phone, city, profession, createdAt
      FROM users WHERE id = ?
    `)
      .get(userId)

    res.status(201).json({
      success: true,
      message: "Compte créé avec succès",
      token,
      user,
    })
  } catch (error) {
    next(error)
  }
})

// Connexion
router.post("/login", validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Trouver l'utilisateur
    const user = db
      .prepare(`
      SELECT id, firstName, lastName, email, phone, city, profession, password, createdAt
      FROM users WHERE email = ?
    `)
      .get(email)

    if (!user) {
      return res.status(401).json({
        error: "Email ou mot de passe incorrect",
        code: "INVALID_CREDENTIALS",
      })
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Email ou mot de passe incorrect",
        code: "INVALID_CREDENTIALS",
      })
    }

    // Créer un token JWT
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    })

    // Retourner les données (sans le mot de passe)
    const { password: _, ...userWithoutPassword } = user

    res.json({
      success: true,
      message: "Connexion réussie",
      token,
      user: userWithoutPassword,
    })
  } catch (error) {
    next(error)
  }
})

// Vérification du token
router.get("/me", authenticateToken, (req, res) => {
  const user = db
    .prepare(`
    SELECT id, firstName, lastName, email, phone, city, profession, createdAt
    FROM users WHERE id = ?
  `)
    .get(req.user.id)

  res.json({
    success: true,
    user,
  })
})

// Déconnexion (côté client principalement)
router.post("/logout", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Déconnexion réussie",
  })
})

// Changement de mot de passe
router.put("/change-password", authenticateToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Mot de passe actuel et nouveau mot de passe requis",
        code: "MISSING_PASSWORDS",
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Le nouveau mot de passe doit contenir au moins 6 caractères",
        code: "PASSWORD_TOO_SHORT",
      })
    }

    // Récupérer le mot de passe actuel
    const user = db.prepare("SELECT password FROM users WHERE id = ?").get(req.user.id)

    // Vérifier le mot de passe actuel
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Mot de passe actuel incorrect",
        code: "INVALID_CURRENT_PASSWORD",
      })
    }

    // Hasher le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Mettre à jour le mot de passe
    const updatePassword = db.prepare(`
      UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `)
    updatePassword.run(hashedNewPassword, req.user.id)

    res.json({
      success: true,
      message: "Mot de passe modifié avec succès",
    })
  } catch (error) {
    next(error)
  }
})

export default router
