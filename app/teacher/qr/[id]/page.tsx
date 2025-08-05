"use client"

import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, QrCode, Download, RefreshCw, Copy, CheckCircle, ZoomIn, X } from "lucide-react"
import Link from "next/link"
import QRCode from 'react-qr-code'
import { apiClient } from "@/lib/api"

export default function QRManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { toast } = useToast();
  const [id, setId] = useState<string>("");
  const [subject, setSubject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [enrollmentQR, setEnrollmentQR] = useState("")
  const [attendanceQR, setAttendanceQR] = useState("")
  const [attendanceOutQR, setAttendanceOutQR] = useState("");
  const [copied, setCopied] = useState("")
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [manualInCode, setManualInCode] = useState<string>("");
  const [manualOutCode, setManualOutCode] = useState<string>("");
  const [manualInLoading, setManualInLoading] = useState(false);
  const [manualOutLoading, setManualOutLoading] = useState(false);
  const [pendingCodes, setPendingCodes] = useState<any[]>([]);
  const [pendingCodesLoading, setPendingCodesLoading] = useState(false);
  const [searchStudent, setSearchStudent] = useState<string>("");
  const [searchedCode, setSearchedCode] = useState<any>(null);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [previewQrData, setPreviewQrData] = useState("");
  const [previewQrTitle, setPreviewQrTitle] = useState("");
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    })();
  }, [params]);

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/auth/login")
      return
    }
    // Fetch subject from backend
    apiClient.teacher.getSubject(id)
      .then(data => {
        setSubject(data.subject)
        // Simplified QR codes for better scanning
        setEnrollmentQR(`SUBJECT_${data.subject.name.replace(/\s+/g, '_')}_${data.subject.code}`)
        setAttendanceQR(`ATTENDANCE_IN_${data.subject.name.replace(/\s+/g, '_')}_${data.subject.code}_${new Date().toISOString().split('T')[0]}`)
        setAttendanceOutQR(`ATTENDANCE_OUT_${data.subject.name.replace(/\s+/g, '_')}_${data.subject.code}_${new Date().toISOString().split('T')[0]}`)
      })
      .catch(() => setSubject(null))
      .finally(() => setLoading(false))
    // Check for active session
    checkActiveSession()
  }, [id, router])

  const checkActiveSession = async () => {
    try {
      const data = await apiClient.teacher.getActiveSession(id)
      if (data.session) {
        setSessionActive(true)
        setSessionId(data.session.id)
      }
    } catch (error) {
      console.error('Error checking active session:', error)
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(""), 2000)
    } catch (err) {
      console.error("Failed to copy text")
    }
  }

  const regenerateAttendanceQR = () => {
    const newQR = `ATTENDANCE_IN_${subject.name.replace(/\s+/g, '_')}_${subject.code}_${new Date().toISOString().split('T')[0]}`
    setAttendanceQR(newQR)
    setAttendanceOutQR(`ATTENDANCE_OUT_${subject.name.replace(/\s+/g, '_')}_${subject.code}_${new Date().toISOString().split('T')[0]}`)
  }

  const startAttendanceSession = async () => {
    try {
      const qrData = `ATTENDANCE_IN_${subject.name.replace(/\s+/g, '_')}_${subject.code}_${new Date().toISOString().split('T')[0]}`
      setAttendanceQR(qrData)
      
      // Always use the current time when the session is actually started
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, '0')
      const minutes = now.getMinutes().toString().padStart(2, '0')
      const seconds = now.getSeconds().toString().padStart(2, '0')
      const sessionTime = `${hours}:${minutes}:${seconds}`
      
      console.log('Current time when starting session:', sessionTime)
      console.log('Subject start_time (if any):', subject.start_time)
      
      const data = await apiClient.teacher.startSession(id, {
        session_date: new Date().toISOString().split('T')[0],
        session_time: sessionTime, // Use subject's scheduled start time
        is_active: true,
        attendance_qr: qrData
      })
      if (data && data.session) {
        setSessionActive(true)
        setSessionId(data.session.id)
        console.log('Attendance session started successfully with time:', sessionTime)
      } else {
        console.error('Failed to start attendance session')
      }
    } catch (error) {
      console.error('Error starting attendance session:', error)
    }
  }

  const stopAttendanceSession = async () => {
    if (!sessionId) return
    try {
      const data = await apiClient.teacher.stopSession(String(sessionId))
      if (data) {
        setSessionActive(false)
        setSessionId(null)
        console.log('Attendance session stopped successfully')
        
        // Clear all generated codes for this session
        try {
          await apiClient.auth.clearSessionCodes(String(sessionId))
          console.log('Session codes cleared successfully')
          // Clear local state
          setPendingCodes([])
          setSearchStudent("")
          setSearchedCode(null)
        } catch (clearError) {
          console.error('Error clearing session codes:', clearError)
        }
      } else {
        console.error('Failed to stop attendance session')
      }
    } catch (error) {
      console.error('Error stopping attendance session:', error)
    }
  }

  const generateManualInCode = async () => {
    if (!sessionId) return;
    setManualInLoading(true);
    try {
      const data = await apiClient.auth.generateManualCode({ sessionId: String(sessionId), type: 'in' });
      setManualInCode(data.code);
    } catch (err) {
      setManualInCode('Error');
    } finally {
      setManualInLoading(false);
    }
  };
  const generateManualOutCode = async () => {
    if (!sessionId) return;
    setManualOutLoading(true);
    try {
      const data = await apiClient.auth.generateManualCode({ sessionId: String(sessionId), type: 'out' });
      setManualOutCode(data.code);
    } catch (err) {
      setManualOutCode('Error');
    } finally {
      setManualOutLoading(false);
    }
  };

  const generatePendingCodes = async (type: 'in' | 'out') => {
    if (!sessionId) return;
    setPendingCodesLoading(true);
    try {
      const data = await apiClient.auth.generatePendingCodes({ sessionId: String(sessionId), type });
      setPendingCodes(data.codes || []);
      // Clear search when generating new codes
      setSearchStudent("");
      setSearchedCode(null);
      toast({
        title: "Success",
        description: data.message,
        variant: "default"
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to generate pending codes",
        variant: "destructive"
      });
    } finally {
      setPendingCodesLoading(false);
    }
  };

  const clearPendingCodes = () => {
    setPendingCodes([]);
    setSearchStudent("");
    setSearchedCode(null);
  };

  const clearSessionCodes = async () => {
    if (!sessionId) return;
    try {
      await apiClient.auth.clearSessionCodes(String(sessionId));
      clearPendingCodes();
      toast({
        title: "Success",
        description: "All session codes cleared",
        variant: "default"
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to clear session codes",
        variant: "destructive"
      });
    }
  };

  const searchStudentCode = () => {
    if (!searchStudent.trim() || pendingCodes.length === 0) {
      setSearchedCode(null);
      return;
    }
    
    const foundCode = pendingCodes.find(code => 
      code.studentName.toLowerCase().includes(searchStudent.toLowerCase()) ||
      code.studentNumber.toLowerCase().includes(searchStudent.toLowerCase())
    );
    
    setSearchedCode(foundCode || null);
  };

  // Clear codes when switching tabs
  useEffect(() => {
    clearPendingCodes();
  }, []);

  const openQrPreview = (qrData: string, title: string) => {
    setPreviewQrData(qrData);
    setPreviewQrTitle(title);
    setQrPreviewOpen(true);
  }

  // Skeleton loading component
  const QRSkeleton = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b flex-shrink-0">
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

      <main className="container mx-auto px-4 py-8 flex-1 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <Skeleton className="w-64 h-64 rounded-lg" />
                </div>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
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

  if (!subject) return null
  if (loading) return <QRSkeleton />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/teacher/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">QR Code Management</h1>
              <p className="text-sm text-gray-600">
                {subject.name} ({subject.code})
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subject.students}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">{subject.schedule}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Session Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={sessionActive ? "default" : "secondary"}>
                  {sessionActive ? "Active" : "Inactive"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="enrollment" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="enrollment">Enrollment QR</TabsTrigger>
              <TabsTrigger value="attendance">Attendance In QR</TabsTrigger>
              <TabsTrigger value="attendance-out">Attendance Out QR</TabsTrigger>
            </TabsList>

            <TabsContent value="enrollment" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <QrCode className="w-5 h-5" />
                    <span>Subject Enrollment QR Code</span>
                  </CardTitle>
                  <CardDescription>Students scan this code to enroll in your subject</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    <div className="relative w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <QRCode 
                          value={enrollmentQR} 
                          size={200} 
                          level="H"
                          className="mx-auto mb-4" 
                        />
                        <p className="text-sm text-gray-600">QR Code Preview</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                        onClick={() => openQrPreview(enrollmentQR, "Enrollment QR Code")}
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">QR Code Data:</Label>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(enrollmentQR, "enrollment")}>
                        {copied === "enrollment" ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm font-mono bg-white p-2 rounded border break-all">{enrollmentQR}</p>
                  </div>

                  <div className="flex space-x-2">
                    <Button className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Download QR
                    </Button>
                    <Button variant="outline" className="flex-1 bg-transparent">
                      <QrCode className="w-4 h-4 mr-2" />
                      Print QR
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <QrCode className="w-5 h-5" />
                      <span>Attendance QR Code</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={regenerateAttendanceQR}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </CardTitle>
                  <CardDescription>Students scan this code during class to mark attendance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    <div className="relative w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <QRCode 
                          value={attendanceQR} 
                          size={200} 
                          level="H"
                          className="mx-auto mb-4" 
                        />
                        <p className="text-sm text-gray-600">QR Code Preview</p>
                        <Badge variant="secondary" className="mt-2">
                          Session: {new Date().toLocaleDateString()}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                        onClick={() => openQrPreview(attendanceQR, "Attendance QR Code")}
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">QR Code Data:</Label>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(attendanceQR, "attendance")}>
                        {copied === "attendance" ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm font-mono bg-white p-2 rounded border break-all">{attendanceQR}</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Usage Instructions:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Display this QR code at the beginning of each class</li>
                      <li>• Students have 15 minutes after class start to scan</li>
                      <li>• Regenerate for each new class session</li>
                      <li>• Monitor real-time attendance in the dashboard</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                  <div className="flex space-x-2">
                    <Button className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Download QR
                    </Button>
                    <Button variant="outline" className="flex-1 bg-transparent">
                      <QrCode className="w-4 h-4 mr-2" />
                      Display QR
                    </Button>
                    </div>
                    
                    <div className="flex space-x-2">
                      {sessionActive ? (
                        <Button 
                          variant="destructive" 
                          className="flex-1"
                          onClick={stopAttendanceSession}
                        >
                          Stop Session
                        </Button>
                      ) : (
                        <Button 
                          className="flex-1"
                          onClick={startAttendanceSession}
                        >
                          Start Attendance Session
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={regenerateAttendanceQR}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate QR
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button onClick={generateManualInCode} disabled={manualInLoading || !sessionActive} className="w-full mb-2">
                      {manualInLoading ? 'Generating...' : 'Generate Manual Code (In)'}
                    </Button>
                    {manualInCode && (
                      <div className="text-center mt-2">
                        <span className="font-mono text-lg bg-gray-100 px-4 py-2 rounded">{manualInCode}</span>
                        <span className="ml-2 text-xs text-gray-500">Give this code to the student for manual attendance in</span>
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        onClick={() => generatePendingCodes('in')} 
                        disabled={pendingCodesLoading || !sessionActive} 
                        variant="outline"
                        className="w-full mb-2"
                      >
                        {pendingCodesLoading ? 'Generating...' : 'Generate Codes for All Enrolled Students (In)'}
                      </Button>
                      <div className="text-xs text-gray-500 mt-1 mb-2">
                        Note: All generated codes will be automatically cleared when the session is stopped.
                      </div>
                      <div className="text-xs text-blue-600 mt-1 mb-2 bg-blue-50 p-2 rounded">
                        💡 <strong>Purpose:</strong> These codes are for students who can't scan QR codes or don't have devices to scan. They can manually enter these codes on the student scan page.
                      </div>
                      
                      {pendingCodes.length > 0 && (
                        <div className="mt-4">
                          <div className="bg-blue-50 p-3 rounded-lg mb-4">
                            <h4 className="font-medium text-blue-900 mb-2">🔒 Secure Code Distribution</h4>
                            <p className="text-sm text-blue-800 mb-3">
                              Codes are hidden to prevent sharing. Search for a specific student to reveal their code.
                            </p>
                            <div className="flex space-x-2">
                              <input
                                type="text"
                                placeholder="Search by student name or ID..."
                                value={searchStudent}
                                onChange={(e) => setSearchStudent(e.target.value)}
                                className="flex-1 px-3 py-2 border rounded text-sm"
                              />
                              <Button 
                                onClick={searchStudentCode}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Search
                              </Button>
                            </div>
                          </div>
                          
                          {searchedCode && (
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                              <h5 className="font-medium text-green-900 mb-2">Found Student:</h5>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{searchedCode.studentName}</div>
                                  <div className="text-sm text-gray-600">ID: {searchedCode.studentNumber}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 mb-1">Attendance Code:</div>
                                  <span className="font-mono text-lg bg-white px-3 py-2 rounded border">
                                    {searchedCode.code}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-4">
                            <h4 className="font-medium mb-2">📋 Generated Codes Summary:</h4>
                            <div className="text-sm text-gray-600">
                              • Total codes generated: <span className="font-medium">{pendingCodes.length}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              • Search above to find specific student codes
                            </div>
                            <div className="mt-3">
                              <Button 
                                onClick={clearSessionCodes}
                                variant="outline" 
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                Clear All Codes
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance-out" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <QrCode className="w-5 h-5" />
                      <span>Attendance Out QR Code</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={regenerateAttendanceQR}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </CardTitle>
                  <CardDescription>Students scan this code at the end of class to confirm their attendance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    <div className="relative w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <QRCode 
                          value={attendanceOutQR} 
                          size={200} 
                          level="H"
                          className="mx-auto mb-4" 
                        />
                        <p className="text-sm text-gray-600">QR Code Preview</p>
                        <Badge variant="secondary" className="mt-2">
                          Session: {new Date().toLocaleDateString()}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                        onClick={() => openQrPreview(attendanceOutQR, "Attendance Out QR Code")}
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">QR Code Data:</Label>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(attendanceOutQR, "attendance-out")}> 
                        {copied === "attendance-out" ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm font-mono bg-white p-2 rounded border break-all">{attendanceOutQR}</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Usage Instructions:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Display this QR code at the end of each class</li>
                      <li>• Students must scan out to confirm their attendance</li>
                      <li>• If a student does not scan out, they will be marked absent</li>
                    </ul>
                  </div>
                  <div className="mt-4">
                    <Button onClick={generateManualOutCode} disabled={manualOutLoading || !sessionActive} className="w-full mb-2">
                      {manualOutLoading ? 'Generating...' : 'Generate Manual Code (Out)'}
                    </Button>
                    {manualOutCode && (
                      <div className="text-center mt-2">
                        <span className="font-mono text-lg bg-gray-100 px-4 py-2 rounded">{manualOutCode}</span>
                        <span className="ml-2 text-xs text-gray-500">Give this code to the student for manual attendance out</span>
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        onClick={() => generatePendingCodes('out')} 
                        disabled={pendingCodesLoading || !sessionActive} 
                        variant="outline"
                        className="w-full mb-2"
                      >
                        {pendingCodesLoading ? 'Generating...' : 'Generate Codes for Pending Students (Out)'}
                      </Button>
                      <div className="text-xs text-gray-500 mt-1">
                        Note: Attendance-out codes are visible for all pending students since they need to scan out.
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Note: All generated codes will be automatically cleared when the session is stopped.
                      </div>
                      <div className="text-xs text-blue-600 mt-1 mb-2 bg-blue-50 p-2 rounded">
                        💡 <strong>Purpose:</strong> These codes are for students who can't scan QR codes or don't have devices to scan. They can manually enter these codes on the student scan page.
                      </div>
                      {pendingCodes.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Pending Student Codes:</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {pendingCodes.map((codeData, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{codeData.studentName}</div>
                                  <div className="text-xs text-gray-500">ID: {codeData.studentNumber}</div>
                                </div>
                                <span className="font-mono text-lg bg-white px-3 py-1 rounded border">
                                  {codeData.code}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      {/* QR Preview Modal */}
      <Dialog open={qrPreviewOpen} onOpenChange={setQrPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewQrTitle}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQrPreviewOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-4 rounded-lg border">
              <QRCode 
                value={previewQrData} 
                size={300} 
                level="H"
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Scan this QR code with your device</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(previewQrData, "preview")}
              >
                {copied === "preview" ? (
                  <CheckCircle className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                Copy QR Data
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
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
