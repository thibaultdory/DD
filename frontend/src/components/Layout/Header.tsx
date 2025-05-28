import React from 'react';
import { AppBar, Toolbar, Typography, Button, Avatar, Box, IconButton, Menu, MenuItem, useTheme, useMediaQuery, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePin } from '../../contexts/PinContext';
import { AccountCircle, ExitToApp, Menu as MenuIcon, Person } from '@mui/icons-material';

const Header: React.FC = () => {
  const { authState, logout, getEffectiveCurrentUser } = useAuth();
  const { logoutPin, pinAuthState } = usePin();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = React.useState<null | HTMLElement>(null);

  // Get the effective current user (considering PIN authentication)
  const effectiveUser = getEffectiveCurrentUser();
  const realUser = authState.currentUser;

  // Check if we're in child emulation mode
  const isChildEmulation = pinAuthState.isTabletMode && 
                          pinAuthState.isPinAuthenticated && 
                          effectiveUser && 
                          realUser && 
                          effectiveUser.id !== realUser.id;

  // Debug logging for effective user changes
  React.useEffect(() => {
    console.log('Header: User state changed:', {
      realUser: realUser?.name,
      effectiveUser: effectiveUser?.name,
      isChildEmulation,
      effectiveUserIsParent: effectiveUser?.isParent,
      realUserIsParent: realUser?.isParent
    });
  }, [effectiveUser, realUser, isChildEmulation]);

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
    // Clear PIN authentication first
    logoutPin();
    // Then perform Google logout
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Child emulation indicator */}
            {isChildEmulation && (
              <Chip
                icon={<Person />}
                label={`Mode: ${effectiveUser?.name}`}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ 
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
            )}
            
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
                  {effectiveUser?.isParent && (
                    <>
                      <MenuItem onClick={() => handleNavigation('/contracts')}>Contrats</MenuItem>
                      <MenuItem onClick={() => handleNavigation('/rules')}>Règles</MenuItem>
                      <MenuItem onClick={() => handleNavigation('/wallet')}>Portefeuilles</MenuItem>
                    </>
                  )}
                  <MenuItem onClick={handleProfile}>Profil</MenuItem>
                  {!effectiveUser?.isParent && (
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
                {effectiveUser?.isParent && (
                  <>
                    <Button 
                      color="inherit" 
                      onClick={() => navigate('/contracts')}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Contrats
                    </Button>
                    <Button 
                      color="inherit" 
                      onClick={() => navigate('/rules')}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Règles
                    </Button>
                    <Button 
                      color="inherit" 
                      onClick={() => navigate('/wallet')}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Portefeuilles
                    </Button>
                  </>
                )}
                <IconButton
                  size="large"
                  onClick={handleMenu}
                  color="inherit"
                >
                  {effectiveUser?.profilePicture ? (
                    <Avatar 
                      src={effectiveUser.profilePicture} 
                      alt={effectiveUser.name}
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
                  {!effectiveUser?.isParent && (
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