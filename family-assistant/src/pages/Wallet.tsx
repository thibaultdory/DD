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
  TextField
} from '@mui/material';
import { AccountBalance, TrendingUp, TrendingDown } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, WalletTransaction } from '../types';
import { walletService } from '../services/api';
import Layout from '../components/Layout/Layout';

const WalletPage: React.FC = () => {
  const { authState } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [openConvertDialog, setOpenConvertDialog] = useState(false);
  const [convertAmount, setConvertAmount] = useState<number>(0);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        if (authState.currentUser && !authState.currentUser.isParent) {
          // Récupérer le portefeuille de l'enfant connecté
          const childWallet = await walletService.getChildWallet(authState.currentUser.id);
          setWallet(childWallet);
        } else if (authState.currentUser?.isParent) {
          // Si c'est un parent, on ne fait rien car cette page est pour les enfants
          // Mais on pourrait ajouter une fonctionnalité pour voir les portefeuilles des enfants
        }
      } catch (error) {
        console.error('Error fetching wallet:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, [authState.currentUser]);

  const handleOpenConvertDialog = () => {
    setOpenConvertDialog(true);
    setConvertAmount(0);
  };

  const handleCloseConvertDialog = () => {
    setOpenConvertDialog(false);
  };

  const handleConvertAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConvertAmount(parseFloat(e.target.value));
  };

  const handleConvertToRealMoney = async () => {
    try {
      if (!wallet || !authState.currentUser) return;
      
      if (convertAmount <= 0) {
        alert('Le montant doit être supérieur à 0');
        return;
      }
      
      if (convertAmount > wallet.balance) {
        alert('Le montant ne peut pas dépasser votre solde actuel');
        return;
      }
      
      const updatedWallet = await walletService.convertToRealMoney(
        authState.currentUser.id,
        convertAmount
      );
      
      setWallet(updatedWallet);
      handleCloseConvertDialog();
    } catch (error) {
      console.error('Error converting to real money:', error);
      alert('Une erreur est survenue lors de la conversion');
    }
  };

  if (loading) {
    return <Typography>Chargement...</Typography>;
  }

  if (!wallet && !authState.currentUser?.isParent) {
    return (
      <Layout>
        <Typography variant="h5" align="center" sx={{ mt: 4 }}>
          Aucun portefeuille trouvé
        </Typography>
      </Layout>
    );
  }

  if (authState.currentUser?.isParent) {
    return (
      <Layout>
        <Typography variant="h5" align="center" sx={{ mt: 4 }}>
          Cette page est réservée aux enfants
        </Typography>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Mon portefeuille
        </Typography>
        <Typography variant="subtitle1">
          Suivez vos gains et vos dépenses
        </Typography>
      </Box>

      {wallet && (
        <>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalance fontSize="large" sx={{ mr: 2 }} />
                <Typography variant="h5">
                  Solde actuel
                </Typography>
              </Box>
              <Typography variant="h3" color="primary" sx={{ mb: 2 }}>
                {wallet.balance.toFixed(2)} €
              </Typography>
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleOpenConvertDialog}
              >
                Convertir en argent réel
              </Button>
            </CardContent>
          </Card>

          <Typography variant="h6" gutterBottom>
            Historique des transactions
          </Typography>
          
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
                {wallet.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      Aucune transaction à afficher
                    </TableCell>
                  </TableRow>
                ) : (
                  wallet.transactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(parseISO(transaction.date), 'd MMMM yyyy', { locale: fr })}
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
            <DialogTitle>Convertir en argent réel</DialogTitle>
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
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Cette action demandera à un parent de vous donner l'équivalent en argent réel.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseConvertDialog}>Annuler</Button>
              <Button 
                onClick={handleConvertToRealMoney} 
                variant="contained"
                disabled={convertAmount <= 0 || convertAmount > wallet.balance}
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