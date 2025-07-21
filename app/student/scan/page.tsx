"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, QrCode, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function ScanPage() {
  const [qrCode, setQrCode] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<{ type: string; message: string; success: boolean } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/auth/login?role=student")
      return
    }
  }, [router])

  const handleScan = async () => {
    if (!qrCode.trim()) return

    setIsScanning(true)
    setResult(null)

    try {
      // Simulate QR code processing
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Parse QR code (mock implementation)
      if (qrCode.startsWith("SUBJECT:")) {
        // Subject enrollment
        const subjectInfo = qrCode.replace("SUBJECT:", "")
        setResult({
          type: "enrollment",
          message: `Successfully enrolled in ${subjectInfo}!`,
          success: true,
        })
      } else if (qrCode.startsWith("ATTENDANCE:")) {
        // Attendance marking
        const attendanceInfo = qrCode.replace("ATTENDANCE:", "")
        const currentTime = new Date().toLocaleTimeString()
        setResult({
          type: "attendance",
          message: `Attendance marked for ${attendanceInfo} at ${currentTime}`,
          success: true,
        })
      } else {
        setResult({
          type: "error",
          message: "Invalid QR code. Please scan a valid subject or attendance QR code.",
          success: false,
        })
      }
    } catch (error) {
      setResult({
        type: "error",
        message: "Failed to process QR code. Please try again.",
        success: false,
      })
    } finally {
      setIsScanning(false)
    }
  }

  const simulateCamera = () => {
    // Simulate camera scan with mock data
    const mockQRCodes = [
      "SUBJECT:Data Structures (CS201)",
      "ATTENDANCE:Database Systems (CS301)",
      "SUBJECT:Web Development (CS401)",
    ]
    const randomQR = mockQRCodes[Math.floor(Math.random() * mockQRCodes.length)]
    setQrCode(randomQR)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/student/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">QR Code Scanner</h1>
              <p className="text-sm text-gray-600">Scan to enroll or mark attendance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle>Scan QR Code</CardTitle>
              <CardDescription>Point your camera at the QR code or enter the code manually</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qrCode">QR Code Data</Label>
                <Input
                  id="qrCode"
                  placeholder="Enter QR code or scan with camera"
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                />
              </div>

              <div className="flex space-x-2">
                <Button onClick={simulateCamera} variant="outline" className="flex-1 bg-transparent">
                  <Camera className="w-4 h-4 mr-2" />
                  Simulate Scan
                </Button>
                <Button onClick={handleScan} disabled={!qrCode.trim() || isScanning} className="flex-1">
                  {isScanning ? "Processing..." : "Process QR"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">1</span>
                </div>
                <p>
                  <strong>Subject Enrollment:</strong> Scan the QR code provided by your teacher to enroll in a subject
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-green-600">2</span>
                </div>
                <p>
                  <strong>Mark Attendance:</strong> Scan the attendance QR code during class to mark your presence
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-purple-600">3</span>
                </div>
                <p>
                  <strong>Check Status:</strong> View your attendance records in the dashboard
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
