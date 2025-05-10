# Frontend Documentation

## Overview

The frontend is built with:
- Vite
- React
- TypeScript
- Tailwind CSS

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components
│   ├── services/      # API and other services
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   ├── mocks/         # Mock data for development
│   ├── App.tsx        # Main application component
│   └── main.tsx       # Application entry point
├── public/            # Static assets
├── index.html         # HTML template
├── vite.config.ts     # Vite configuration
└── package.json       # Project dependencies and scripts
```

## Development

### Environment Variables

The frontend uses the following environment variables:

```env
VITE_API_BASE_URL=http://localhost:56000/api  # Backend API URL
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

### Mock Data

The application includes a mock data mode for development without a backend:

1. In `src/services/api.ts`, set:
   ```typescript
   const USE_MOCK_DATA = true;
   ```

2. Mock data is defined in `src/mocks/mockData.ts`

## Components

### Authentication

The application uses Google OAuth for authentication. The OAuth flow is handled by:
- `src/services/auth.ts` - Authentication service
- `src/components/auth/LoginButton.tsx` - Login button component
- `src/components/auth/AuthProvider.tsx` - Authentication context provider

### Task Management

Tasks are managed through:
- `src/services/tasks.ts` - Task service
- `src/components/tasks/TaskList.tsx` - Task list component
- `src/components/tasks/TaskForm.tsx` - Task creation/edit form

### Contracts

Contract management is implemented in:
- `src/services/contracts.ts` - Contract service
- `src/components/contracts/ContractList.tsx` - Contract list component
- `src/components/contracts/ContractForm.tsx` - Contract creation/edit form

### Virtual Wallet

The virtual wallet feature is implemented through:
- `src/services/wallet.ts` - Wallet service
- `src/components/wallet/WalletBalance.tsx` - Balance display
- `src/components/wallet/TransactionHistory.tsx` - Transaction history

## State Management

The application uses React Context for state management:
- `src/context/AuthContext.tsx` - Authentication state
- `src/context/TaskContext.tsx` - Task state
- `src/context/ContractContext.tsx` - Contract state

## Error Handling

Error handling is implemented through:
- `src/components/common/ErrorBoundary.tsx` - React error boundary
- `src/utils/error.ts` - Error handling utilities

## Testing

Tests are written using:
- Jest for unit tests
- React Testing Library for component tests
- Cypress for end-to-end tests

## Build and Deployment

The frontend is built using Vite and can be deployed to any static hosting service.

### Production Build

```bash
npm run build
```

This creates a `dist` directory with the production build.

### Docker Build

The frontend can be built and served using Docker:

```bash
# Development
docker compose up frontend

# Production
docker compose -f docker-compose.prod.yml up frontend
```

## Performance Optimization

The application implements several performance optimizations:

1. Code splitting using React.lazy()
2. Image optimization
3. Caching strategies
4. Memoization of expensive computations

## Accessibility

The application follows WCAG guidelines:

1. Proper ARIA attributes
2. Keyboard navigation
3. Color contrast compliance
4. Screen reader support