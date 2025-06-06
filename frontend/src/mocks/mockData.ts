import { User, Task, Privilege, RuleViolation, Contract, Rule, Wallet, WalletTransaction } from '../types';
import { addDays, format, subDays, subMonths, subYears } from 'date-fns';

// Date actuelle pour les données mock
const today = new Date();
const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

// Utilisateurs mock
export const mockUsers: User[] = [
  {
    id: 'parent1',
    name: 'Papa',
    birthDate: formatDate(subYears(today, 40)),
    isParent: true,
    profilePicture: 'https://i.pravatar.cc/150?img=11'
  },
  {
    id: 'parent2',
    name: 'Maman',
    birthDate: formatDate(subYears(today, 38)),
    isParent: true,
    profilePicture: 'https://i.pravatar.cc/150?img=5'
  },
  {
    id: 'child1',
    name: 'Eléa',
    birthDate: formatDate(subYears(today, 8)),
    isParent: false,
    profilePicture: 'https://i.pravatar.cc/150?img=33'
  },
  {
    id: 'child2',
    name: 'Lucas',
    birthDate: formatDate(subYears(today, 6)),
    isParent: false,
    profilePicture: 'https://i.pravatar.cc/150?img=59'
  }
];

// Règles centralisées
export const mockRules: Rule[] = [
  {
    id: 'rule1',
    description: 'Pas péter près des autres',
    isTask: false,
    active: true
  },
  {
    id: 'rule2',
    description: 'Pas de doigt dans le nez ni la bouche',
    isTask: false,
    active: true
  },
  {
    id: 'rule3',
    description: 'Pas de crise',
    isTask: false,
    active: true
  },
  {
    id: 'rule4',
    description: 'Pas roter',
    isTask: false,
    active: true
  },
  {
    id: 'rule5',
    description: 'Pas sortir de son lit le soir',
    isTask: false,
    active: true
  },
  {
    id: 'rule6',
    description: 'Faire toutes les tâches du tableau',
    isTask: true,
    active: true
  },
  {
    id: 'rule7',
    description: 'Pas de violence',
    isTask: false,
    active: true
  }
];

// Tâches mock - synchronisées avec le calendrier
export const mockTasks: Task[] = [
  {
    id: 'task1',
    title: 'Faire ses devoirs',
    description: 'Terminer les exercices de mathématiques',
    assignedTo: ['child1'],
    dueDate: formatDate(today),
    completed: false,
    createdBy: 'parent1',
    createdAt: formatDate(subDays(today, 1)),
    isRecurring: false
  },
  {
    id: 'task2',
    title: 'Vider le lave-vaisselle',
    assignedTo: ['child1'],
    dueDate: formatDate(today),
    completed: true,
    createdBy: 'parent2',
    createdAt: formatDate(subDays(today, 1)),
    isRecurring: true,
    weekdays: [1, 3, 5] // Lundi, Mercredi, Vendredi
  },
  {
    id: 'task3',
    title: 'Mettre la table',
    assignedTo: ['child2'],
    dueDate: formatDate(today),
    completed: false,
    createdBy: 'parent1',
    createdAt: formatDate(subDays(today, 1)),
    isRecurring: true,
    weekdays: [1, 2, 3, 4, 5] // Du lundi au vendredi
  },
  {
    id: 'task4',
    title: 'Ranger sa chambre',
    assignedTo: ['child1', 'child2'],
    dueDate: formatDate(addDays(today, 1)),
    completed: false,
    createdBy: 'parent2',
    createdAt: formatDate(today),
    isRecurring: true,
    weekdays: [6] // Samedi
  }
];

// Privilèges mock - avec indication claire de l'enfant assigné
export const mockPrivileges: Privilege[] = [
  {
    id: 'priv1',
    title: 'Dessert',
    description: 'A droit au dessert ce soir',
    assignedTo: 'child1', // Eléa
    earned: true,
    date: formatDate(today)
  },
  {
    id: 'priv2',
    title: 'Temps d\'écran supplémentaire',
    description: '30 minutes supplémentaires',
    assignedTo: 'child2', // Lucas
    earned: false,
    date: formatDate(today)
  }
];

// Infractions aux règles mock - avec référence aux règles centralisées
export const mockRuleViolations: RuleViolation[] = [
  {
    id: 'violation1',
    ruleId: 'rule2', // Pas de doigt dans le nez ni la bouche
    childId: 'child1', // Eléa
    date: formatDate(subDays(today, 2)),
    description: 'Doigt dans le nez pendant le repas',
    reportedBy: 'parent1'
  },
  {
    id: 'violation2',
    ruleId: 'rule5', // Pas sortir de son lit le soir
    childId: 'child2', // Lucas
    date: formatDate(subDays(today, 1)),
    description: 'Est sorti du lit à 22h30',
    reportedBy: 'parent2'
  }
];

// Contrats mock - utilisant les règles centralisées
export const mockContracts: Contract[] = [
  {
    id: 'contract1',
    title: 'Contrat entre Eléa et papa',
    childId: 'child1',
    parentId: 'parent1',
    rules: mockRules, // Toutes les règles pour Eléa
    dailyReward: 1,
    startDate: formatDate(subMonths(today, 1)),
    endDate: '2025-07-01',
    active: true
  },
  {
    id: 'contract2',
    title: 'Contrat entre Lucas et maman',
    childId: 'child2',
    parentId: 'parent2',
    rules: mockRules.slice(0, 5), // Seulement les 5 premières règles pour Lucas
    dailyReward: 0.5,
    startDate: formatDate(subMonths(today, 2)),
    endDate: '2025-06-01',
    active: true
  }
];

// Transactions du portefeuille mock
export const mockWalletTransactions: WalletTransaction[] = [
  {
    id: 'trans1',
    childId: 'child1',
    amount: 1,
    date: formatDate(subDays(today, 5)),
    reason: 'Récompense journalière',
    contractId: 'contract1'
  },
  {
    id: 'trans2',
    childId: 'child1',
    amount: 1,
    date: formatDate(subDays(today, 4)),
    reason: 'Récompense journalière',
    contractId: 'contract1'
  },
  {
    id: 'trans3',
    childId: 'child1',
    amount: -2,
    date: formatDate(subDays(today, 3)),
    reason: 'Conversion en argent réel',
  },
  {
    id: 'trans4',
    childId: 'child2',
    amount: 0.5,
    date: formatDate(subDays(today, 2)),
    reason: 'Récompense journalière',
    contractId: 'contract2'
  }
];

// Portefeuilles mock
export const mockWallets: Wallet[] = [
  {
    childId: 'child1',
    balance: 2,
    transactions: mockWalletTransactions.filter(t => t.childId === 'child1')
  },
  {
    childId: 'child2',
    balance: 0.5,
    transactions: mockWalletTransactions.filter(t => t.childId === 'child2')
  }
];

// Fonction utilitaire pour trouver un utilisateur par ID
export const findUserById = (userId: string): User | undefined => {
  return mockUsers.find(user => user.id === userId);
};

// Fonction utilitaire pour trouver une règle par ID
export const findRuleById = (ruleId: string): Rule | undefined => {
  return mockRules.find(rule => rule.id === ruleId);
};