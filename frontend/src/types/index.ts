// Types pour les utilisateurs
export interface User {
  id: string;
  name: string;
  birthDate: string;
  isParent: boolean;
  profilePicture?: string;
}

// Types pour les tâches
export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string[]; // IDs des utilisateurs assignés
  dueDate: string;
  completed: boolean;
  createdBy: string; // ID du parent qui a créé la tâche
  createdAt: string;
}

// Types pour les privilèges
export interface Privilege {
  id: string;
  title: string;
  description?: string;
  assignedTo: string; // ID de l'utilisateur assigné
  earned: boolean;
  date: string;
}

// Types pour les infractions aux règles
export interface RuleViolation {
  id: string;
  ruleId: string;
  childId: string;
  date: string;
  description?: string;
  reportedBy: string; // ID du parent qui a signalé l'infraction
}

// Types pour les contrats
export interface Rule {
  id: string;
  description: string;
  isTask: boolean; // Si true, c'est une tâche qui doit être complétée
}

export interface Contract {
  id: string;
  title: string;
  childId: string;
  parentId: string;
  rules: Rule[];
  dailyReward: number; // Montant en euros
  startDate: string;
  endDate: string;
  active: boolean;
}

// Types pour le portefeuille
export interface WalletTransaction {
  id: string;
  childId: string;
  amount: number; // Positif pour ajout, négatif pour retrait
  date: string;
  reason: string;
  contractId?: string;
}

export interface Wallet {
  childId: string;
  balance: number;
  transactions: WalletTransaction[];
}

// Types pour l'authentification
export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
  family: User[];
}