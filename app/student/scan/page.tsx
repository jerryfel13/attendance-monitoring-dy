"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Camera, QrCode, ArrowLeft, CheckCircle, X } from "lucide-react"
import Link from "next/link"
import { Html5QrcodeScanner } from "html5-qrcode"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast";

export default function ScanPage() {
  const [qrCode, setQrCode] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const router = useRouter()
  const [manualCode, setManualCode] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [processedCodes, setProcessedCodes] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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
    setLoading(false)
  }, [router])

  const startCamera = () => {
    if (isCameraActive) return

    setIsCameraActive(true)

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
      toast({
        title: "Error",
        description: "Failed to access camera. Please check permissions.",
        variant: "destructive"
      });
      setIsCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.clear()
      scannerRef.current = null
    }
    setIsCameraActive(false)
    
    // Force refresh the QR reader div to completely stop scanning
    const qrReader = document.getElementById('qr-reader')
    if (qrReader) {
      qrReader.innerHTML = ''
    }
  }

  const onScanSuccess = async (decodedText: string) => {
    // Prevent multiple rapid scans
    if (isScanning) return
    
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

    // Prevent multiple rapid scans
    if (isScanning) return
    
    // Check if code was already processed
    if (processedCodes.has(dataToProcess.trim())) {
      toast({
        title: "Already Processed",
        description: "This code has already been processed.",
        variant: "destructive"
      });
      return;
    }

    setIsScanning(true)
    
    // Add a longer delay to prevent rapid successive scans and allow processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    try {
      // Use the new apiClient route
      const data = await apiClient.auth.scan({
        qrCode: dataToProcess,
        studentId: user?.id,
      })
      
      // Clear the QR code after successful scan
      setQrCode("")
      
      // Add to processed codes to prevent duplicates
      setProcessedCodes(prev => new Set([...prev, dataToProcess.trim()]))
      
      // Always close camera after scan attempt (success or error)
      if (isCameraActive) {
        stopCamera()
      }
      
      // Force refresh the card immediately after successful scan
      if (data.success) {
        toast({
          title: "Success",
          description: data.message,
          variant: "default"
        });
        
        // Refresh immediately after toast is triggered
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive"
        });
        
        // Clear processed codes after a delay to allow for new scans
        setTimeout(() => {
          setProcessedCodes(new Set())
        }, 3000)
      }
      
    } catch (error: any) {
      // Clear QR code on error too
      setQrCode("")
      
      // Add to processed codes even on error to prevent retry spam
      setProcessedCodes(prev => new Set([...prev, dataToProcess.trim()]))
      
      // Always close camera after scan attempt (success or error)
      if (isCameraActive) {
        stopCamera()
      }
      
      // Clear processed codes after a delay to allow for new scans
      setTimeout(() => {
        setProcessedCodes(new Set())
      }, 3000)
      
      // Handle specific error types with user-friendly messages
      let errorMessage = "Failed to process QR code. Please try again."
      
      if (error.response?.status === 409) {
        if (error.response?.data?.type === 'enrollment') {
          errorMessage = "You are already enrolled in this subject."
        } else if (error.response?.data?.type === 'attendance') {
          errorMessage = "You have already scanned for this session. Please scan out at the end of class."
        } else {
          errorMessage = "This QR code has already been used."
        }
      } else if (error.response?.status === 403) {
        errorMessage = "You are not enrolled in this subject. Please enroll first."
      } else if (error.response?.status === 404) {
        if (error.response?.data?.type === 'attendance') {
          errorMessage = "No active attendance session found. Please wait for the teacher to start the session."
        } else {
          errorMessage = "Subject not found. Please check the QR code."
        }
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid QR code format. Please scan a valid QR code."
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsScanning(false)
    }
  }

  const simulateCamera = () => {
    const mockQRCodes = [
      "SUBJECT_Data_Structures_CS201",
      "ATTENDANCE_Database_Systems_CS301_2024-01-15",
      "SUBJECT_Web_Development_CS401",
    ]
    const randomQR = mockQRCodes[Math.floor(Math.random() * mockQRCodes.length)]
    setQrCode(randomQR)
  }

  // Skeleton loading component
  const ScanSkeleton = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="w-10 h-10" />
            <div>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-48 w-full rounded-lg" />
                <div className="flex space-x-2">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              </div>
              
              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <footer className="bg-white border-t mt-auto py-4 flex-shrink-0">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-gray-600">
            © 2024 Jerryfel Laraga. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )

  const handleManualCode = async () => {
    if (!manualCode.trim() || !user?.id) return;
    
    // Prevent multiple rapid submissions
    if (manualSubmitting) return;
    
    // Check if code was already processed
    if (processedCodes.has(manualCode.trim())) {
      toast({
        title: "Already Processed",
        description: "This code has already been processed.",
        variant: "destructive"
      });
      return;
    }
    
    setManualSubmitting(true);
    
    // Add delay to prevent rapid submissions
    await new Promise(resolve => setTimeout(resolve, 800))
    
    try {
      // Check if it's a subject enrollment code
      if (manualCode.trim().startsWith("SUBJECT_")) {
        // Use the same scan endpoint for subject enrollment
        const data = await apiClient.auth.scan({
          qrCode: manualCode.trim(),
          studentId: user?.id,
        });
        
        // Clear the manual code after successful submission
        setManualCode("");
        
        // Add to processed codes to prevent duplicates
        setProcessedCodes(prev => new Set([...prev, manualCode.trim()]))
        
        // Force refresh the card immediately after successful scan
        if (data.success) {
          toast({
            title: "Success",
            description: data.message,
            variant: "default"
          });
          
          // Refresh immediately after toast is triggered
          setTimeout(() => {
            window.location.reload()
          }, 100)
        } else {
          toast({
            title: "Error",
            description: data.message,
            variant: "destructive"
          });
          
          // Clear processed codes after a delay to allow for new scans
          setTimeout(() => {
            setProcessedCodes(new Set())
          }, 3000)
        }
      } else {
        // Use manual code endpoint for attendance codes
        const data = await apiClient.auth.submitManualCode({ 
          code: manualCode.trim(), 
          studentId: String(user.id) 
        });
        
        // Clear the manual code after successful submission
        setManualCode("");
        
        // Add to processed codes to prevent duplicates
        setProcessedCodes(prev => new Set([...prev, manualCode.trim()]))
        
        // Force refresh the card immediately after successful scan
        if (data.success) {
          toast({
            title: "Success",
            description: data.message,
            variant: "default"
          });
          
          // Refresh immediately after toast is triggered
          setTimeout(() => {
            window.location.reload()
          }, 100)
        } else {
          toast({
            title: "Error",
            description: data.message,
            variant: "destructive"
          });
          
          // Clear processed codes after a delay to allow for new scans
          setTimeout(() => {
            setProcessedCodes(new Set())
          }, 3000)
        }
      }
    } catch (error: any) {
      // Clear manual code on error too
      setManualCode("");
      
      // Add to processed codes even on error to prevent retry spam
      setProcessedCodes(prev => new Set([...prev, manualCode.trim()]))
      
      // Clear processed codes after a delay to allow for new scans
      setTimeout(() => {
        setProcessedCodes(new Set())
      }, 3000)
      
      // Handle specific error types with user-friendly messages
      let errorMessage = "Failed to process manual code. Please try again."
      
      if (error.response?.status === 409) {
        if (error.response?.data?.type === 'enrollment') {
          errorMessage = "You are already enrolled in this subject."
        } else if (error.response?.data?.type === 'attendance') {
          errorMessage = "You have already scanned for this session. Please scan out at the end of class."
        } else {
          errorMessage = "This code has already been used."
        }
      } else if (error.response?.status === 403) {
        errorMessage = "You are not enrolled in this subject. Please enroll first."
      } else if (error.response?.status === 404) {
        if (error.response?.data?.type === 'attendance') {
          errorMessage = "No active attendance session found. Please wait for the teacher to start the session."
        } else {
          errorMessage = "Invalid code. Please check the code and try again."
        }
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid code format. Please enter a valid code."
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
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

  if (!user) return null
  if (loading) return <ScanSkeleton />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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

      <main className="container mx-auto px-4 py-8 flex-1">
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
      
      {/* Footer */}
      <footer className="bg-white border-t mt-auto py-4 flex-shrink-0">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-gray-600">
            © 2024 Jerryfel Laraga. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
