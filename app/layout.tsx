import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Attendance 101',
  description: 'Attendance 101 - Modern QR-based attendance tracking',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
