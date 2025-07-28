"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, BookOpen, Clock, AlertTriangle, User, LogOut, Plus, QrCode, MoreVertical, Edit, Trash2 } from "lucide-react"
import Link from "next/link"
import { apiClient } from "@/lib/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

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
  const [loading, setLoading] = useState(true)
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const router = useRouter()
  const { toast } = useToast()

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
      .finally(() => setLoading(false))
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const handleEditSubject = (subjectId: string) => {
    // Navigate to edit page (you can create a separate edit page or use a modal)
    router.push(`/teacher/edit-subject/${subjectId}`)
  }

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    setShowDeleteConfirm({ id: subjectId, name: subjectName })
  }

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return

    const { id: subjectId, name: subjectName } = showDeleteConfirm
    setDeletingSubjectId(subjectId)
    setShowDeleteConfirm(null)
    
    try {
      await apiClient.teacher.deleteSubject(subjectId)
      toast({
        title: "Subject deleted",
        description: `"${subjectName}" has been successfully deleted.`,
      })
      // Refresh subjects list
      const updatedSubjects = subjects.filter(s => s.id !== subjectId)
      setSubjects(updatedSubjects)
    } catch (error: any) {
      toast({
        title: "Error deleting subject",
        description: error.message || "Failed to delete subject",
        variant: "destructive"
      })
    } finally {
      setDeletingSubjectId(null)
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(null)
  }

  // Skeleton loading component
  const DashboardSkeleton = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="grid lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
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

  if (!user) return null
  if (loading) return <DashboardSkeleton />

  const totalStudents = subjects.reduce((acc, s) => acc + s.students, 0)
  const avgAttendance = subjects.length > 0 ? Math.round(subjects.reduce((acc, s) => acc + (isNaN(s.attendanceRate) ? 0 : s.attendanceRate), 0) / subjects.length) : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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

      <main className="container mx-auto px-4 py-8 flex-1">
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
              <div className="text-2xl font-bold">{isNaN(avgAttendance) ? 0 : avgAttendance}%</div>
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
                    <div className="flex items-center space-x-2">
                      <Badge variant={typeof subject.attendanceRate === 'number' && !isNaN(subject.attendanceRate) && subject.attendanceRate >= 80 ? "default" : "destructive"}>
                        {typeof subject.attendanceRate === 'number' && !isNaN(subject.attendanceRate) ? `${subject.attendanceRate}%` : '-'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditSubject(subject.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Subject
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteSubject(subject.id, subject.name)}
                            className="text-red-600 focus:text-red-600"
                            disabled={deletingSubjectId === subject.id}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {deletingSubjectId === subject.id ? 'Deleting...' : 'Delete Subject'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
                      style={{ width: `${typeof subject.attendanceRate === 'number' && !isNaN(subject.attendanceRate) ? subject.attendanceRate : 0}%` }}
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
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Subject</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{showDeleteConfirm?.name}"? This action cannot be undone and will remove all associated data including enrollments, attendance records, and sessions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deletingSubjectId === showDeleteConfirm?.id}
            >
              {deletingSubjectId === showDeleteConfirm?.id ? "Deleting..." : "Delete Subject"}
            </Button>
          </DialogFooter>
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
