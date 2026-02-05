'use client';

import * as React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

// Create your MUI theme here (customize as needed)
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f8f9fa',
    },
  },
  typography: {
    fontFamily: 'var(--font-geist-sans), Roboto, Arial, sans-serif',
  },
});

interface ThemeRegistryProps {
  children: React.ReactNode;
}

/**
 * ThemeRegistry provides Material UI theming with proper SSR support for Next.js App Router.
 * 
 * This component:
 * 1. Sets up Emotion cache for SSR compatibility
 * 2. Provides MUI ThemeProvider
 * 3. Includes CssBaseline for consistent styling
 * 
 * This is REQUIRED to prevent hydration mismatches when using MUI with Next.js App Router.
 */
export default function ThemeRegistry({ children }: ThemeRegistryProps) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui', enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}