import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar,
  Tooltip,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import { 
  AccountBalance, 
  TrendingUp, 
  TrendingDown, 
  Euro,
  Receipt
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, WalletTransaction } from '../types';
import { walletService } from '../services/api';
import Layout from '../components/Layout/Layout';

const WalletPage: React.FC = () => {
  const { authState } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [openConvertDialog, setOpenConvertDialog] = useState(false);
  const [convertAmount, setConvertAmount] = useState<number>(0);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Récupérer les enfants de la famille
  const children = authState.family.filter(user => !user.isParent);

  useEffect(() => {
    // Si l'utilisateur est un parent et qu'il y a des enfants, sélectionner le premier enfant par défaut
    if (authState.currentUser?.isParent && children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [authState.currentUser, children, selectedChild]);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Déterminer l'ID de l'enfant dont on veut voir le portefeuille
        const childId = authState.currentUser?.isParent 
          ? selectedChild 
          : authState.currentUser?.id;

        if (childId) {
          const fetchedWallet = await walletService.getChildWallet(childId);
          const fetchedTransactions = await walletService.getWalletTransactions(childId);
          
          setWallet(fetchedWallet);
          setTransactions(fetchedTransactions);
        }
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        setError('Erreur lors de la récupération des données du portefeuille');
      } finally {
        setLoading(false);
      }
    };

    if (authState.currentUser && (selectedChild || !authState.currentUser.isParent)) {
      fetchWalletData();
    }

    // S'abonner aux changements du portefeuille
    const unsubscribe = walletService.subscribe(() => {
      if (authState.currentUser) {
        const childId = authState.currentUser.isParent 
          ? selectedChild 
          : authState.currentUser.id;
        
        if (childId) {
          walletService.getChildWallet(childId).then(setWallet);
          walletService.getWalletTransactions(childId).then(setTransactions);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [authState.currentUser, selectedChild]);

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
  };

  const handleOpenConvertDialog = () => {
    setOpenConvertDialog(true);
    setConvertAmount(0);
    setConvertError(null);
  };

  const handleCloseConvertDialog = () => {
    setOpenConvertDialog(false);
  };

  const handleConvertAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConvertAmount(parseFloat(e.target.value));
  };

  const handleConvertToRealMoney = async () => {
    try {
      if (!selectedChild && !authState.currentUser) return;
      
      const childId = selectedChild || (authState.currentUser?.id || '');
      
      if (convertAmount <= 0) {
        setConvertError('Le montant doit être supérieur à 0');
        return;
      }
      
      if (wallet && convertAmount > wallet.balance) {
        setConvertError('Le montant ne peut pas dépasser le solde disponible');
        return;
      }
      
      await walletService.convertToRealMoney(childId, convertAmount);
      handleCloseConvertDialog();
    } catch (error) {
      console.error('Error converting to real money:', error);
      setConvertError('Une erreur est survenue lors de la conversion');
    }
  };

  // Fonction pour obtenir le nom de l'utilisateur à partir de son ID
  const getUserName = (userId: string): string => {
    const user = authState.family.find(u => u.id === userId);
    return user ? user.name : 'Inconnu';
  };

  // Fonction pour formater la date
  const formatDate = (dateString: string): string => {
    try {
      return format(parseISO(dateString), 'dd MMMM yyyy', { locale: fr });
    } catch (error) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Layout>
        <Typography>Chargement...</Typography>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Alert severity="error">{error}</Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {authState.currentUser?.isParent ? 'Portefeuille' : 'Mon portefeuille'}
        </Typography>
        {!authState.currentUser?.isParent && (
          <Typography variant="subtitle1">
            Suivez vos gains et vos dépenses
          </Typography>
        )}
      </Box>

      {/* Sélecteur d'enfant pour les parents */}
      {authState.currentUser?.isParent && children.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ mr: 2 }}>
            Afficher le portefeuille de :
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {children.map(child => (
              <Tooltip key={child.id} title={child.name}>
                <Avatar
                  src={child.profilePicture}
                  alt={child.name}
                  sx={{ 
                    width: 40, 
                    height: 40, 
                    cursor: 'pointer',
                    border: selectedChild === child.id ? '2px solid #1976d2' : 'none',
                    opacity: selectedChild === child.id ? 1 : 0.6
                  }}
                  onClick={() => handleChildSelect(child.id)}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {wallet && (
        <>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalance fontSize="large" sx={{ mr: 2 }} />
                <Typography variant="h5">
                  Solde actuel {authState.currentUser?.isParent && selectedChild && `de ${getUserName(selectedChild)}`}
                </Typography>
              </Box>
              <Typography variant="h3" color="primary" sx={{ mb: 2 }}>
                {wallet.balance.toFixed(2)} €
              </Typography>
              {authState.currentUser?.isParent ? (
                <Button 
                  variant="contained" 
                  color="primary"
                  startIcon={<Euro />}
                  onClick={handleOpenConvertDialog}
                  disabled={!selectedChild}
                >
                  Convertir en euros réels
                </Button>
              ) : (
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleOpenConvertDialog}
                >
                  Convertir en argent réel
                </Button>
              )}
            </CardContent>
          </Card>

          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Receipt sx={{ mr: 1 }} />
            <Typography variant="h6">
              Historique des transactions
            </Typography>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Montant</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      Aucune transaction à afficher
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDate(transaction.date)}
                        </TableCell>
                        <TableCell>{transaction.reason}</TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            color: transaction.amount >= 0 ? 'success.main' : 'error.main',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end'
                          }}
                        >
                          {transaction.amount >= 0 ? (
                            <TrendingUp fontSize="small" sx={{ mr: 1 }} />
                          ) : (
                            <TrendingDown fontSize="small" sx={{ mr: 1 }} />
                          )}
                          {transaction.amount.toFixed(2)} €
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Dialogue de conversion en argent réel */}
          <Dialog open={openConvertDialog} onClose={handleCloseConvertDialog}>
            <DialogTitle>Convertir en {authState.currentUser?.isParent ? 'euros réels' : 'argent réel'}</DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                Solde actuel: {wallet.balance.toFixed(2)} €
              </Typography>
              <TextField
                autoFocus
                margin="dense"
                id="amount"
                label="Montant à convertir (€)"
                type="number"
                fullWidth
                variant="outlined"
                value={convertAmount || ''}
                onChange={handleConvertAmountChange}
                inputProps={{ min: 0, max: wallet.balance, step: 0.1 }}
                error={!!convertError}
                helperText={convertError}
              />
              {!authState.currentUser?.isParent && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Cette action demandera à un parent de vous donner l'équivalent en argent réel.
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseConvertDialog}>Annuler</Button>
              <Button 
                onClick={handleConvertToRealMoney} 
                variant="contained"
                color="primary"
                disabled={!convertAmount || convertAmount <= 0 || (wallet ? convertAmount > wallet.balance : false)}
              >
                Convertir
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Layout>
  );
};

export default WalletPage;