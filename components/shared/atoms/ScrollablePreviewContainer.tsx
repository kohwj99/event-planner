// components/atoms/ScrollablePreviewContainer.tsx
// Reusable scrollable container for table previews
// Used by AddTableModal, ModifyTableModal, CreateEditTemplateModal, PatternEditor

'use client';

import { Box } from '@mui/material';
import { ReactNode } from 'react';

interface ScrollablePreviewContainerProps {
  children: ReactNode;
  bgcolor?: string;
  maxHeight?: number;
  minHeight?: number;
  padding?: number;
}

/**
 * A scrollable container for table previews.
 * Allows large tables to be scrolled within a fixed-height container.
 * Uses overflow: auto to enable scrolling when content exceeds container size.
 */
export default function ScrollablePreviewContainer({
  children,
  bgcolor = '#fafafa',
  maxHeight = 400,
  minHeight = 280,
  padding = 2,
}: ScrollablePreviewContainerProps) {
  return (
    <Box
      sx={{
        bgcolor,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        minHeight,
        maxHeight,
        overflow: 'auto',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: padding,
          // Allow content to expand for scrolling
          minWidth: 'max-content',
          minHeight: 'max-content',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}