import React, { useEffect, useState } from 'react';
import { analyticsService } from '../services/api';
import { AnalyticsResponse } from '../types';
import { Container, Typography, Card, CardContent, CircularProgress, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';

interface StatCardProps {
  title: string;
  current: number;
  previous: number;
  format?: (n: number) => string;
}

const StatCard: React.FC<StatCardProps> = ({ title, current, previous, format = (num: number) => num.toString() }) => {
  const diff = current - previous;
  const DiffIcon = diff > 0 ? ArrowUpwardIcon : diff < 0 ? ArrowDownwardIcon : RemoveIcon;
  const diffColor = diff > 0 ? 'success.main' : diff < 0 ? 'error.main' : 'text.primary';

  return (
    <Card elevation={3} sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Typography variant="h4" component="p">{format(current)}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <DiffIcon sx={{ color: diffColor, mr: 0.5 }} fontSize="small" />
          <Typography variant="body2" sx={{ color: diffColor }}>
            {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${format(Math.abs(diff))}`} vs mois précédent
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

const Analytics: React.FC = () => {
  const { authState } = useAuth();
  const children = authState.family.filter(u => !u.isParent);

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // selection states
  const [selectedChild, setSelectedChild] = useState<string>(
    authState.currentUser?.isParent ? (children[0]?.id || '') : authState.currentUser?.id || ''
  );
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const fetchData = async (childId: string, monthDate: Date) => {
    setLoading(true);
    try {
      const monthParam = format(monthDate, 'yyyy-MM');
      const res = await analyticsService.getMonthlyAnalytics(monthParam, childId);
      setData(res);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les statistiques');
    } finally {
      setLoading(false);
    }
  };

  // initial fetch
  useEffect(() => {
    if (selectedChild) fetchData(selectedChild, selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to format percentage
  const pct = (n: number) => `${n.toFixed(0)}%`;

  return (
    <Layout>
      <Container maxWidth="lg">
        <Typography variant="h4" gutterBottom>Analytics Mensuelles</Typography>

        {/* Filters */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          {authState.currentUser?.isParent && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="child-select-label">Enfant</InputLabel>
              <Select
                labelId="child-select-label"
                value={selectedChild}
                label="Enfant"
                onChange={(e) => {
                  setSelectedChild(e.target.value);
                  fetchData(e.target.value, selectedMonth);
                }}
              >
                {children.map(child => (
                  <MenuItem key={child.id} value={child.id}>{child.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Month picker */}
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              views={["month", "year"]}
              openTo="month"
              label="Mois"
              value={selectedMonth}
              onChange={(newVal) => {
                if (newVal) {
                  setSelectedMonth(newVal);
                  fetchData(selectedChild, newVal);
                }
              }}
              slotProps={{ textField: { size: 'small' } }}
            />
          </LocalizationProvider>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
        )}

        {error && (
          <Typography color="error" sx={{ mt: 4 }}>{error}</Typography>
        )}

        {data && !loading && (
          <Box 
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 3,
            }}
          >
            <StatCard title="Jours parfaits" current={data!.perfectDays.current} previous={data!.perfectDays.previous} />
            <StatCard title="Plus longue série" current={data!.longestStreak.current} previous={data!.longestStreak.previous} />
            <StatCard title="Taux de tâches accomplies" current={data!.taskCompletionRate.current} previous={data!.taskCompletionRate.previous} format={pct} />
            <StatCard title="Infractions" current={data!.infractions.current} previous={data!.infractions.previous} />
            <StatCard title="Privilèges mérités" current={data!.privilegesEarned.current} previous={data!.privilegesEarned.previous} />
            <StatCard title="Récompenses (€)" current={data!.rewardsEarned.current} previous={data!.rewardsEarned.previous} format={(val: number) => val.toFixed(2)} />
          </Box>
        )}
      </Container>
    </Layout>
  );
};

export default Analytics; 