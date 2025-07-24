"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { QrCode, Clock, BookOpen, User, LogOut, Camera } from "lucide-react"
import Link from "next/link"
import { apiClient } from "@/lib/api"

interface Subject {
  id: string
  name: string
  code: string
  teacher: string
  schedule: string
  enrolled: boolean
  attendanceRate: number
}

export default function StudentDashboard() {
  const [user, setUser] = useState<any>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const router = useRouter()

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

    // Fetch real subjects data from backend
    apiClient.student.getSubjects(parsedUser.id)
      .then(data => {
        setSubjects(data.subjects || [])
      })
      .catch(() => setSubjects([]))
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
              <p className="text-sm text-gray-600">Student Dashboard</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrolled Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subjects.filter((s) => s.enrolled).length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Attendance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(() => {
                  const enrolledSubjects = subjects.filter((s) => s.enrolled);
                  if (enrolledSubjects.length === 0) return "0%";
                  
                  const totalAttendance = enrolledSubjects.reduce((acc, s) => {
                    const rate = typeof s.attendanceRate === 'number' && !isNaN(s.attendanceRate) ? s.attendanceRate : 0;
                    return acc + rate;
                  }, 0);
                  
                  const average = Math.round(totalAttendance / enrolledSubjects.length);
                  return `${average}%`;
                })()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              <QrCode className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Link href="/student/scan">
                <Button className="w-full">
                  <Camera className="w-4 h-4 mr-2" />
                  Scan QR Code
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">My Subjects</h2>
            <Link href="/student/scan">
              <Button>
                <QrCode className="w-4 h-4 mr-2" />
                Enroll in Subject
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <Card key={subject.id} className={subject.enrolled ? "" : "opacity-60"}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{subject.name}</CardTitle>
                      <CardDescription>{subject.code}</CardDescription>
                    </div>
                    <Badge variant={subject.enrolled ? "default" : "secondary"}>
                      {subject.enrolled ? "Enrolled" : "Available"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Teacher: {subject.teacher}</p>
                    <p className="text-sm text-gray-600">Schedule: {subject.schedule}</p>
                  </div>

                  {subject.enrolled && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Attendance Rate</span>
                        <span>{subject.attendanceRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${subject.attendanceRate}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    {subject.enrolled ? (
                      <>
                        <Link href={`/student/attendance/${subject.id}`} className="flex-1">
                          <Button variant="outline" className="w-full bg-transparent">
                            View Details
                          </Button>
                        </Link>
                        <Link href="/student/scan" className="flex-1">
                          <Button className="w-full">
                            <QrCode className="w-4 h-4 mr-2" />
                            Mark Attendance
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <Link href="/student/scan" className="w-full">
                        <Button variant="outline" className="w-full bg-transparent">
                          <QrCode className="w-4 h-4 mr-2" />
                          Enroll
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
