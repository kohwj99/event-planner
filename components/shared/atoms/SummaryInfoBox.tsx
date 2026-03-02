import { Box } from '@mui/material';

interface SummaryInfoBoxProps {
  children: React.ReactNode;
}

export default function SummaryInfoBox({ children }: SummaryInfoBoxProps) {
  return (
    <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2 }}>
      {children}
    </Box>
  );
}
