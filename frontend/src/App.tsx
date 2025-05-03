import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import Contracts from './pages/Contracts';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import TaskForm from './pages/TaskForm';
import PrivilegeForm from './pages/PrivilegeForm';
import ViolationForm from './pages/ViolationForm';

// Theme de l'application
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Page de connexion */}
              <Route path="/login" element={<Login />} />
              
              {/* Routes protegees (necessitent une authentification) */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/calendar" 
                element={
                  <ProtectedRoute>
                    <Calendar />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/contracts" 
                element={
                  <ProtectedRoute requireParent>
                    <Contracts />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/wallet" 
                element={
                  <ProtectedRoute>
                    <Wallet />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />

              {/* Formulaires */}
              <Route 
                path="/tasks/new" 
                element={
                  <ProtectedRoute requireParent>
                    <TaskForm />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/tasks/edit/:taskId" 
                element={
                  <ProtectedRoute requireParent>
                    <TaskForm />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/privileges/new" 
                element={
                  <ProtectedRoute requireParent>
                    <PrivilegeForm />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/privileges/edit/:privilegeId" 
                element={
                  <ProtectedRoute requireParent>
                    <PrivilegeForm />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/violations/new" 
                element={
                  <ProtectedRoute requireParent>
                    <ViolationForm />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/violations/edit/:violationId" 
                element={
                  <ProtectedRoute requireParent>
                    <ViolationForm />
                  </ProtectedRoute>
                } 
              />
              
              {/* Redirection par defaut */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default App;
