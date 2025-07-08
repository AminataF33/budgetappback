# MonBudget Backend API

Backend API pour l'application de gestion budgétaire MonBudget, développé avec Node.js et Express.js.

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Installation

1. **Installer les dépendances**
\`\`\`bash
npm install
\`\`\`

2. **Configurer l'environnement**
\`\`\`bash
cp .env.example .env
# Modifier les variables dans .env selon vos besoins
\`\`\`

3. **Initialiser la base de données**
\`\`\`bash
npm run db:setup
npm run db:demo
\`\`\`

4. **Démarrer le serveur**
\`\`\`bash
# Mode développement
npm run dev

# Mode production
npm start
\`\`\`

Le serveur sera accessible sur `http://localhost:5000`

## 📊 API Endpoints

### Authentification
- `POST /api/auth/signup` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Vérifier le token
- `POST /api/auth/logout` - Déconnexion

### Utilisateurs
- `GET /api/users/profile` - Profil utilisateur
- `PUT /api/users/profile` - Mettre à jour le profil
- `PUT /api/users/password` - Changer le mot de passe
- `DELETE /api/users/account` - Supprimer le compte
- `GET /api/users/stats` - Statistiques utilisateur

### Comptes
- `GET /api/accounts` - Liste des comptes
- `POST /api/accounts` - Créer un compte
- `GET /api/accounts/:id` - Détails d'un compte
- `PUT /api/accounts/:id` - Mettre à jour un compte
- `DELETE /api/accounts/:id` - Supprimer un compte

### Transactions
- `GET /api/transactions` - Liste des transactions
- `POST /api/transactions` - Créer une transaction
- `GET /api/transactions/:id` - Détails d'une transaction
- `PUT /api/transactions/:id` - Mettre à jour une transaction
- `DELETE /api/transactions/:id` - Supprimer une transaction

### Budgets
- `GET /api/budgets` - Liste des budgets
- `POST /api/budgets` - Créer un budget
- `GET /api/budgets/:id` - Détails d'un budget
- `PUT /api/budgets/:id` - Mettre à jour un budget
- `DELETE /api/budgets/:id` - Supprimer un budget

### Objectifs
- `GET /api/goals` - Liste des objectifs
- `POST /api/goals` - Créer un objectif
- `GET /api/goals/:id` - Détails d'un objectif
- `PUT /api/goals/:id` - Mettre à jour un objectif
- `DELETE /api/goals/:id` - Supprimer un objectif
- `POST /api/goals/:id/contribute` - Contribuer à un objectif

### Catégories
- `GET /api/categories` - Liste des catégories
- `GET /api/categories/:id` - Détails d'une catégorie

### Analytics
- `GET /api/analytics` - Données d'analyse

### Dashboard
- `GET /api/dashboard` - Données du tableau de bord

## 🔐 Authentification

L'API utilise JWT (JSON Web Tokens) pour l'authentification. Incluez le token dans l'en-tête Authorization :

\`\`\`
Authorization: Bearer <votre-token>
\`\`\`

## 📝 Format des réponses

### Succès
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Message de succès"
}
\`\`\`

### Erreur
\`\`\`json
{
  "error": "Message d'erreur",
  "code": "ERROR_CODE",
  "details": { ... }
}
\`\`\`

## 🗄️ Base de données

L'application utilise SQLite avec Better-sqlite3 pour la persistance des données.

### Scripts disponibles
- `npm run db:setup` - Créer les tables
- `npm run db:demo` - Ajouter des données de démonstration
- `npm run db:reset` - Réinitialiser complètement la base

### Compte de démonstration
- **Email:** demo@monbudget.sn
- **Mot de passe:** demo123

## 🛡️ Sécurité

- Mots de passe hashés avec bcrypt
- Protection CORS configurée
- Rate limiting activé
- Validation des données d'entrée
- Headers de sécurité avec Helmet

## 📦 Structure du projet

\`\`\`
backend/
├── config/
│   └── database.js          # Configuration base de données
├── middleware/
│   ├── auth.js              # Authentification
│   ├── validation.js        # Validation des données
│   ├── errorHandler.js      # Gestion des erreurs
│   └── notFound.js          # Route non trouvée
├── routes/
│   ├── auth.js              # Routes d'authentification
│   ├── users.js             # Routes utilisateurs
│   ├── accounts.js          # Routes comptes
│   ├── transactions.js      # Routes transactions
│   ├── budgets.js           # Routes budgets
│   ├── goals.js             # Routes objectifs
│   ├── categories.js        # Routes catégories
│   ├── analytics.js         # Routes analyses
│   └── dashboard.js         # Routes dashboard
├── scripts/
│   ├── database-setup.js    # Initialisation DB
│   └── database-setup-demo.js # Données de démo
├── server.js                # Point d'entrée
├── package.json
└── README.md
\`\`\`

## 🚀 Déploiement

### Variables d'environnement de production
\`\`\`env
NODE_ENV=production
PORT=5000
JWT_SECRET=your-production-secret-key
FRONTEND_URL=https://your-frontend-domain.com
\`\`\`

### Commandes de déploiement
\`\`\`bash
npm run build
npm start
\`\`\`

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT.
