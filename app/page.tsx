import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center gap-2 pb-0">
          <div className="w-24 h-24 flex items-center justify-center mb-2">
            <img src="/jwd-logo.png" alt="Attendance 101 Logo" className="w-20 h-20 object-contain" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 text-center">Attendance 101</CardTitle>
          <CardDescription className="text-base text-gray-600 text-center">
            Modern attendance tracking with QR codes for seamless check-in and monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 mt-4">
          <Link href="/auth/login">
            <Button className="w-full h-12 text-lg font-semibold shadow-sm">Login</Button>
          </Link>
          <Link href="/auth/register">
            <Button variant="outline" className="w-full h-12 text-lg font-semibold bg-transparent">Register</Button>
          </Link>
        </CardContent>
      </Card>
      <footer className="absolute bottom-4 left-0 w-full flex justify-center">
        <span className="text-xs text-gray-500">© 2024 Jerryfel Laraga</span>
      </footer>
    </div>
  )
}
