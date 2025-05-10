# API Specification

## Authentication

### `GET /api/auth/google`
- **Description**: Initie l'authentification OAuth avec Google
- **Response**: Redirige vers Google pour l'authentification, puis renvoie les informations de l'utilisateur connecté
- **Format de réponse**: `User`

### `GET /api/auth/me`
- **Description**: Récupère les informations de l'utilisateur actuellement connecté
- **Response**: Informations de l'utilisateur ou null si non connecté
- **Format de réponse**: `User | null`

### `POST /api/auth/logout`
- **Description**: Déconnecte l'utilisateur actuel
- **Response**: Statut de succès

## Users

### `GET /api/users/family`
- **Description**: Récupère tous les membres de la famille de l'utilisateur connecté
- **Response**: Liste des utilisateurs de la famille
- **Format de réponse**: `User[]`

## Tasks

### `GET /api/tasks`
- **Description**: Récupère toutes les tâches (accessible uniquement aux parents)
- **Response**: Liste de toutes les tâches
- **Format de réponse**: `Task[]`

### `GET /api/tasks/user/:userId`
- **Description**: Récupère les tâches assignées à un utilisateur spécifique
- **Parameters**: `userId` - ID de l'utilisateur
- **Response**: Liste des tâches assignées à l'utilisateur
- **Format de réponse**: `Task[]`

### `GET /api/tasks/date/:date`
- **Description**: Récupère les tâches pour une date spécifique
- **Parameters**: `date` - Date au format YYYY-MM-DD
- **Response**: Liste des tâches pour cette date
- **Format de réponse**: `Task[]`

### `POST /api/tasks`
- **Description**: Crée une nouvelle tâche (accessible uniquement aux parents)
- **Request Body**: Données de la tâche sans ID ni date de création
- **Format du corps**: `Omit<Task, 'id' | 'createdAt'>`
- **Response**: Tâche créée avec ID et date de création
- **Format de réponse**: `Task`

### `PUT /api/tasks/:taskId`
- **Description**: Met à jour une tâche existante
- **Parameters**: `taskId` - ID de la tâche
- **Request Body**: Données partielles de la tâche à mettre à jour
- **Format du corps**: `Partial<Task>`
- **Response**: Tâche mise à jour
- **Format de réponse**: `Task`

### `PUT /api/tasks/:taskId/complete`
- **Description**: Marque une tâche comme terminée
- **Parameters**: `taskId` - ID de la tâche
- **Response**: Tâche mise à jour
- **Format de réponse**: `Task`

### `DELETE /api/tasks/:taskId`
- **Description**: Supprime une tâche (accessible uniquement aux parents)
- **Parameters**: `taskId` - ID de la tâche
- **Response**: Statut de succès

## Privileges

### `GET /api/privileges`
- **Description**: Récupère tous les privilèges (accessible uniquement aux parents)
- **Response**: Liste de tous les privilèges
- **Format de réponse**: `Privilege[]`

### `GET /api/privileges/user/:userId`
- **Description**: Récupère les privilèges d'un utilisateur spécifique
- **Parameters**: `userId` - ID de l'utilisateur
- **Response**: Liste des privilèges de l'utilisateur
- **Format de réponse**: `Privilege[]`

### `GET /api/privileges/date/:date`
- **Description**: Récupère les privilèges pour une date spécifique
- **Parameters**: `date` - Date au format YYYY-MM-DD
- **Response**: Liste des privilèges pour cette date
- **Format de réponse**: `Privilege[]`

### `POST /api/privileges`
- **Description**: Crée un nouveau privilège (accessible uniquement aux parents)
- **Request Body**: Données du privilège sans ID
- **Format du corps**: `Omit<Privilege, 'id'>`
- **Response**: Privilège créé avec ID
- **Format de réponse**: `Privilege`

### `PUT /api/privileges/:privilegeId`
- **Description**: Met à jour un privilège existant (accessible uniquement aux parents)
- **Parameters**: `privilegeId` - ID du privilège
- **Request Body**: Données partielles du privilège à mettre à jour
- **Format du corps**: `Partial<Privilege>`
- **Response**: Privilège mis à jour
- **Format de réponse**: `Privilege`

### `DELETE /api/privileges/:privilegeId`
- **Description**: Supprime un privilège (accessible uniquement aux parents)
- **Parameters**: `privilegeId` - ID du privilège
- **Response**: Statut de succès

## Rule Violations

