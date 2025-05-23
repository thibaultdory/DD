import React, { ReactNode } from 'react';
import { Container, Box, useTheme, useMediaQuery } from '@mui/material';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Box 
        sx={{ 
          position: isMobile ? 'sticky' : 'static',
          top: 0,
          zIndex: theme.zIndex.appBar,
          bgcolor: 'background.paper'
        }}
      >
        <Header />
      </Box>
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          py: { xs: 2, sm: 3 },
          px: { xs: 2, sm: 3, md: 4 },
          width: '100%',
          maxWidth: 'none'
        }}
      >
        {children}
      </Box>
      <Box component="footer" sx={{ py: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          Assistant de Vie Familiale © {new Date().getFullYear()}
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;