// app/seating/page.tsx
"use client";

import { Stage, Layer } from "react-konva";
import Table from "../molecules/Table";

export default function SeatingPage() {
  return (
    <Stage width={window.innerWidth} height={window.innerHeight * 0.8}>
      <Layer>
        <Table x={200} y={200} type="circle" seatsCount={17} />
        <Table x={500} y={200} type="square" seatsCount={8} />
        <Table x={200} y={400} type="rectangle" seatsCount={12} />
      </Layer>
    </Stage>
  );
}
