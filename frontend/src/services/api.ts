import axios from 'axios';
import { 
  User, 
  Task, 
  Privilege, 
  RuleViolation, 
  Contract, 
  Wallet, 
  WalletTransaction,
  Rule
} from '../types';
import { 
  mockUsers, 
  mockTasks, 
  mockPrivileges, 
  mockRuleViolations, 
  mockContracts, 
  mockWallets,
  mockWalletTransactions,
  mockRules,
  findUserById,
  findRuleById
} from '../mocks/mockData';

// Configuration pour basculer entre les données mock et l'API réelle
const USE_MOCK_DATA = false;
const API_BASE_URL = 'http://localhost:59430/api';

// Créer une instance axios pour l'API réelle
const api = axios.create({
  withCredentials: true,
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Événements pour notifier les changements de données
type DataChangeListener = () => void;
const listeners: { [key: string]: DataChangeListener[] } = {
  tasks: [],
  privileges: [],
  violations: [],
  contracts: [],
  wallets: []
};

// Fonction pour notifier les changements
const notifyChange = (dataType: string) => {
  if (listeners[dataType]) {
    listeners[dataType].forEach(listener => listener());
  }
};

// Service d'authentification
export const authService = {
  // Connexion avec Google OAuth
  async loginWithGoogle(): Promise<User | null> {
    if (USE_MOCK_DATA) {
      // Simuler une connexion réussie avec le premier parent
      return mockUsers[0];
    }
    
    const response = await api.get('/auth/google');
    return response.data;
  },

  // Récupérer l'utilisateur actuel
  async getCurrentUser(): Promise<User | null> {
    if (USE_MOCK_DATA) {
      return mockUsers[0];
    }
    
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Récupérer tous les membres de la famille
  async getFamilyMembers(): Promise<User[]> {
    if (USE_MOCK_DATA) {
      return mockUsers;
    }
    
    const response = await api.get('/users/family');
    return response.data;
  },

  // Déconnexion
  async logout(): Promise<void> {
    if (USE_MOCK_DATA) {
      return;
    }
    
    await api.post('/auth/logout');
  }
};

// Service de gestion des règles
export const ruleService = {
  // Récupérer toutes les règles
  async getRules(): Promise<Rule[]> {
    if (USE_MOCK_DATA) {
      return mockRules;
    }
    
    const response = await api.get('/rules');
    return response.data;
  },

  // Récupérer une règle par ID
  async getRule(ruleId: string): Promise<Rule | null> {
    if (USE_MOCK_DATA) {
      const rule = findRuleById(ruleId);
      return rule || null;
    }
    
    const response = await api.get(`/rules/${ruleId}`);
    return response.data;
  }
};

// Service de gestion des tâches
export const taskService = {
  // S'abonner aux changements de tâches
  subscribe(listener: DataChangeListener) {
    listeners.tasks.push(listener);
    return () => {
      const index = listeners.tasks.indexOf(listener);
      if (index !== -1) {
        listeners.tasks.splice(index, 1);
      }
    };
  },

  // Récupérer toutes les tâches
  async getTasks(): Promise<Task[]> {
    if (USE_MOCK_DATA) {
      return [...mockTasks]; // Retourne une copie pour éviter les modifications directes
    }
    
    const response = await api.get('/tasks');
    return response.data;
  },

  // Récupérer les tâches d'un utilisateur spécifique
  async getUserTasks(userId: string): Promise<Task[]> {
    if (USE_MOCK_DATA) {
      return mockTasks.filter(task => task.assignedTo.includes(userId));
    }
    
    const response = await api.get(`/tasks/user/${userId}`);
    return response.data;
  },

  // Récupérer les tâches pour une date spécifique
  async getTasksForDate(date: string): Promise<Task[]> {
    if (USE_MOCK_DATA) {
      return mockTasks.filter(task => task.dueDate === date);
    }
    
    const response = await api.get(`/tasks/date/${date}`);
    return response.data;
  },

  // Créer une nouvelle tâche (parents uniquement)
  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    if (USE_MOCK_DATA) {
      const newTask: Task = {
        ...task,
        id: `task${mockTasks.length + 1}`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      mockTasks.push(newTask);
      notifyChange('tasks');
      return newTask;
    }
    
    const response = await api.post('/tasks', task);
    return response.data;
  },

  // Mettre à jour une tâche
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    if (USE_MOCK_DATA) {
      const index = mockTasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        mockTasks[index] = { ...mockTasks[index], ...updates };
        notifyChange('tasks');
        return mockTasks[index];
      }
      throw new Error('Task not found');
    }
    
    const response = await api.put(`/tasks/${taskId}`, updates);
    return response.data;
  },

  // Marquer une tâche comme terminée
  async completeTask(taskId: string): Promise<Task> {
    if (USE_MOCK_DATA) {
      const index = mockTasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        mockTasks[index].completed = true;
        notifyChange('tasks');
        return mockTasks[index];
      }
      throw new Error('Task not found');
    }
    
    const response = await api.put(`/tasks/${taskId}/complete`);
    return response.data;
  },

  // Supprimer une tâche (parents uniquement)
  async deleteTask(taskId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const index = mockTasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        mockTasks.splice(index, 1);
        notifyChange('tasks');
        return;
      }
      throw new Error('Task not found');
    }
    
    await api.delete(`/tasks/${taskId}`);
  }
};

