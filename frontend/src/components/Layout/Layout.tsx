import React, { ReactNode } from 'react';
import { Container, Box } from '@mui/material';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
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