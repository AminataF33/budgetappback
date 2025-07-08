export const errorHandler = (err, req, res, next) => {
  console.error("Erreur:", err)

  // Erreur de validation
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Données invalides",
      code: "VALIDATION_ERROR",
      details: err.details || err.message,
    })
  }

  // Erreur de base de données SQLite
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return res.status(409).json({
      error: "Cette ressource existe déjà",
      code: "DUPLICATE_RESOURCE",
    })
  }

  if (err.code === "SQLITE_CONSTRAINT_FOREIGN_KEY") {
    return res.status(400).json({
      error: "Référence invalide",
      code: "INVALID_REFERENCE",
    })
  }

  // Erreur JWT
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Token invalide",
      code: "INVALID_TOKEN",
    })
  }

  // Erreur de taille de fichier
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "Fichier trop volumineux",
      code: "FILE_TOO_LARGE",
    })
  }

  // Erreur par défaut
  res.status(err.status || 500).json({
    error: err.message || "Erreur interne du serveur",
    code: err.code || "INTERNAL_ERROR",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  })
}
