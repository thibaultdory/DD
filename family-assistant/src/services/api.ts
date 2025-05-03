import axios from 'axios';
import { 
  User, 
  Task, 
  Privilege, 
  RuleViolation, 
  Contract, 
  Wallet, 
  WalletTransaction 
} from '../types';
import { 
  mockUsers, 
  mockTasks, 
  mockPrivileges, 
  mockRuleViolations, 
  mockContracts, 
  mockWallets,
  mockWalletTransactions
} from '../mocks/mockData';

// Configuration pour basculer entre les données mock et l'API réelle
const USE_MOCK_DATA = true;
const API_BASE_URL = 'http://localhost:3000/api';

// Créer une instance axios pour l'API réelle
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Service de gestion des tâches
export const taskService = {
  // Récupérer toutes les tâches
  async getTasks(): Promise<Task[]> {
    if (USE_MOCK_DATA) {
      return mockTasks;
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

  // Créer une nouvelle tâche (parents uniquement)
  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    if (USE_MOCK_DATA) {
      const newTask: Task = {
        ...task,
        id: `task${mockTasks.length + 1}`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      mockTasks.push(newTask);
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
        return;
      }
      throw new Error('Task not found');
    }
    
    await api.delete(`/tasks/${taskId}`);
  }
};

// Service de gestion des privilèges
export const privilegeService = {
  // Récupérer tous les privilèges
  async getPrivileges(): Promise<Privilege[]> {
    if (USE_MOCK_DATA) {
      return mockPrivileges;
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

  // Créer un nouveau privilège (parents uniquement)
  async createPrivilege(privilege: Omit<Privilege, 'id'>): Promise<Privilege> {
    if (USE_MOCK_DATA) {
      const newPrivilege: Privilege = {
        ...privilege,
        id: `priv${mockPrivileges.length + 1}`
      };
      mockPrivileges.push(newPrivilege);
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
        return;
      }
      throw new Error('Privilege not found');
    }
    
    await api.delete(`/privileges/${privilegeId}`);
  }
};

// Service de gestion des infractions aux règles
export const ruleViolationService = {
  // Récupérer toutes les infractions
  async getRuleViolations(): Promise<RuleViolation[]> {
    if (USE_MOCK_DATA) {
      return mockRuleViolations;
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

  // Créer une nouvelle infraction (parents uniquement)
  async createRuleViolation(violation: Omit<RuleViolation, 'id'>): Promise<RuleViolation> {
    if (USE_MOCK_DATA) {
      const newViolation: RuleViolation = {
        ...violation,
        id: `violation${mockRuleViolations.length + 1}`
      };
      mockRuleViolations.push(newViolation);
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
        return;
      }
      throw new Error('Rule violation not found');
    }
    
    await api.delete(`/rule-violations/${violationId}`);
  }
};

// Service de gestion des contrats
export const contractService = {
  // Récupérer tous les contrats
  async getContracts(): Promise<Contract[]> {
    if (USE_MOCK_DATA) {
      return mockContracts;
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
      return contract;
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
  // Récupérer le portefeuille d'un enfant
  async getChildWallet(childId: string): Promise<Wallet> {
    if (USE_MOCK_DATA) {
      const wallet = mockWallets.find(w => w.childId === childId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      return wallet;
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
      
      return wallet;
    }
    
    const response = await api.post(`/wallets/${childId}/convert`, { amount });
    return response.data;
  }
};