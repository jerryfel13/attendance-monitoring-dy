"use client"

import { Label } from "@/components/ui/label"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, QrCode, Download, RefreshCw, Copy, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function QRManagementPage({ params }: { params: { id: string } }) {
  const [subject, setSubject] = useState<any>(null)
  const [enrollmentQR, setEnrollmentQR] = useState("")
  const [attendanceQR, setAttendanceQR] = useState("")
  const [copied, setCopied] = useState("")
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/auth/login?role=teacher")
      return
    }

    // Mock subject data
    setSubject({
      id: params.id,
      name: "Data Structures",
      code: "CS201",
      students: 45,
      schedule: "Mon, Wed, Fri 10:00 AM",
    })

    // Generate QR codes
    setEnrollmentQR(`SUBJECT:Data Structures (CS201)`)
    setAttendanceQR(`ATTENDANCE:Data Structures (CS201) - ${new Date().toLocaleDateString()}`)
  }, [params.id, router])

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
    const newQR = `ATTENDANCE:${subject.name} (${subject.code}) - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
    setAttendanceQR(newQR)
  }

  if (!subject) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
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

      <main className="container mx-auto px-4 py-8">
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
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="default">Active</Badge>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="enrollment" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="enrollment">Enrollment QR</TabsTrigger>
              <TabsTrigger value="attendance">Attendance QR</TabsTrigger>
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
                    <div className="w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <QrCode className="w-24 h-24 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-600">QR Code Preview</p>
                      </div>
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
                    <div className="w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <QrCode className="w-24 h-24 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-600">QR Code Preview</p>
                        <Badge variant="secondary" className="mt-2">
                          Session: {new Date().toLocaleDateString()}
                        </Badge>
                      </div>
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
