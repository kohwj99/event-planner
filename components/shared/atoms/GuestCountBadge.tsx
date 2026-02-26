import { Box, Typography } from '@mui/material';

interface GuestCountBadgeProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  activeColor: string;
  activeBgColor: string;
  activeBorderColor: string;
}

export default function GuestCountBadge({
  icon,
  label,
  count,
  activeColor,
  activeBgColor,
  activeBorderColor,
}: GuestCountBadgeProps) {
  const isActive = count > 0;
  const inactiveColor = '#94a3b8';
  const inactiveTextColor = '#64748b';
  const inactiveBorderColor = '#e2e8f0';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        border: '1px solid',
        borderColor: isActive ? activeBorderColor : inactiveBorderColor,
        bgcolor: isActive ? activeBgColor : 'transparent',
        color: isActive ? activeColor : inactiveColor,
      }}
    >
      {icon}
      <Typography
        variant="caption"
        fontWeight="600"
        color={isActive ? activeColor : inactiveTextColor}
      >
        {label}: {count}
      </Typography>
    </Box>
  );
}
