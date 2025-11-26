import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import { PictureAsPdf, Slideshow } from '@mui/icons-material';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExportPDF: () => void;
  onExportPPTX: () => void;
}

export default function ExportModal({
  open,
  onClose,
  onExportPDF,
  onExportPPTX,
}: ExportModalProps) {
  const handleExport = (format: 'pdf' | 'pptx') => {
    if (format === 'pdf') {
      onExportPDF();
    } else {
      onExportPPTX();
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Seating Plan</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Choose the format you'd like to export your seating plan to:
        </Typography>

        <Stack spacing={2}>
          <Card variant="outlined">
            <CardActionArea onClick={() => handleExport('pdf')}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <PictureAsPdf sx={{ fontSize: 48, color: 'error.main' }} />
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      PDF Document
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Export as a printable PDF file
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>

          <Card variant="outlined">
            <CardActionArea onClick={() => handleExport('pptx')}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Slideshow sx={{ fontSize: 48, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      PowerPoint Presentation
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Export as an editable PPTX file
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}