// Service de gestion des privilèges
export const privilegeService = {
  // S'abonner aux changements de privilèges
  subscribe(listener: DataChangeListener) {
    listeners.privileges.push(listener);
    return () => {
      const index = listeners.privileges.indexOf(listener);
      if (index !== -1) {
        listeners.privileges.splice(index, 1);
      }
    };
  },

  // Récupérer tous les privilèges
  async getPrivileges(): Promise<Privilege[]> {
    if (USE_MOCK_DATA) {
      return [...mockPrivileges]; // Retourne une copie pour éviter les modifications directes
    }
    
    const response = await api.get('/privileges');
    return response.data;
  },

  // Récupérer les privilèges d'un utilisateur spécifique
  async getUserPrivileges(userId: string): Promise<Privilege[]> {
    if (USE_MOCK_DATA) {
      return mockPrivileges.filter(priv => priv.assignedTo === userId);
    }
    
    const response = await api.get(`/privileges/user/${userId}`);
    return response.data;
  },

  // Récupérer les privilèges pour une date spécifique
  async getPrivilegesForDate(date: string): Promise<Privilege[]> {
    if (USE_MOCK_DATA) {
      return mockPrivileges.filter(priv => priv.date === date);
    }
    
    const response = await api.get(`/privileges/date/${date}`);
    return response.data;
  },

  // Créer un nouveau privilège (parents uniquement)
  async createPrivilege(privilege: Omit<Privilege, 'id'>): Promise<Privilege> {
    if (USE_MOCK_DATA) {
      const newPrivilege: Privilege = {
        ...privilege,
        id: `priv${mockPrivileges.length + 1}`
      };
      mockPrivileges.push(newPrivilege);
      notifyChange('privileges');
      return newPrivilege;
    }
    
    const response = await api.post('/privileges', privilege);
    return response.data;
  },

  // Mettre à jour un privilège (parents uniquement)
  async updatePrivilege(privilegeId: string, updates: Partial<Privilege>): Promise<Privilege> {
    if (USE_MOCK_DATA) {
      const index = mockPrivileges.findIndex(p => p.id === privilegeId);
      if (index !== -1) {
        mockPrivileges[index] = { ...mockPrivileges[index], ...updates };
        notifyChange('privileges');
        return mockPrivileges[index];
      }
      throw new Error('Privilege not found');
    }
    
    const response = await api.put(`/privileges/${privilegeId}`, updates);
    return response.data;
  },

  // Supprimer un privilège (parents uniquement)
  async deletePrivilege(privilegeId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const index = mockPrivileges.findIndex(p => p.id === privilegeId);
      if (index !== -1) {
        mockPrivileges.splice(index, 1);
        notifyChange('privileges');
        return;
      }
      throw new Error('Privilege not found');
    }
    
    await api.delete(`/privileges/${privilegeId}`);
  }
};

