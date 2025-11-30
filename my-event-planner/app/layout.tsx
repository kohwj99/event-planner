import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { useEventStore } from "@/store/eventStore";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Seat Planner",
  description: "For your next event",
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

//   useEffect(() => {
//   // 🚨 CRITICAL: Load tracking metadata on app mount BEFORE any navigation
//   console.log('🔄 Initializing tracking metadata...');
//   const loadTrackingMetadata = useEventStore.getState().loadTrackingMetadataIntoStore;

//   if (loadTrackingMetadata) {
//     loadTrackingMetadata();
//     console.log('✅ Tracking metadata loaded');
//   } else {
//     console.error('❌ loadTrackingMetadataIntoStore not found in eventStore');
//   }
// }, []);
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
