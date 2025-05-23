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
  isRecurring: boolean;
  weekdays?: number[]; // 1-7 pour lundi-dimanche
  endDate?: string; // Date de fin pour les tâches récurrentes
  parentTaskId?: string; // ID de la tâche parente si c'est une instance d'une tâche récurrente
  canModify?: boolean; // Permission flag for calendar view
}

// Types pour les privilèges
export interface Privilege {
  id: string;
  title: string;
  description?: string;
  assignedTo: string; // ID de l'utilisateur assigné
  earned: boolean;
  date: string;
  canModify?: boolean; // Permission flag for calendar view
  canView?: boolean; // Permission flag for calendar view (children)
}

// Types pour les infractions aux règles
export interface RuleViolation {
  id: string;
  ruleId: string;
  childId: string;
  date: string;
  description?: string;
  reportedBy: string; // ID du parent qui a signalé l'infraction
  canModify?: boolean; // Permission flag for calendar view
  canView?: boolean; // Permission flag for calendar view (children)
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