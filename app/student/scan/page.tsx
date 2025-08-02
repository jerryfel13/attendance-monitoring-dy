"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Camera, QrCode, ArrowLeft, CheckCircle, X, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Html5QrcodeScanner } from "html5-qrcode"
import { apiClient } from "@/lib/api"

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorShown, setErrorShown] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState("");
  const [enrollmentMessageType, setEnrollmentMessageType] = useState<"success" | "error" | "">("");
  const [scanErrorMessage, setScanErrorMessage] = useState("");

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
    if (isScanning || isProcessing) return
    
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
    if (isScanning || isProcessing) return
    
    // Create unique key for this scan attempt
    const scanKey = `${dataToProcess.trim()}_${user?.id}`
    
    // Check if this exact scan was already processed
    if (processedCodes.has(scanKey)) {
      console.log('Duplicate scan prevented:', scanKey);
      return;
    }

    setIsScanning(true)
    setIsProcessing(true)
    
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
      setProcessedCodes(prev => new Set([...prev, scanKey]))
      
      // Always close camera after scan attempt (success or error)
      if (isCameraActive) {
        stopCamera()
      }
      
      // Show success message
      console.log('Scan response:', data);
      console.log('Success:', data.success);
      console.log('Type:', data.type);
      console.log('Message:', data.message);
      
      if (data.success) {
        setScanSuccess(true);
        setSuccessMessage(data.message);
        
        // Refresh after a longer delay to let user see the success
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      } else {
        // Handle enrollment errors as text labels
        if (data.type === 'enrollment') {
          console.log('Setting enrollment error message from scan:', data.message);
          setEnrollmentMessage(data.message);
          setEnrollmentMessageType("error");
          
          // Clear message after 4 seconds
          setTimeout(() => {
            setEnrollmentMessage("");
            setEnrollmentMessageType("");
          }, 4000)
        } else {
          // For other errors, show error message
          setScanErrorMessage(data.message);
          
          // Clear message after 4 seconds
          setTimeout(() => {
            setScanErrorMessage("");
          }, 4000)
          
          // Clear processed codes after a delay to allow for new scans
          setTimeout(() => {
            setProcessedCodes(new Set())
            setErrorShown(false) // Reset error state
            setIsProcessing(false) // Reset processing state
          }, 5000) // Increased delay to prevent rapid re-scans
        }
      }
      
    } catch (error: any) {
      // Clear QR code on error too
      setQrCode("")
      
      // Add to processed codes even on error to prevent retry spam
      setProcessedCodes(prev => new Set([...prev, scanKey]))
      
      // Always close camera after scan attempt (success or error)
      if (isCameraActive) {
        stopCamera()
      }
      
      // Clear processed codes after a delay to allow for new scans
      setTimeout(() => {
        setProcessedCodes(new Set())
        setErrorShown(false) // Reset error state
        setIsProcessing(false) // Reset processing state
      }, 5000) // Increased delay to prevent rapid re-scans
      

    } finally {
      setIsScanning(false)
      setIsProcessing(false)
    }
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
    
    // Create unique key for this manual code submission
    const manualCodeKey = `${manualCode.trim()}_${user?.id}`
    
    // Check if this exact manual code was already processed
    if (processedCodes.has(manualCodeKey)) {
      console.log('Duplicate manual code prevented:', manualCodeKey);
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
        
        // Show enrollment message as text label instead of toast
        console.log('Enrollment response:', data);
        console.log('Success:', data.success);
        console.log('Message:', data.message);
        
        if (data.success) {
          setEnrollmentMessage(data.message);
          setEnrollmentMessageType("success");
          
          // Clear message after 5 seconds
          setTimeout(() => {
            setEnrollmentMessage("");
            setEnrollmentMessageType("");
          }, 5000)
          
          // Refresh after a longer delay to let user see the success
          setTimeout(() => {
            window.location.reload()
          }, 3000)
        } else {
          console.log('Setting enrollment error message:', data.message);
          // Show error message as text label
          setEnrollmentMessage(data.message);
          setEnrollmentMessageType("error");
          
          // Clear message after 4 seconds
          setTimeout(() => {
            setEnrollmentMessage("");
            setEnrollmentMessageType("");
          }, 4000)
          
          // Clear processed codes after a delay to allow for new scans
          setTimeout(() => {
            setProcessedCodes(new Set())
            setErrorShown(false) // Reset error state
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
        setProcessedCodes(prev => new Set([...prev, manualCodeKey]))
        
        // Show success message
        if (data.success) {
          setScanSuccess(true);
          setSuccessMessage(data.message);
          
          // Refresh after a longer delay to let user see the success
          setTimeout(() => {
            window.location.reload()
          }, 3000)
        } else {
          // Clear processed codes after a delay to allow for new scans
          setTimeout(() => {
            setProcessedCodes(new Set())
            setErrorShown(false) // Reset error state
          }, 3000)
        }
      }
    } catch (error: any) {
      // Clear manual code on error too
      setManualCode("");
      
      // Add to processed codes even on error to prevent retry spam
      setProcessedCodes(prev => new Set([...prev, manualCodeKey]))
      
      // Clear processed codes after a delay to allow for new scans
      setTimeout(() => {
        setProcessedCodes(new Set())
        setErrorShown(false) // Reset error state
      }, 3000)
      
      // Handle specific error types with user-friendly messages
      let errorMessage = "Failed to process manual code. Please try again."
      
      if (error.response?.status === 409) {
        if (error.response?.data?.type === 'enrollment') {
          errorMessage = error.response.data.message || "You are already enrolled in this subject."
          // Show enrollment error as text label
          setEnrollmentMessage(errorMessage);
          setEnrollmentMessageType("error");
          
          // Clear message after 4 seconds
          setTimeout(() => {
            setEnrollmentMessage("");
            setEnrollmentMessageType("");
          }, 4000)
        } else if (error.response?.data?.type === 'attendance') {
          errorMessage = "Already scanned for this session. Please scan out at the end of class."
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
      } else {
        // Generic error
        errorMessage = "Failed to process manual code. Please try again."
      }
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
              {/* Success message display */}
              {scanSuccess && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {successMessage}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Scan error message display */}
              {scanErrorMessage && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {scanErrorMessage}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Enrollment message display */}
              {enrollmentMessage && (
                <Alert className={enrollmentMessageType === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  {enrollmentMessageType === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={enrollmentMessageType === "success" ? "text-green-800" : "text-red-800"}>
                    {enrollmentMessage}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 p-2 bg-gray-100 rounded">
                  Debug: enrollmentMessage="{enrollmentMessage}", type="{enrollmentMessageType}"
                </div>
              )}
              
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