// Service de gestion des infractions aux règles
export const ruleViolationService = {
  // S'abonner aux changements d'infractions
  subscribe(listener: DataChangeListener) {
    listeners.violations.push(listener);
    return () => {
      const index = listeners.violations.indexOf(listener);
      if (index !== -1) {
        listeners.violations.splice(index, 1);
      }
    };
  },

  // Récupérer toutes les infractions
  async getRuleViolations(): Promise<RuleViolation[]> {
    if (USE_MOCK_DATA) {
      return [...mockRuleViolations]; // Retourne une copie pour éviter les modifications directes
    }
    
    const response = await api.get('/rule-violations');
    return response.data;
  },

  // Récupérer les infractions d'un enfant spécifique
  async getChildRuleViolations(childId: string): Promise<RuleViolation[]> {
    if (USE_MOCK_DATA) {
      return mockRuleViolations.filter(violation => violation.childId === childId);
    }
    
    const response = await api.get(`/rule-violations/child/${childId}`);
    return response.data;
  },

  // Récupérer les infractions pour une date spécifique
  async getRuleViolationsForDate(date: string): Promise<RuleViolation[]> {
    if (USE_MOCK_DATA) {
      return mockRuleViolations.filter(violation => violation.date === date);
    }
    
    const response = await api.get(`/rule-violations/date/${date}`);
    return response.data;
  },

  // Créer une nouvelle infraction (parents uniquement)
  async createRuleViolation(violation: Omit<RuleViolation, 'id'>): Promise<RuleViolation> {
    if (USE_MOCK_DATA) {
      const newViolation: RuleViolation = {
        ...violation,
        id: `violation${mockRuleViolations.length + 1}`
      };
      mockRuleViolations.push(newViolation);
      notifyChange('violations');
      return newViolation;
    }
    
    const response = await api.post('/rule-violations', violation);
    return response.data;
  },

  // Supprimer une infraction (parents uniquement)
  async deleteRuleViolation(violationId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const index = mockRuleViolations.findIndex(v => v.id === violationId);
      if (index !== -1) {
        mockRuleViolations.splice(index, 1);
        notifyChange('violations');
        return;
      }
      throw new Error('Rule violation not found');
    }
    
    await api.delete(`/rule-violations/${violationId}`);
  }
};

