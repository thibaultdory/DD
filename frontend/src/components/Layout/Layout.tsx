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
      <Container 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          py: { xs: 2, sm: 3 },
          px: { xs: 1, sm: 2, md: 3 },
          maxWidth: '100% !important'
        }}
      >
        {children}
      </Container>
      <Box component="footer" sx={{ py: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
        <Container>
          Assistant de Vie Familiale © {new Date().getFullYear()}
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;