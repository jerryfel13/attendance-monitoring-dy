"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, BookOpen, Clock, AlertTriangle, User, LogOut, Plus, QrCode } from "lucide-react"
import Link from "next/link"
import { apiClient } from "@/lib/api"

interface Subject {
  id: string
  name: string
  code: string
  students: number
  schedule: string
  attendanceRate: number
  lateStudents: number
  absentStudents: number
}

export default function TeacherDashboard() {
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
    if (parsedUser.role !== "teacher") {
      router.push("/")
      return
    }

    setUser(parsedUser)

    // Fetch real subjects data from backend
    apiClient.teacher.getSubjects(parsedUser.id)
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

  const totalStudents = subjects.reduce((acc, s) => acc + s.students, 0)
  const avgAttendance = Math.round(subjects.reduce((acc, s) => acc + s.attendanceRate, 0) / subjects.length)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
              <p className="text-sm text-gray-600">Teacher Dashboard</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subjects.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgAttendance}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {subjects.reduce((acc, s) => acc + s.lateStudents + s.absentStudents, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">My Subjects</h2>
            <Link href="/teacher/create-subject">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Subject
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <Card key={subject.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{subject.name}</CardTitle>
                      <CardDescription>{subject.code}</CardDescription>
                    </div>
                    <Badge variant={subject.attendanceRate >= 80 ? "default" : "destructive"}>
                      {subject.attendanceRate}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Students</p>
                      <p className="font-semibold">{subject.students}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Schedule</p>
                      <p className="font-semibold text-xs">{subject.schedule}</p>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-600">Late: {subject.lateStudents}</span>
                    <span className="text-red-600">Absent: {subject.absentStudents}</span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${subject.attendanceRate >= 80 ? "bg-green-600" : "bg-red-600"}`}
                      style={{ width: `${subject.attendanceRate}%` }}
                    ></div>
                  </div>

                  <div className="flex space-x-2">
                    <Link href={`/teacher/subject/${subject.id}`} className="flex-1">
                      <Button variant="outline" className="w-full text-xs bg-transparent">
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/teacher/qr/${subject.id}`} className="flex-1">
                      <Button className="w-full text-xs">
                        <QrCode className="w-3 h-3 mr-1" />
                        QR Codes
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
