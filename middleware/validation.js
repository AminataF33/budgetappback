import { body, param, query, validationResult } from "express-validator"

// Middleware pour gérer les erreurs de validation
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Données invalides",
      code: "VALIDATION_ERROR",
      details: errors.array(),
    })
  }
  next()
}

// Validations pour l'authentification
export const validateSignup = [
  body("firstName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Le prénom doit contenir entre 2 et 50 caractères"),
  body("lastName").trim().isLength({ min: 2, max: 50 }).withMessage("Le nom doit contenir entre 2 et 50 caractères"),
  body("email").isEmail().normalizeEmail().withMessage("Email invalide"),
  body("phone")
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Numéro de téléphone invalide"),
  body("password").isLength({ min: 6 }).withMessage("Le mot de passe doit contenir au moins 6 caractères"),
  body("city").trim().isLength({ min: 2, max: 100 }).withMessage("La ville doit contenir entre 2 et 100 caractères"),
  body("profession")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("La profession doit contenir entre 2 et 100 caractères"),
  handleValidationErrors,
]

export const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Email invalide"),
  body("password").notEmpty().withMessage("Mot de passe requis"),
  handleValidationErrors,
]

// Validations pour les transactions
export const validateTransaction = [
  body("description")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("La description doit contenir entre 1 et 255 caractères"),
  body("amount")
    .isNumeric()
    .custom((value) => {
      if (value === 0) {
        throw new Error("Le montant ne peut pas être zéro")
      }
      if (Math.abs(value) > 999999999) {
        throw new Error("Le montant est trop élevé")
      }
      return true
    }),
  body("categoryId").isInt({ min: 1 }).withMessage("ID de catégorie invalide"),
  body("accountId").isInt({ min: 1 }).withMessage("ID de compte invalide"),
  body("date").isISO8601().withMessage("Date invalide"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Les notes ne peuvent pas dépasser 1000 caractères"),
  handleValidationErrors,
]

// Validations pour les comptes
export const validateAccount = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Le nom du compte doit contenir entre 1 et 100 caractères"),
  body("bank")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Le nom de la banque doit contenir entre 1 et 100 caractères"),
  body("type").isIn(["checking", "savings", "credit", "mobile"]).withMessage("Type de compte invalide"),
  body("balance").optional().isNumeric().withMessage("Solde invalide"),
  handleValidationErrors,
]

// Validations pour les budgets
export const validateBudget = [
  body("categoryId").isInt({ min: 1 }).withMessage("ID de catégorie invalide"),
  body("amount").isFloat({ min: 0.01 }).withMessage("Le montant doit être positif"),
  body("period").isIn(["weekly", "monthly", "yearly"]).withMessage("Période invalide"),
  body("startDate").isISO8601().withMessage("Date de début invalide"),
  body("endDate")
    .isISO8601()
    .withMessage("Date de fin invalide")
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error("La date de fin doit être après la date de début")
      }
      return true
    }),
  handleValidationErrors,
]

// Validations pour les objectifs
export const validateGoal = [
  body("title").trim().isLength({ min: 1, max: 200 }).withMessage("Le titre doit contenir entre 1 et 200 caractères"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("La description ne peut pas dépasser 1000 caractères"),
  body("targetAmount").isFloat({ min: 0.01 }).withMessage("Le montant cible doit être positif"),
  body("currentAmount").optional().isFloat({ min: 0 }).withMessage("Le montant actuel doit être positif ou nul"),
  body("deadline")
    .optional()
    .isISO8601()
    .withMessage("Date limite invalide")
    .custom((deadline) => {
      if (new Date(deadline) <= new Date()) {
        throw new Error("La date limite doit être dans le futur")
      }
      return true
    }),
  body("category")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("La catégorie doit contenir entre 1 et 100 caractères"),
  handleValidationErrors,
]

// Validations pour les catégories
export const validateCategory = [
  body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Le nom doit contenir entre 1 et 100 caractères"),
  body("type").isIn(["income", "expense"]).withMessage("Type invalide (income ou expense)"),
  body("color")
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage("Couleur invalide (format hex requis)"),
  handleValidationErrors,
]

// Validations pour les paramètres de requête
export const validateTransactionQuery = [
  query("category").optional().trim().isLength({ min: 1 }).withMessage("Catégorie invalide"),
  query("search").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Terme de recherche invalide"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limite invalide (1-100)"),
  query("offset").optional().isInt({ min: 0 }).withMessage("Offset invalide"),
  query("startDate").optional().isISO8601().withMessage("Date de début invalide"),
  query("endDate").optional().isISO8601().withMessage("Date de fin invalide"),
  handleValidationErrors,
]

// Validation des paramètres d'ID
export const validateId = [param("id").isInt({ min: 1 }).withMessage("ID invalide"), handleValidationErrors]
