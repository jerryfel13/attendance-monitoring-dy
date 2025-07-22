"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, QrCode, ArrowLeft, CheckCircle, X } from "lucide-react"
import Link from "next/link"
import { Html5QrcodeScanner } from "html5-qrcode"
import { apiClient } from "@/lib/api"

export default function ScanPage() {
  const [qrCode, setQrCode] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [result, setResult] = useState<{ type: string; message: string; success: boolean } | null>(null)
  const [user, setUser] = useState<any>(null)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const router = useRouter()
  const [manualCode, setManualCode] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/auth/login")
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== "student") {
      router.push("/")
      return
    }

    setUser(parsedUser)
  }, [router])

  const startCamera = () => {
    if (isCameraActive) return

    setIsCameraActive(true)
    setResult(null)

    try {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      )

      scannerRef.current.render(onScanSuccess, onScanFailure)
    } catch (error) {
      console.error("Failed to start camera:", error)
      setResult({
        type: "error",
        message: "Failed to access camera. Please check permissions.",
        success: false,
      })
      setIsCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.clear()
      scannerRef.current = null
    }
    setIsCameraActive(false)
  }

  const onScanSuccess = async (decodedText: string) => {
    setQrCode(decodedText)
    await handleScan(decodedText)
  }

  const onScanFailure = (error: any) => {
    // Handle scan failure silently
    console.log("QR scan failed:", error)
  }

  const handleScan = async (qrData?: string) => {
    const dataToProcess = qrData || qrCode
    if (!dataToProcess.trim()) return

    setIsScanning(true)
    setResult(null)

    try {
      // Use the new apiClient route
      const data = await apiClient.auth.scan({
        qrCode: dataToProcess,
        studentId: user?.id,
      })
      setResult({
        type: data.type,
        message: data.message,
        success: data.success,
      })
      if (isCameraActive && data.success) {
        stopCamera()
      }
    } catch (error: any) {
      setResult({
        type: "error",
        message: error.message || "Failed to process QR code. Please try again.",
        success: false,
      })
    } finally {
      setIsScanning(false)
    }
  }

  const simulateCamera = () => {
    const mockQRCodes = [
      "SUBJECT:Data Structures (CS201)",
      "ATTENDANCE:Database Systems (CS301)",
      "SUBJECT:Web Development (CS401)",
    ]
    const randomQR = mockQRCodes[Math.floor(Math.random() * mockQRCodes.length)]
    setQrCode(randomQR)
  }

  const handleManualCode = async () => {
    if (!manualCode.trim() || !user?.id) return;
    setManualSubmitting(true);
    setResult(null);
    try {
      const data = await apiClient.auth.submitManualCode({ code: manualCode.trim(), studentId: String(user.id) });
      setResult({ type: 'manual', message: data.message, success: true });
      setManualCode("");
    } catch (error: any) {
      setResult({ type: 'manual', message: error.message || 'Failed to process manual code.', success: false });
    } finally {
      setManualSubmitting(false);
    }
  };

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
      }
    }
  }, [])

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
              {/* Always render the qr-reader div, but only show it when camera is active */}
              <div id="qr-reader" className={isCameraActive ? "w-full" : "hidden"}></div>
              {!isCameraActive ? (
                <>
                  {/* Remove QR Code Data input and Simulate Scan button */}
                  <div className="flex space-x-2">
                    <Button onClick={startCamera} className="flex-1">
                      <Camera className="w-4 h-4 mr-2" />
                      Start Camera
                    </Button>
                  </div>
                  {/* Manual code input remains */}
                  <div className="space-y-2">
                    <Label htmlFor="manualCode">Manual Attendance Code</Label>
                    <Input
                      id="manualCode"
                      placeholder="Enter manual code from teacher"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      autoComplete="off"
                    />
                    <Button onClick={handleManualCode} disabled={!manualCode.trim() || manualSubmitting} className="w-full mt-2">
                      {manualSubmitting ? "Submitting..." : "Submit Manual Code"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* The qr-reader div is always present, so nothing needed here */}
                  <Button onClick={stopCamera} variant="outline" className="w-full">
                    <X className="w-4 h-4 mr-2" />
                    Stop Camera
                  </Button>
                </div>
              )}
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
