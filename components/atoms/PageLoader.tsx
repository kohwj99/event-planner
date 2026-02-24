'use client';

import { Box, CircularProgress, Typography } from '@mui/material';

interface PageLoaderProps {
  /** Descriptive loading message displayed below the spinner */
  message?: string;
  /** When true (default), uses 100vh height. When false, fills available container space. */
  fullHeight?: boolean;
}

/**
 * Reusable full-page or full-container loading spinner.
 * Used by loading.tsx route files and inline hydration guards.
 */
export default function PageLoader({
  message = 'Loading...',
  fullHeight = true,
}: PageLoaderProps) {
  return (
    <Box
      role="status"
      aria-label={message}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        height: fullHeight ? '100vh' : '100%',
        minHeight: fullHeight ? undefined : 200,
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}
