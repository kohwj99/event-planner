'use client';

import { useSeatStore } from "@/store/seatStore";
import { Typography, Box } from "@mui/material";

export default function PlaygroundRightConfigPanel() {
  const { tables, selectedTableId } = useSeatStore();
  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        {selectedTable
          ? `Selected: ${selectedTable.label}`
          : "No table selected"}
      </Typography>

      {selectedTable && (
        <Typography variant="body2" color="text.secondary">
          Shape: {selectedTable.shape}
          <br />
          Seats: {selectedTable.seats.length}
        </Typography>
      )}
    </Box>
  );
}
