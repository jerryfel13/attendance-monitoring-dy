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
        <footer className="w-full flex justify-center absolute bottom-4 left-0">
          <span className="text-xs text-gray-500">© 2024 Jerryfel Laraga</span>
        </footer>
      </body>
    </html>
  )
}
