# Assistant de Vie Familiale

Application de gestion familiale permettant de gerer les taches, privileges, contrats et portefeuilles des enfants.

## Fonctionnalites

- Gestion des profils parents et enfants
- Calendrier avec vue personnelle ou familiale
- Gestion des taches assignees aux enfants
- Gestion des privileges
- Suivi des infractions aux regles
- Gestion des contrats entre parents et enfants
- Portefeuille virtuel pour les enfants

## Installation

```bash
# Installer les dependances
npm install

# Lancer l'application en mode developpement
npm run dev
```

## Configuration

L'application utilise un mode "mock data" par defaut pour faciliter le developpement. Pour basculer vers l'API reelle, modifiez la variable `USE_MOCK_DATA` dans le fichier `src/services/api.ts`.

## Specification de l'API Backend

L'application frontend communique avec un backend via les endpoints suivants :

### Authentification

#### `GET /api/auth/google`
- **Description** : Initie l'authentification OAuth avec Google
- **Reponse** : Redirige vers Google pour l'authentification, puis renvoie les informations de l'utilisateur connecte
- **Format de reponse** : `User`

#### `GET /api/auth/me`
- **Description** : Recupere les informations de l'utilisateur actuellement connecte
- **Reponse** : Informations de l'utilisateur ou null si non connecte
- **Format de reponse** : `User | null`

#### `POST /api/auth/logout`
- **Description** : Deconnecte l'utilisateur actuel
- **Reponse** : Statut de succes

### Utilisateurs

#### `GET /api/users/family`
- **Description** : Recupere tous les membres de la famille de l'utilisateur connecte
- **Reponse** : Liste des utilisateurs de la famille
- **Format de reponse** : `User[]`

### Taches

#### `GET /api/tasks`
- **Description** : Recupere toutes les taches (accessible uniquement aux parents)
- **Reponse** : Liste de toutes les taches
- **Format de reponse** : `Task[]`

#### `GET /api/tasks/user/:userId`
- **Description** : Recupere les taches assignees a un utilisateur specifique
- **Parametres** : `userId` - ID de l'utilisateur
- **Reponse** : Liste des taches assignees a l'utilisateur
- **Format de reponse** : `Task[]`

#### `POST /api/tasks`
- **Description** : Cree une nouvelle tache (accessible uniquement aux parents)
- **Corps de la requete** : Donnees de la tache sans ID ni date de creation
- **Format du corps** : `Omit<Task, 'id' | 'createdAt'>`
- **Reponse** : Tache creee avec ID et date de creation
- **Format de reponse** : `Task`

#### `PUT /api/tasks/:taskId`
- **Description** : Met a jour une tache existante
- **Parametres** : `taskId` - ID de la tache
- **Corps de la requete** : Donnees partielles de la tache a mettre a jour
- **Format du corps** : `Partial<Task>`
- **Reponse** : Tache mise a jour
- **Format de reponse** : `Task`

#### `PUT /api/tasks/:taskId/complete`
- **Description** : Marque une tache comme terminee
- **Parametres** : `taskId` - ID de la tache
- **Reponse** : Tache mise a jour
- **Format de reponse** : `Task`

#### `DELETE /api/tasks/:taskId`
- **Description** : Supprime une tache (accessible uniquement aux parents)
- **Parametres** : `taskId` - ID de la tache
- **Reponse** : Statut de succes

### Privileges

#### `GET /api/privileges`
- **Description** : Recupere tous les privileges (accessible uniquement aux parents)
- **Reponse** : Liste de tous les privileges
- **Format de reponse** : `Privilege[]`

#### `GET /api/privileges/user/:userId`
- **Description** : Recupere les privileges d'un utilisateur specifique
- **Parametres** : `userId` - ID de l'utilisateur
- **Reponse** : Liste des privileges de l'utilisateur
- **Format de reponse** : `Privilege[]`

#### `POST /api/privileges`
- **Description** : Cree un nouveau privilege (accessible uniquement aux parents)
- **Corps de la requete** : Donnees du privilege sans ID
- **Format du corps** : `Omit<Privilege, 'id'>`
- **Reponse** : Privilege cree avec ID
- **Format de reponse** : `Privilege`

#### `PUT /api/privileges/:privilegeId`
- **Description** : Met a jour un privilege existant (accessible uniquement aux parents)
- **Parametres** : `privilegeId` - ID du privilege
- **Corps de la requete** : Donnees partielles du privilege a mettre a jour
- **Format du corps** : `Partial<Privilege>`
- **Reponse** : Privilege mis a jour
- **Format de reponse** : `Privilege`

#### `DELETE /api/privileges/:privilegeId`
- **Description** : Supprime un privilege (accessible uniquement aux parents)
- **Parametres** : `privilegeId` - ID du privilege
- **Reponse** : Statut de succes

