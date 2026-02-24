'use client';

import { Box, Typography, Button } from '@mui/material';
import { useNavigation } from '@/components/providers/NavigationProvider';

export default function NotFound() {
  const { navigateWithLoading } = useNavigation();

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
      <Typography variant="h1" fontWeight={800} color="text.secondary" sx={{ fontSize: '6rem' }}>
        404
      </Typography>
      <Typography variant="h5" fontWeight={600} color="text.primary">
        Page Not Found
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
        The page you are looking for does not exist or has been moved.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={() => navigateWithLoading('/')}
        sx={{ borderRadius: 2, textTransform: 'none', px: 4, mt: 2 }}
      >
        Return to Dashboard
      </Button>
    </Box>
  );
}
