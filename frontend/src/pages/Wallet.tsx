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
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Chip,
} from '@mui/material';
import { 
  AccountBalance, 
  TrendingUp, 
  TrendingDown, 
  Euro,
  Receipt,
  ExpandMore,
  AdminPanelSettings,
  Refresh,
  DateRange,
} from '@mui/icons-material';
import { format, parseISO, subDays } from 'date-fns';
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
  const [convertComment, setConvertComment] = useState<string>('');
  
  // Admin reprocess states
  const [reprocessStartDate, setReprocessStartDate] = useState<string>('');
  const [reprocessEndDate, setReprocessEndDate] = useState<string>('');
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [reprocessSuccess, setReprocessSuccess] = useState<string | null>(null);

  // Récupérer les enfants de la famille
  const children = authState.family.filter(user => !user.isParent);

  useEffect(() => {
    // Si l'utilisateur est un parent et qu'il y a des enfants, sélectionner le premier enfant par défaut
    if (authState.currentUser?.isParent && children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [authState.currentUser, children, selectedChild]);

  useEffect(() => {
    // Initialize default dates for reprocessing (last 2 days)
    const today = new Date();
    const twoDaysAgo = subDays(today, 2);
    const yesterday = subDays(today, 1);
    
    setReprocessStartDate(format(twoDaysAgo, 'yyyy-MM-dd'));
    setReprocessEndDate(format(yesterday, 'yyyy-MM-dd'));
  }, []);

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
    setConvertComment('');
  };

  const handleCloseConvertDialog = () => {
    setOpenConvertDialog(false);
  };

  const handleConvertAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConvertAmount(parseFloat(e.target.value));
  };

  const handleConvertCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConvertComment(e.target.value);
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
      
      await walletService.convertToRealMoney(childId, convertAmount, convertComment);
      handleCloseConvertDialog();
    } catch (error) {
      console.error('Error converting to real money:', error);
      setConvertError('Une erreur est survenue lors de la conversion');
    }
  };

  const handleReprocessRewards = async () => {
    try {
      setReprocessLoading(true);
      setReprocessError(null);
      setReprocessSuccess(null);

      if (!reprocessStartDate || !reprocessEndDate) {
        setReprocessError('Veuillez sélectionner les dates de début et de fin');
        return;
      }

      if (new Date(reprocessStartDate) > new Date(reprocessEndDate)) {
        setReprocessError('La date de début doit être antérieure à la date de fin');
        return;
      }

      const result = await walletService.reprocessRewards(reprocessStartDate, reprocessEndDate);
      
      if (result.success) {
        setReprocessSuccess(
          `Retraitement terminé avec succès ! ` +
          `${result.summary.total_rewards_processed} récompenses traitées, ` +
          `${result.summary.total_rewards_skipped} ignorées, ` +
          `€${result.summary.total_amount_credited.toFixed(2)} crédités au total.`
        );
      }
    } catch (error: any) {
      console.error('Error reprocessing rewards:', error);
      setReprocessError(
        error.response?.data?.detail || 
        'Une erreur est survenue lors du retraitement des récompenses'
      );
    } finally {
      setReprocessLoading(false);
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
          {authState.currentUser?.isParent ? 'Gestion des Portefeuilles' : 'Mon portefeuille'}
        </Typography>
        {authState.currentUser?.isParent ? (
          <Typography variant="subtitle1">
            Gérez les portefeuilles de vos enfants et retraitez les récompenses
          </Typography>
        ) : (
          <Typography variant="subtitle1">
            Suivez vos gains et vos dépenses
          </Typography>
        )}
      </Box>

      {/* Admin section for parents */}
      {authState.currentUser?.isParent && (
        <Accordion sx={{ mb: 4 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AdminPanelSettings sx={{ mr: 1 }} />
              <Typography variant="h6">Administration - Retraitement des récompenses</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Utilisez cette fonction pour retraiter les récompenses journalières pour une période donnée. 
                Cela peut être utile si des récompenses n'ont pas été correctement calculées.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  label="Date de début"
                  type="date"
                  value={reprocessStartDate}
                  onChange={(e) => setReprocessStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
                <TextField
                  label="Date de fin"
                  type="date"
                  value={reprocessEndDate}
                  onChange={(e) => setReprocessEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
                <Button
                  variant="contained"
                  startIcon={reprocessLoading ? <CircularProgress size={20} /> : <Refresh />}
                  onClick={handleReprocessRewards}
                  disabled={reprocessLoading || !reprocessStartDate || !reprocessEndDate}
                >
                  {reprocessLoading ? 'Traitement...' : 'Retraiter les récompenses'}
                </Button>
              </Box>

              {reprocessError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {reprocessError}
                </Alert>
              )}

              {reprocessSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {reprocessSuccess}
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<DateRange />}
                  label="Derniers 2 jours"
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const today = new Date();
                    const twoDaysAgo = subDays(today, 2);
                    const yesterday = subDays(today, 1);
                    setReprocessStartDate(format(twoDaysAgo, 'yyyy-MM-dd'));
                    setReprocessEndDate(format(yesterday, 'yyyy-MM-dd'));
                  }}
                />
                <Chip
                  icon={<DateRange />}
                  label="Dernière semaine"
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = subDays(today, 7);
                    const yesterday = subDays(today, 1);
                    setReprocessStartDate(format(weekAgo, 'yyyy-MM-dd'));
                    setReprocessEndDate(format(yesterday, 'yyyy-MM-dd'));
                  }}
                />
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Sélecteur d'enfant pour les parents */}
      {authState.currentUser?.isParent && children.length > 0 && (
        <Card sx={{ mb: 4, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ mr: 2 }}>
                Sélectionner l'enfant :
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {children.map(child => (
                <Box
                  key={child.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    p: 2,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: selectedChild === child.id ? 'primary.main' : 'grey.300',
                    bgcolor: selectedChild === child.id ? 'primary.50' : 'background.paper',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.50',
                    }
                  }}
                  onClick={() => handleChildSelect(child.id)}
                >
                  <Avatar
                    src={child.profilePicture}
                    alt={child.name}
                    sx={{ 
                      width: 48, 
                      height: 48, 
                      mb: 1
                    }}
                  />
                  <Typography variant="body2" fontWeight={selectedChild === child.id ? 'bold' : 'normal'}>
                    {child.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
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
              {authState.currentUser?.isParent && (
                <Button 
                  variant="contained" 
                  color="primary"
                  startIcon={<Euro />}
                  onClick={handleOpenConvertDialog}
                  disabled={!selectedChild}
                >
                  Convertir en euros réels
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
            <DialogTitle>Convertir en euros réels</DialogTitle>
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
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                id="comment"
                label="Commentaire (optionnel)"
                type="text"
                fullWidth
                variant="outlined"
                value={convertComment}
                onChange={handleConvertCommentChange}
                placeholder="ex: Achat jouet, argent de poche..."
                helperText="Si laissé vide, utilisera 'Conversion en euros réels'"
              />
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