// Service de gestion des contrats
export const contractService = {
  // S'abonner aux changements de contrats
  subscribe(listener: DataChangeListener) {
    listeners.contracts.push(listener);
    return () => {
      const index = listeners.contracts.indexOf(listener);
      if (index !== -1) {
        listeners.contracts.splice(index, 1);
      }
    };
  },

  // Récupérer tous les contrats
  async getContracts(): Promise<Contract[]> {
    if (USE_MOCK_DATA) {
      return [...mockContracts]; // Retourne une copie pour éviter les modifications directes
    }
    
    const response = await api.get('/contracts');
    return response.data;
  },

  // Récupérer un contrat spécifique
  async getContract(contractId: string): Promise<Contract> {
    if (USE_MOCK_DATA) {
      const contract = mockContracts.find(c => c.id === contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }
      return { ...contract }; // Retourne une copie pour éviter les modifications directes
    }
    
    const response = await api.get(`/contracts/${contractId}`);
    return response.data;
  },

  // Récupérer les contrats d'un enfant spécifique
  async getChildContracts(childId: string): Promise<Contract[]> {
    if (USE_MOCK_DATA) {
      return mockContracts.filter(contract => contract.childId === childId);
    }
    
    const response = await api.get(`/contracts/child/${childId}`);
    return response.data;
  },

  // Créer un nouveau contrat (parents uniquement)
  async createContract(contract: Omit<Contract, 'id'>): Promise<Contract> {
    if (USE_MOCK_DATA) {
      const newContract: Contract = {
        ...contract,
        id: `contract${mockContracts.length + 1}`
      };
      mockContracts.push(newContract);
      notifyChange('contracts');
      return newContract;
    }
    
    const response = await api.post('/contracts', contract);
    return response.data;
  },

  // Mettre à jour un contrat (parents uniquement)
  async updateContract(contractId: string, updates: Partial<Contract>): Promise<Contract> {
    if (USE_MOCK_DATA) {
      const index = mockContracts.findIndex(c => c.id === contractId);
      if (index !== -1) {
        mockContracts[index] = { ...mockContracts[index], ...updates };
        notifyChange('contracts');
        return mockContracts[index];
      }
      throw new Error('Contract not found');
    }
    
    const response = await api.put(`/contracts/${contractId}`, updates);
    return response.data;
  },

  // Désactiver un contrat (parents uniquement)
  async deactivateContract(contractId: string): Promise<Contract> {
    if (USE_MOCK_DATA) {
      const index = mockContracts.findIndex(c => c.id === contractId);
      if (index !== -1) {
        mockContracts[index].active = false;
        notifyChange('contracts');
        return mockContracts[index];
      }
      throw new Error('Contract not found');
    }
    
    const response = await api.put(`/contracts/${contractId}/deactivate`);
    return response.data;
  }
};

// Service de gestion des portefeuilles
export const walletService = {
  // S'abonner aux changements de portefeuilles
  subscribe(listener: DataChangeListener) {
    listeners.wallets.push(listener);
    return () => {
      const index = listeners.wallets.indexOf(listener);
      if (index !== -1) {
        listeners.wallets.splice(index, 1);
      }
    };
  },

  // Récupérer le portefeuille d'un enfant
  async getChildWallet(childId: string): Promise<Wallet> {
    if (USE_MOCK_DATA) {
      const wallet = mockWallets.find(w => w.childId === childId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      return { ...wallet, transactions: [...wallet.transactions] }; // Retourne une copie pour éviter les modifications directes
    }
    
    const response = await api.get(`/wallets/${childId}`);
    return response.data;
  },

  // Récupérer les transactions d'un portefeuille
  async getWalletTransactions(childId: string): Promise<WalletTransaction[]> {
    if (USE_MOCK_DATA) {
      return mockWalletTransactions.filter(t => t.childId === childId);
    }
    
    const response = await api.get(`/wallets/${childId}/transactions`);
    return response.data;
  },

  // Convertir des euros virtuels en euros réels (parents uniquement)
  async convertToRealMoney(childId: string, amount: number): Promise<Wallet> {
    if (USE_MOCK_DATA) {
      const walletIndex = mockWallets.findIndex(w => w.childId === childId);
      if (walletIndex === -1) {
        throw new Error('Wallet not found');
      }
      
      const wallet = mockWallets[walletIndex];
      if (wallet.balance < amount) {
        throw new Error('Insufficient balance');
      }
      
      // Créer une nouvelle transaction
      const newTransaction: WalletTransaction = {
        id: `trans${mockWalletTransactions.length + 1}`,
        childId,
        amount: -amount,
        date: new Date().toISOString().split('T')[0],
        reason: 'Conversion en argent réel'
      };
      
      mockWalletTransactions.push(newTransaction);
      
      // Mettre à jour le solde
      wallet.balance -= amount;
      wallet.transactions.push(newTransaction);
      
      notifyChange('wallets');
      return { ...wallet, transactions: [...wallet.transactions] };
    }
    
    const response = await api.post(`/wallets/${childId}/convert`, { amount });
    return response.data;
  }
};