// "use client";
// import * as d3 from "d3";
// import { useEffect, useRef, useState } from "react";
// import { Menu, MenuItem, Button } from "@mui/material";

// type Guest = {
//   id: number;
//   name: string;
//   company: string;
// };

// const dummyGuests: Guest[] = [
//   { id: 1, name: "Alice Tan", company: "Alpha Corp" },
//   { id: 2, name: "Benjamin Ong", company: "Beta Group" },
//   { id: 3, name: "Clara Lim", company: "Gamma Pte Ltd" },
// ];

// type SeatProps = {
//   id: string;
//   x: number;
//   y: number;
//   locked?: boolean;
// };

// export default function Seat({ id, x, y, locked = false }: SeatProps) {
//   const ref = useRef<SVGSVGElement | null>(null);
//   const [isLocked, setIsLocked] = useState(locked);
//   const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
//   const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

//   // Draw seat using D3
//   useEffect(() => {
//     if (!ref.current) return;
//     const svg = d3.select(ref.current);

//     // Clear previous drawings
//     svg.selectAll("*").remove();

//     // Draw seat circle
//     svg
//       .append("circle")
//       .attr("cx", x)
//       .attr("cy", y)
//       .attr("r", 25)
//       .attr("fill", isLocked ? "#b0b0b0" : "#1976d2")
//       .attr("stroke", "black")
//       .attr("stroke-width", 2)
//       .style("cursor", isLocked ? "not-allowed" : "pointer")
//       .on("click", (event) => {
//         if (!isLocked) {
//           setAnchorEl(event.currentTarget);
//         }
//       });

//     // Add text label (guest name or seat id)
//     svg
//       .append("text")
//       .attr("x", x)
//       .attr("y", y + 40)
//       .attr("text-anchor", "middle")
//       .attr("font-size", "12px")
//       .text(selectedGuest ? selectedGuest.name : `Seat ${id}`);
//   }, [x, y, isLocked, selectedGuest]);

//   const handleGuestSelect = (guest: Guest) => {
//     setSelectedGuest(guest);
//     setAnchorEl(null);
//   };

//   const handleLockToggle = () => setIsLocked((prev) => !prev);

//   return (
//     <div style={{ display: "inline-block", margin: "10px", textAlign: "center" }}>
//       <svg ref={ref} width={100} height={100} />
//       <div>
//         <Button
//           variant="outlined"
//           size="small"
//           onClick={handleLockToggle}
//           style={{ marginTop: "5px" }}
//         >
//           {isLocked ? "Unlock" : "Lock"}
//         </Button>
//       </div>

//       {/* Guest selection menu */}
//       <Menu
//         anchorEl={anchorEl}
//         open={Boolean(anchorEl)}
//         onClose={() => setAnchorEl(null)}
//       >
//         {dummyGuests.map((guest) => (
//           <MenuItem key={guest.id} onClick={() => handleGuestSelect(guest)}>
//             {guest.name} — {guest.company}
//           </MenuItem>
//         ))}
//       </Menu>
//     </div>
//   );
// }


// app/seating/components/Seat.tsx
"use client";

import { Circle } from "react-konva";

interface SeatProps {
  x: number;
  y: number;
  radius?: number;
  color?: string;
  id: string;
  onClick?: (id: string) => void;
}

export default function Seat({ x, y, radius = 12, color = "#FFD700", id, onClick }: SeatProps) {
  return (
    <Circle
      x={x}
      y={y}
      radius={radius}
      fill={color}
      stroke="black"
      strokeWidth={1}
      draggable
      onClick={() => onClick?.(id)}
    />
  );
}
