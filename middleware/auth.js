import jwt from "jsonwebtoken"
import db from "../config/database.js"

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({
      error: "Token d'accès requis",
      code: "TOKEN_REQUIRED",
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")

    // Vérifier que l'utilisateur existe toujours
    const user = db.prepare("SELECT id, email, firstName, lastName FROM users WHERE id = ?").get(decoded.userId)

    if (!user) {
      return res.status(401).json({
        error: "Utilisateur non trouvé",
        code: "USER_NOT_FOUND",
      })
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expiré",
        code: "TOKEN_EXPIRED",
      })
    }

    return res.status(403).json({
      error: "Token invalide",
      code: "TOKEN_INVALID",
    })
  }
}

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
    const user = db.prepare("SELECT id, email, firstName, lastName FROM users WHERE id = ?").get(decoded.userId)

    if (user) {
      req.user = user
    }
  } catch (error) {
    // Ignorer les erreurs de token pour l'auth optionnelle
  }

  next()
}
