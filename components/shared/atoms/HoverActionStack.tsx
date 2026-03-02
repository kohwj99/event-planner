import { Box, IconButton, Tooltip } from '@mui/material';

interface HoverAction {
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  color?: 'primary' | 'error' | 'default';
  title?: string;
}

interface HoverActionStackProps {
  actions: HoverAction[];
  className?: string;
}

export default function HoverActionStack({ actions, className }: HoverActionStackProps) {
  return (
    <Box
      className={className}
      sx={{
        position: 'absolute',
        top: 12,
        right: -40,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        opacity: 0,
        transition: '0.2s ease',
        zIndex: 10,
        bgcolor: 'background.paper',
        borderRadius: 1.5,
        p: 0.5,
        boxShadow: 2,
      }}
    >
      {actions.map((action, index) => {
        const button = (
          <IconButton
            key={index}
            size="small"
            color={action.color ?? 'default'}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick(e);
            }}
          >
            {action.icon}
          </IconButton>
        );

        if (action.title) {
          return (
            <Tooltip key={index} title={action.title} placement="left">
              {button}
            </Tooltip>
          );
        }

        return button;
      })}
    </Box>
  );
}

export type { HoverAction, HoverActionStackProps };
