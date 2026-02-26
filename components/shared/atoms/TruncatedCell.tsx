import { Tooltip, Typography } from '@mui/material';

interface TruncatedCellProps {
  text: string;
  width: number;
  fontWeight?: number;
  color?: string;
  textDecoration?: string;
}

export default function TruncatedCell({
  text,
  width,
  fontWeight = 400,
  color = 'text.secondary',
  textDecoration,
}: TruncatedCellProps) {
  return (
    <Tooltip title={text || ''} placement="top" arrow enterDelay={500}>
      <Typography
        variant="body2"
        fontWeight={fontWeight}
        color={color}
        sx={{
          width,
          maxWidth: width,
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textDecoration,
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  );
}
