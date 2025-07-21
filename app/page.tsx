import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { QrCode, Users, Clock, BookOpen } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">QR Attendance System</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Modern attendance tracking with QR codes for seamless check-in and comprehensive monitoring
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Student Portal</CardTitle>
              <CardDescription>Register, scan QR codes, and track your attendance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Link href="/auth/login?role=student">
                  <Button className="w-full" size="lg">
                    Student Login
                  </Button>
                </Link>
                <Link href="/auth/register?role=student">
                  <Button variant="outline" className="w-full bg-transparent" size="lg">
                    Student Registration
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Teacher Portal</CardTitle>
              <CardDescription>Manage subjects, monitor attendance, and generate reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Link href="/auth/login?role=teacher">
                  <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
                    Teacher Login
                  </Button>
                </Link>
                <Link href="/auth/register?role=teacher">
                  <Button variant="outline" className="w-full bg-transparent" size="lg">
                    Teacher Registration
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">QR Code Scanning</h3>
            <p className="text-gray-600">Quick and easy attendance marking with QR codes</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Time Tracking</h3>
            <p className="text-gray-600">Automatic late detection and time-based attendance</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Real-time Monitoring</h3>
            <p className="text-gray-600">Live attendance tracking and comprehensive reports</p>
          </div>
        </div>
      </div>
    </div>
  )
}
