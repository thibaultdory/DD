import React from 'react';
import { AppBar, Toolbar, Typography, Button, Avatar, Box, IconButton, Menu, MenuItem, useTheme, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AccountCircle, ExitToApp, Menu as MenuIcon } from '@mui/icons-material';

const Header: React.FC = () => {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleClose();
    handleMobileMenuClose();
    navigate('/login');
  };

  const handleProfile = () => {
    handleClose();
    handleMobileMenuClose();
    navigate('/profile');
  };

  const handleNavigation = (path: string) => {
    handleMobileMenuClose();
    navigate(path);
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1,
            fontSize: { xs: '1rem', sm: '1.25rem' },
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          Assistant de Vie Familiale
        </Typography>
        
        {authState.isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isMobile ? (
              <>
                <IconButton
                  color="inherit"
                  onClick={handleMobileMenuOpen}
                  sx={{ mr: 1 }}
                >
                  <MenuIcon />
                </IconButton>
                <Menu
                  anchorEl={mobileMenuAnchorEl}
                  open={Boolean(mobileMenuAnchorEl)}
                  onClose={handleMobileMenuClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  <MenuItem onClick={() => handleNavigation('/')}>Accueil</MenuItem>
                  <MenuItem onClick={() => handleNavigation('/calendar')}>Calendrier</MenuItem>
                  {authState.currentUser?.isParent && (
                    <MenuItem onClick={() => handleNavigation('/contracts')}>Contrats</MenuItem>
                  )}
                  <MenuItem onClick={handleProfile}>Profil</MenuItem>
                  {!authState.currentUser?.isParent && (
                    <MenuItem onClick={() => handleNavigation('/wallet')}>Mon portefeuille</MenuItem>
                  )}
                  <MenuItem onClick={handleLogout}>
                    <ExitToApp fontSize="small" sx={{ mr: 1 }} />
                    Déconnexion
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button 
                  color="inherit" 
                  onClick={() => navigate('/')}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Accueil
                </Button>
                <Button 
                  color="inherit" 
                  onClick={() => navigate('/calendar')}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Calendrier
                </Button>
                {authState.currentUser?.isParent && (
                  <Button 
                    color="inherit" 
                    onClick={() => navigate('/contracts')}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
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
                    <MenuItem onClick={() => handleNavigation('/wallet')}>
                      Mon portefeuille
                    </MenuItem>
                  )}
                  <MenuItem onClick={handleLogout}>
                    <ExitToApp fontSize="small" sx={{ mr: 1 }} />
                    Déconnexion
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>
        ) : (
          <Button 
            color="inherit" 
            onClick={() => navigate('/login')}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Connexion
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;