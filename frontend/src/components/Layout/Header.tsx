import React from 'react';
import { AppBar, Toolbar, Typography, Button, Avatar, Box, IconButton, Menu, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AccountCircle, ExitToApp } from '@mui/icons-material';

const Header: React.FC = () => {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleClose();
    navigate('/login');
  };

  const handleProfile = () => {
    handleClose();
    navigate('/profile');
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Assistant de Vie Familiale
        </Typography>
        
        {authState.isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button color="inherit" onClick={() => navigate('/')}>
              Accueil
            </Button>
            <Button color="inherit" onClick={() => navigate('/calendar')}>
              Calendrier
            </Button>
            {authState.currentUser?.isParent && (
              <Button color="inherit" onClick={() => navigate('/contracts')}>
                Contrats
              </Button>
            )}
            <IconButton
              size="large"
              onClick={handleMenu}
              color="inherit"
            >
              {authState.currentUser?.profilePicture ? (
                <Avatar 
                  src={authState.currentUser.profilePicture} 
                  alt={authState.currentUser.name}
                  sx={{ width: 32, height: 32 }}
                />
              ) : (
                <AccountCircle />
              )}
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleProfile}>Profil</MenuItem>
              {!authState.currentUser?.isParent && (
                <MenuItem onClick={() => { handleClose(); navigate('/wallet'); }}>
                  Mon portefeuille
                </MenuItem>
              )}
              <MenuItem onClick={handleLogout}>
                <ExitToApp fontSize="small" sx={{ mr: 1 }} />
                Déconnexion
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <Button color="inherit" onClick={() => navigate('/login')}>
            Connexion
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;