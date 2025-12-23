// components/molecules/TemplateCard.tsx
// Card component for displaying table templates in a grid layout

'use client';

import {
  Card,
  CardContent,
  CardActionArea,
  CardActions,
  Typography,
  Box,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ContentCopy,
  MoreVert,
  Lock,
  TableRestaurant,
  Circle,
} from '@mui/icons-material';
import { useState } from 'react';
import { TableTemplate, SESSION_TYPE_COLORS } from '@/types/Template';
import { scaleTemplate, getTemplateBaseSeatCount } from '@/utils/templateScaler';
import TablePreview from '../atoms/TablePreview';

// ============================================================================
// TEMPLATE CARD
// ============================================================================

interface TemplateCardProps {
  template: TableTemplate;
  onSelect: (template: TableTemplate) => void;
  onEdit?: (template: TableTemplate) => void;
  onDuplicate?: (template: TableTemplate) => void;
  onDelete?: (template: TableTemplate) => void;
  selected?: boolean;
  showActions?: boolean;
}

export function TemplateCard({
  template,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  selected = false,
  showActions = true,
}: TemplateCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const baseSeatCount = getTemplateBaseSeatCount(template);
  const scaledResult = scaleTemplate(template, baseSeatCount);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    onEdit?.(template);
  };

  const handleDuplicate = () => {
    handleMenuClose();
    onDuplicate?.(template);
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete?.(template);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        width: 220,
        height: 280,
        display: 'flex',
        flexDirection: 'column',
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.light',
          boxShadow: 2,
        },
      }}
    >
      <CardActionArea
        onClick={() => onSelect(template)}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* Preview Area */}
        <Box
          sx={{
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#fafafa',
            borderBottom: '1px solid',
            borderColor: 'divider',
            position: 'relative',
          }}
        >
          <TablePreview
            type={template.baseConfig.type}
            roundSeats={template.baseConfig.type === 'round' ? baseSeatCount : undefined}
            rectangleSeats={template.baseConfig.type === 'rectangle' ? template.baseConfig.baseSeats : undefined}
            seatOrdering={scaledResult.seatOrdering}
            seatModes={scaledResult.seatModes}
            size="small"
            showLabels={false}
          />

          {/* Built-in indicator */}
          {template.isBuiltIn && (
            <Tooltip title="Built-in template">
              <Lock
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  fontSize: 16,
                  color: 'text.secondary',
                }}
              />
            </Tooltip>
          )}
        </Box>

        {/* Content */}
        <CardContent sx={{ flexGrow: 1, py: 1.5, px: 1.5 }}>
          <Typography 
            variant="subtitle2" 
            fontWeight="bold" 
            noWrap
            sx={{ mb: 0.5 }}
          >
            {template.name}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3,
              mb: 1,
            }}
          >
            {template.description}
          </Typography>

          {/* Session type chips */}
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {template.sessionTypes.slice(0, 2).map((type) => (
              <Chip
                key={type}
                label={type.split(' ')[0]} // Just first word
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  bgcolor: SESSION_TYPE_COLORS[type],
                  color: 'white',
                }}
              />
            ))}
            {template.sessionTypes.length > 2 && (
              <Chip
                label={`+${template.sessionTypes.length - 2}`}
                size="small"
                sx={{ height: 18, fontSize: 10 }}
              />
            )}
          </Stack>

          {/* Seat info */}
          <Stack direction="row" spacing={1} mt={1} alignItems="center">
            <TableRestaurant sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {template.minSeats}-{template.maxSeats} seats
            </Typography>
            <Circle sx={{ fontSize: 4, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary">
              {template.baseConfig.type}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>

      {/* Actions */}
      {showActions && (
        <CardActions sx={{ justifyContent: 'flex-end', py: 0.5, px: 1 }}>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVert fontSize="small" />
          </IconButton>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
          >
            {!template.isBuiltIn && onEdit && (
              <MenuItem onClick={handleEdit}>
                <ListItemIcon>
                  <Edit fontSize="small" />
                </ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
            )}
            {onDuplicate && (
              <MenuItem onClick={handleDuplicate}>
                <ListItemIcon>
                  <ContentCopy fontSize="small" />
                </ListItemIcon>
                <ListItemText>Duplicate</ListItemText>
              </MenuItem>
            )}
            {!template.isBuiltIn && onDelete && (
              <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <Delete fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </CardActions>
      )}
    </Card>
  );
}

// ============================================================================
// CREATE NEW TEMPLATE CARD
// ============================================================================

interface CreateTemplateCardProps {
  onClick: () => void;
}

export function CreateTemplateCard({ onClick }: CreateTemplateCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: 220,
        height: 280,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
        },
      }}
      onClick={onClick}
    >
      <Add sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
      <Typography variant="subtitle2" color="text.secondary">
        Create Template
      </Typography>
      <Typography variant="caption" color="text.disabled">
        Save your own layout
      </Typography>
    </Card>
  );
}

// ============================================================================
// TEMPLATE GRID
// ============================================================================

interface TemplateGridProps {
  templates: TableTemplate[];
  selectedTemplateId?: string | null;
  onSelect: (template: TableTemplate) => void;
  onEdit?: (template: TableTemplate) => void;
  onDuplicate?: (template: TableTemplate) => void;
  onDelete?: (template: TableTemplate) => void;
  onCreateNew?: () => void;
  showCreateCard?: boolean;
  emptyMessage?: string;
}

export function TemplateGrid({
  templates,
  selectedTemplateId,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onCreateNew,
  showCreateCard = true,
  emptyMessage = 'No templates found',
}: TemplateGridProps) {
  if (templates.length === 0 && !showCreateCard) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 200,
          color: 'text.secondary',
        }}
      >
        <Typography>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        justifyContent: 'flex-start',
      }}
    >
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onSelect={onSelect}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          selected={selectedTemplateId === template.id}
        />
      ))}

      {showCreateCard && onCreateNew && (
        <CreateTemplateCard onClick={onCreateNew} />
      )}
    </Box>
  );
}

export default TemplateCard;