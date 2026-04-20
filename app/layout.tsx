import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TwinMind — Live Suggestions',
  description: 'AI meeting copilot with real-time live suggestions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0b0e] text-gray-100 antialiased">{children}</body>
    </html>
  );
}
