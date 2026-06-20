import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VM Manager',
  description: 'Create and manage virtual machines',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
