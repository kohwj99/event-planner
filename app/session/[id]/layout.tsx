'use client';

import { Box } from '@mui/material';

interface SessionDetailLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
}

export default function SessionDetailLayout({
  header,
  children,
}: SessionDetailLayoutProps) {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {header}
      {children}
    </Box>
  );
}
