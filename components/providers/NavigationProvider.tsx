'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';

interface NavigationContextValue {
  navigateWithLoading: (url: string, message?: string) => void;
  isNavigating: boolean;
}

const NavigationContext = createContext<NavigationContextValue>({
  navigateWithLoading: () => {},
  isNavigating: false,
});

export const useNavigation = () => useContext(NavigationContext);

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [navigationPathname, setNavigationPathname] = useState(pathname);

  // Reset navigation state when pathname changes (derived state during render)
  if (pathname !== navigationPathname) {
    setNavigationPathname(pathname);
    if (isNavigating) {
      setIsNavigating(false);
    }
  }

  const navigateWithLoading = useCallback((url: string, message?: string) => {
    setLoadingMessage(message ?? 'Loading...');
    setIsNavigating(true);
    router.push(url);
  }, [router]);

  return (
    <NavigationContext.Provider value={{ navigateWithLoading, isNavigating }}>
      {children}
      {isNavigating && (
        <Box
          role="status"
          aria-label={loadingMessage}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: (theme) => theme.zIndex.modal + 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <CircularProgress size={48} />
          <Typography variant="body1" color="text.secondary">
            {loadingMessage}
          </Typography>
        </Box>
      )}
    </NavigationContext.Provider>
  );
}
