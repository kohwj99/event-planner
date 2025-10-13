// app/seating/components/SeatingCanvas.tsx
"use client";

import { Stage, Layer, Rect, Circle } from "react-konva";
import { useState } from "react";
import Counter from "../molecules/Counter";

export default function PlanCanvas() {
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(newScale);
    setStagePos({
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    });
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50 w-full h-[80vh]">

      <Counter/>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight * 0.8}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable
        onWheel={handleWheel}
      >
        <Layer>
          {/* Example Table */}
          <Rect
            x={200}
            y={150}
            width={120}
            height={80}
            fill="#6C63FF"
            cornerRadius={10}
            draggable
          />
          {/* Example Seats */}
          {[...Array(6)].map((_, i) => (
            <Circle
              key={i}
              x={180 + i * 30}
              y={270}
              radius={12}
              fill="#FFD700"
              draggable
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
