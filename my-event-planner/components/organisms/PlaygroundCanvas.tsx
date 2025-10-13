'use client';
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useSeatStore } from "@/store/seatStore";
import { createRoundTable } from "@/utils/generateTable";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";

export default function PlaygroundCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { tables, addTable, resetTables } = useSeatStore();

  // create some dummy tables if none exist
  useEffect(() => {
    if (tables.length === 0) {
      const t1 = createRoundTable("t1", 300, 250, 60, 8, "VIP A");
      const t2 = createRoundTable("t2", 650, 250, 60, 10, "Guest B");
      addTable(t1);
      addTable(t2);
    }
  }, [tables, addTable]);

  // draw tables and seats
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    tables.forEach((table) => {
      if (table.shape === "round") {
        svg
          .append("circle")
          .attr("cx", table.x)
          .attr("cy", table.y)
          .attr("r", table.radius)
          .attr("fill", "#1976d2")
          .attr("stroke", "#0d47a1")
          .attr("stroke-width", 2);

        svg
          .append("text")
          .attr("x", table.x)
          .attr("y", table.y + 5)
          .attr("text-anchor", "middle")
          .attr("fill", "white")
          .attr("font-size", "14px")
          .text(table.label);

        // draw each seat
        table.seats.forEach((seat) => {
          svg
            .append("circle")
            .attr("cx", seat.x)
            .attr("cy", seat.y)
            .attr("r", seat.radius)
            .attr("fill", "#90caf9")
            .attr("stroke", "#1565c0")
            .attr("stroke-width", 1);

          svg
            .append("text")
            .attr("x", seat.x)
            .attr("y", seat.y + 4)
            .attr("text-anchor", "middle")
            .attr("fill", "#0d47a1")
            .attr("font-size", "10px")
            .text(seat.label);
        });
      }
    });
  }, [tables]);

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        bgcolor: "#fafafa",
      }}
    >
      <Box
        component="svg"
        ref={svgRef}
        sx={{ width: "100%", height: "100%", display: "block" }}
        preserveAspectRatio="xMidYMid meet"
      />
    </Paper>
  );
}
