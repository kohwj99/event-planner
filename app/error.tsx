'use client';

import { useEffect } from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import { useRouter } from 'next/navigation';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="h1" fontWeight={800} color="error" sx={{ fontSize: '6rem' }}>
        Error
      </Typography>
      <Typography variant="h5" fontWeight={600} color="text.primary">
        Something went wrong
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480 }}>
        An unexpected error occurred. You can try again or return to the dashboard.
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="outlined"
          size="large"
          onClick={reset}
          sx={{ borderRadius: 2, textTransform: 'none', px: 4 }}
        >
          Try Again
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={() => router.push('/')}
          sx={{ borderRadius: 2, textTransform: 'none', px: 4 }}
        >
          Return to Dashboard
        </Button>
      </Stack>
    </Box>
  );
}
