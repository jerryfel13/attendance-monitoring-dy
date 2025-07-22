import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
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
        <footer className="w-full flex justify-center absolute bottom-4 left-0">
          <span className="text-xs text-gray-500">© 2024 Jerryfel Laraga</span>
        </footer>
      </body>
    </html>
  )
}
