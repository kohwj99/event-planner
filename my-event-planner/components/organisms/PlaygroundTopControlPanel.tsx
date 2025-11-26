// 'use client';

// import AppBar from '@mui/material/AppBar';
// import Toolbar from '@mui/material/Toolbar';
// import Typography from '@mui/material/Typography';
// import Button from '@mui/material/Button';
// import Stack from '@mui/material/Stack';
// import { useSeatStore } from '@/store/seatStore';
// import { exportToPDF } from '@/utils/exportToPDF';
// import { exportToPPTX } from '@/utils/exportToPPTX';
// import { useState } from 'react';
// import AutoFillButton from '../atoms/AutoFillButton';
// import ExportModal from '../molecules/ExportModal';

// interface PlaygroundTopControlPanelProps {
//   onManageGuests?: () => void;
// }

// export default function PlaygroundTopControlPanel({ onManageGuests }: PlaygroundTopControlPanelProps) {
//   const { tables, resetTables } = useSeatStore();
//   const [exportModalOpen, setExportModalOpen] = useState(false);

//   const handleReset = () => {
//     if (confirm('Are you sure you want to reset all tables? This will clear all seating arrangements.')) {
//       resetTables();
//     }
//   }

//   const handleExportPDF = () => {
//     exportToPDF("playground-canvas");
//   };

//   const handleExportPPTX = () => {
//     exportToPPTX(tables);
//   };

//   return (
//     <>
//       <AppBar position="static" color="default" elevation={1}>
//         <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
//           <Typography variant="h6" fontWeight="bold">
//             Seat Planner
//           </Typography>

//           <Stack direction="row" spacing={2} p={2} bgcolor="#e3f2fd">

//             <Button variant="contained" color="primary" onClick={onManageGuests}>
//               Manage Guests
//             </Button>

//             <AutoFillButton/>

//             <Button
//               variant="contained"
//               color="secondary"
//               onClick={() => setExportModalOpen(true)}
//             >
//               Export
//             </Button>

//             <Button
//               variant="contained"
//               color="error"
//               onClick={handleReset}
//             >
//               Reset
//             </Button>

//           </Stack>
//         </Toolbar>
//       </AppBar>

//       {/* Export Modal */}
//       <ExportModal
//         open={exportModalOpen}
//         onClose={() => setExportModalOpen(false)}
//         onExportPDF={handleExportPDF}
//         onExportPPTX={handleExportPPTX}
//       />
//     </>
//   );
// }