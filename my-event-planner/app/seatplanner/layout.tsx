import type { ReactNode } from 'react';

export default function SeatPlannerLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-col h-screen bg-gray-50">
      {children}
    </main>
  );
}