### Infractions aux regles

#### `GET /api/rule-violations`
- **Description** : Recupere toutes les infractions aux regles (accessible uniquement aux parents)
- **Reponse** : Liste de toutes les infractions
- **Format de reponse** : `RuleViolation[]`

#### `GET /api/rule-violations/child/:childId`
- **Description** : Recupere les infractions aux regles d'un enfant specifique
- **Parametres** : `childId` - ID de l'enfant
- **Reponse** : Liste des infractions de l'enfant
- **Format de reponse** : `RuleViolation[]`

#### `POST /api/rule-violations`
- **Description** : Cree une nouvelle infraction (accessible uniquement aux parents)
- **Corps de la requete** : Donnees de l'infraction sans ID
- **Format du corps** : `Omit<RuleViolation, 'id'>`
- **Reponse** : Infraction creee avec ID
- **Format de reponse** : `RuleViolation`

#### `DELETE /api/rule-violations/:violationId`
- **Description** : Supprime une infraction (accessible uniquement aux parents)
- **Parametres** : `violationId` - ID de l'infraction
- **Reponse** : Statut de succes

### Contrats

#### `GET /api/contracts`
- **Description** : Recupere tous les contrats (accessible uniquement aux parents)
- **Reponse** : Liste de tous les contrats
- **Format de reponse** : `Contract[]`

#### `GET /api/contracts/:contractId`
- **Description** : Recupere un contrat specifique
- **Parametres** : `contractId` - ID du contrat
- **Reponse** : Details du contrat
- **Format de reponse** : `Contract`

#### `GET /api/contracts/child/:childId`
- **Description** : Recupere les contrats d'un enfant specifique
- **Parametres** : `childId` - ID de l'enfant
- **Reponse** : Liste des contrats de l'enfant
- **Format de reponse** : `Contract[]`

#### `POST /api/contracts`
- **Description** : Cree un nouveau contrat (accessible uniquement aux parents)
- **Corps de la requete** : Donnees du contrat sans ID
- **Format du corps** : `Omit<Contract, 'id'>`
- **Reponse** : Contrat cree avec ID
- **Format de reponse** : `Contract`

#### `PUT /api/contracts/:contractId`
- **Description** : Met a jour un contrat existant (accessible uniquement aux parents)
- **Parametres** : `contractId` - ID du contrat
- **Corps de la requete** : Donnees partielles du contrat a mettre a jour
- **Format du corps** : `Partial<Contract>`
- **Reponse** : Contrat mis a jour
- **Format de reponse** : `Contract`

#### `PUT /api/contracts/:contractId/deactivate`
- **Description** : Desactive un contrat (accessible uniquement aux parents)
- **Parametres** : `contractId` - ID du contrat
- **Reponse** : Contrat mis a jour
- **Format de reponse** : `Contract`

### Portefeuilles

#### `GET /api/wallets/:childId`
- **Description** : Recupere le portefeuille d'un enfant
- **Parametres** : `childId` - ID de l'enfant
- **Reponse** : Details du portefeuille
- **Format de reponse** : `Wallet`

#### `GET /api/wallets/:childId/transactions`
- **Description** : Recupere les transactions du portefeuille d'un enfant
- **Parametres** : `childId` - ID de l'enfant
- **Reponse** : Liste des transactions
- **Format de reponse** : `WalletTransaction[]`

#### `POST /api/wallets/:childId/convert`
- **Description** : Convertit des euros virtuels en euros reels (accessible uniquement aux parents)
- **Parametres** : `childId` - ID de l'enfant
- **Corps de la requete** : Montant a convertir
- **Format du corps** : `{ amount: number }`
- **Reponse** : Portefeuille mis a jour
- **Format de reponse** : `Wallet`

## Traitement automatique des contrats

Le backend doit implementer un traitement automatique qui s'execute chaque jour a minuit pour :

1. Verifier pour chaque contrat actif si toutes les conditions sont remplies :
   - Toutes les taches assignees a l'enfant pour la journee sont marquees comme terminees
   - Aucune infraction aux regles du contrat n'a ete enregistree pour la journee

2. Si toutes les conditions sont remplies, ajouter automatiquement le montant de la recompense journaliere au portefeuille de l'enfant

3. Creer une transaction dans l'historique du portefeuille avec la raison "Recompense journaliere" et une reference au contrat

## Types de donnees

Les principaux types de donnees utilises par l'API sont definis dans le fichier `src/types/index.ts` du frontend.

## Securite

L'API doit implementer les mesures de securite suivantes :

1. Authentification via OAuth avec Google
2. Verification des roles (parent/enfant) pour les operations restreintes
3. Validation des donnees entrantes
4. Protection CSRF
5. Rate limiting pour prevenir les abus
