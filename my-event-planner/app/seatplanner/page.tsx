'use client';

import PlayGroundCanvas from "@/components/organisms/PlaygroundCanvas";
import PlaygroundRightConfigPanel from "@/components/organisms/PlaygroundRightConfigPanel";
import PlaygroundTopControlPanel from "@/components/organisms/PlaygroundTopControlPanel";



export default function SeatPlannerPage() {
  return (
    <div className="flex flex-col w-full h-full">
      {/* Top Panel */}
      <PlaygroundTopControlPanel />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 bg-white relative overflow-hidden">
          <PlayGroundCanvas />
        </div>

        {/* Right Panel */}
        <div className="w-80 bg-gray-100 border-l border-gray-300">
          <PlaygroundRightConfigPanel />
        </div>
      </div>
    </div>
  );
}
