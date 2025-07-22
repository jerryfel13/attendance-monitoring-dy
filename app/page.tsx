import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">QR Attendance System</h1>
      <p className="text-xl text-gray-600 mb-8 text-center max-w-xl">
        Modern attendance tracking with QR codes for seamless check-in and comprehensive monitoring
      </p>
      <div className="flex flex-col gap-4">
        <Link href="/auth/login">
          <Button className="w-64" size="lg">
            Login
          </Button>
        </Link>
        <Link href="/auth/register">
          <Button variant="outline" className="w-64 bg-transparent" size="lg">
            Register
          </Button>
        </Link>
      </div>
    </div>
  )
}