### `GET /api/rule-violations`
- **Description**: Récupère toutes les infractions aux règles (accessible uniquement aux parents)
- **Response**: Liste de toutes les infractions
- **Format de réponse**: `RuleViolation[]`

### `GET /api/rule-violations/child/:childId`
- **Description**: Récupère les infractions aux règles d'un enfant spécifique
- **Parameters**: `childId` - ID de l'enfant
- **Response**: Liste des infractions de l'enfant
- **Format de réponse**: `RuleViolation[]`

### `GET /api/rule-violations/date/:date`
- **Description**: Récupère les infractions aux règles pour une date spécifique
- **Parameters**: `date` - Date au format YYYY-MM-DD
- **Response**: Liste des infractions pour cette date
- **Format de réponse**: `RuleViolation[]`

### `POST /api/rule-violations`
- **Description**: Crée une nouvelle infraction (accessible uniquement aux parents)
- **Request Body**: Données de l'infraction sans ID
- **Format du corps**: `Omit<RuleViolation, 'id'>`
- **Response**: Infraction créée avec ID
- **Format de réponse**: `RuleViolation`

### `DELETE /api/rule-violations/:violationId`
- **Description**: Supprime une infraction (accessible uniquement aux parents)
- **Parameters**: `violationId` - ID de l'infraction
- **Response**: Statut de succès

## Contracts

### `GET /api/contracts`
- **Description**: Récupère tous les contrats (accessible uniquement aux parents)
- **Response**: Liste de tous les contrats
- **Format de réponse**: `Contract[]`

### `GET /api/contracts/:contractId`
- **Description**: Récupère un contrat spécifique
- **Parameters**: `contractId` - ID du contrat
- **Response**: Détails du contrat
- **Format de réponse**: `Contract`

### `GET /api/contracts/child/:childId`
- **Description**: Récupère les contrats d'un enfant spécifique
- **Parameters**: `childId` - ID de l'enfant
- **Response**: Liste des contrats de l'enfant
- **Format de réponse**: `Contract[]`

### `POST /api/contracts`
- **Description**: Crée un nouveau contrat (accessible uniquement aux parents)
- **Request Body**: Données du contrat sans ID
- **Format du corps**: `Omit<Contract, 'id'>`
- **Response**: Contrat créé avec ID
- **Format de réponse**: `Contract`

### `PUT /api/contracts/:contractId`
- **Description**: Met à jour un contrat existant (accessible uniquement aux parents)
- **Parameters**: `contractId` - ID du contrat
- **Request Body**: Données partielles du contrat à mettre à jour
- **Format du corps**: `Partial<Contract>`
- **Response**: Contrat mis à jour
- **Format de réponse**: `Contract`

### `PUT /api/contracts/:contractId/deactivate`
- **Description**: Désactive un contrat (accessible uniquement aux parents)
- **Parameters**: `contractId` - ID du contrat
- **Response**: Contrat mis à jour
- **Format de réponse**: `Contract`

## Wallets

### `GET /api/wallets/:childId`
- **Description**: Récupère le portefeuille d'un enfant
- **Parameters**: `childId` - ID de l'enfant
- **Response**: Détails du portefeuille
- **Format de réponse**: `Wallet`

### `GET /api/wallets/:childId/transactions`
- **Description**: Récupère les transactions du portefeuille d'un enfant
- **Parameters**: `childId` - ID de l'enfant
- **Response**: Liste des transactions
- **Format de réponse**: `WalletTransaction[]`

### `POST /api/wallets/:childId/convert`
- **Description**: Convertit des euros virtuels en euros réels (accessible uniquement aux parents)
- **Parameters**: `childId` - ID de l'enfant
- **Request Body**: Montant à convertir
- **Format du corps**: `{ amount: number }`
- **Response**: Portefeuille mis à jour
- **Format de réponse**: `Wallet`

## Automatic Contract Processing

The backend implements automatic processing that runs daily at midnight to:

1. Check for each active contract if all conditions are met:
   - All tasks assigned to the child for the day are marked as completed
   - No rule violations related to the contract have been recorded for the day

2. If all conditions are met, automatically add the daily reward amount to the child's wallet

3. Create a transaction in the wallet history with the reason "Daily Reward" and a reference to the contract

## Security

The API implements the following security measures:

1. Authentication via OAuth with Google
2. Role verification (parent/child) for restricted operations
3. Input data validation
4. CSRF protection
5. Rate limiting to prevent abuse