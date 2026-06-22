import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gitea Runner',
  description: 'Self-hosted Gitea Actions runner manager',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0b0d] text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
