"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Users, Clock, Calendar, TrendingUp, AlertTriangle, User, LogOut, QrCode } from "lucide-react"
import Link from "next/link"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api"
import { Select } from "@/components/ui/select"
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface Student {
  id: number
  name: string
  email: string
  student_id: string
  attendance_rate: number
  total_sessions: number
  present_sessions: number
  late_sessions: number
  absent_sessions: number
}

interface AttendanceSession {
  id: number
  session_date: string
  session_time: string
  total_students: number
  present_count: number
  late_count: number
  absent_count: number
  attendance_rate: number
}

export default function SubjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use<{ id: string }>(params)
  const [subject, setSubject] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [attendanceUpdateLoading, setAttendanceUpdateLoading] = useState<{ [key: number]: boolean }>({});
  const [attendanceUpdateResult, setAttendanceUpdateResult] = useState<{ [key: number]: string }>({});
  const [selectedAttendanceSessionId, setSelectedAttendanceSessionId] = useState<string>("");
  const [sessionAttendance, setSessionAttendance] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState<number | null>(null);

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

    // Fetch subject details
    apiClient.teacher.getSubject(id)
      .then(data => {
        setSubject(data.subject)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })

    // Fetch students for this subject
    apiClient.teacher.getSubjectStudents(id)
      .then(data => {
        setStudents(data.students || [])
      })
      .catch(() => setStudents([]))

    // Fetch attendance sessions
    apiClient.teacher.getSubjectSessions(id)
      .then(data => {
        setSessions(data.sessions || [])
      })
      .catch(() => setSessions([]))
  }, [id, router])

  useEffect(() => {
    if (selectedAttendanceSessionId) {
      setAttendanceLoading(true);
      apiClient.auth.getSessionAttendance(selectedAttendanceSessionId)
        .then(data => {
          setSessionAttendance(data.students || []);
          setAttendanceLoading(false);
        })
        .catch(() => {
          setSessionAttendance([]);
          setAttendanceLoading(false);
        });
    } else {
      setSessionAttendance([]);
    }
  }, [selectedAttendanceSessionId]);

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  // Helper to refetch students, sessions, and session attendance
  const refetchAll = () => {
    apiClient.teacher.getSubjectStudents(id)
      .then(data => setStudents(data.students || []))
      .catch(() => setStudents([]));
    apiClient.teacher.getSubjectSessions(id)
      .then(data => setSessions(data.sessions || []))
      .catch(() => setSessions([]));
    if (selectedAttendanceSessionId) {
      setAttendanceLoading(true);
      apiClient.auth.getSessionAttendance(selectedAttendanceSessionId)
        .then(data => {
          setSessionAttendance(data.students || []);
          setAttendanceLoading(false);
        })
        .catch(() => {
          setSessionAttendance([]);
          setAttendanceLoading(false);
        });
    }
  };

  const handleManualAttendanceUpdate = async (studentId: number, status: 'present' | 'late' | 'absent') => {
    if (!selectedSessionId) return;
    setAttendanceUpdateLoading((prev) => ({ ...prev, [studentId]: true }));
    setAttendanceUpdateResult((prev) => ({ ...prev, [studentId]: "" }));
    try {
      await apiClient.auth.manualAttendanceUpdate({
        sessionId: selectedSessionId,
        studentId: String(studentId),
        status,
      });
      setAttendanceUpdateResult((prev) => ({ ...prev, [studentId]: "Updated!" }));
      refetchAll();
    } catch (err: any) {
      setAttendanceUpdateResult((prev) => ({ ...prev, [studentId]: err.message || "Error" }));
    } finally {
      setAttendanceUpdateLoading((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    setRemovingStudentId(studentId);
    try {
      await apiClient.auth.removeStudentFromSubject({ subjectId: id, studentId: String(studentId) });
      refetchAll();
    } catch (err) {
      // Optionally show error
    } finally {
      setRemovingStudentId(null);
    }
  };

  function exportAttendanceToExcel() {
    const ws = XLSX.utils.json_to_sheet(sessionAttendance.map((s: any) => ({
      Name: s.name,
      "Student ID": s.student_id,
      Email: s.email,
      Status: s.status || "-",
      "Check In": s.check_in_time ? new Date(s.check_in_time).toLocaleTimeString() : "-",
      "Check Out": s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString() : "-",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance_session_${selectedAttendanceSessionId}.xlsx`);
  }
  function exportAttendanceToPDF() {
    const doc = new jsPDF();
    doc.text("Attendance Report", 14, 16);
    (doc as any).autoTable({
      head: [["Name", "Student ID", "Email", "Status", "Check In", "Check Out"]],
      body: sessionAttendance.map((s: any) => [
        s.name,
        s.student_id,
        s.email,
        s.status || "-",
        s.check_in_time ? new Date(s.check_in_time).toLocaleTimeString() : "-",
        s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString() : "-",
      ]),
      startY: 22,
    });
    doc.save(`attendance_session_${selectedAttendanceSessionId}.pdf`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subject details...</p>
        </div>
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Subject Not Found</h1>
          <Link href="/teacher/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const totalStudents = students.length
  const avgAttendance = sessions.length > 0 
    ? Math.round(sessions.reduce((acc, s) => acc + (isNaN(s.attendance_rate) ? 0 : s.attendance_rate), 0) / sessions.length)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/teacher/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">{subject.name}</h1>
              <p className="text-sm text-gray-600">{subject.code}</p>
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
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sessions.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isNaN(avgAttendance) ? 0 : avgAttendance}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Schedule</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {subject.schedule_days?.join(", ") || "Not set"}
              </div>
              <div className="text-xs text-gray-600">
                {subject.start_time} - {subject.end_time}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="sessions">Attendance Sessions</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Enrolled Students</CardTitle>
                <CardDescription>List of all students enrolled in this subject</CardDescription>
                <div className="mt-4">
                  <Label>Select Session for Manual Attendance Update</Label>
                  <select
                    className="border rounded px-2 py-1 ml-2"
                    value={selectedSessionId}
                    onChange={e => setSelectedSessionId(e.target.value)}
                  >
                    <option value="">-- Select Session --</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {new Date(session.session_date).toLocaleDateString()} {session.session_time}
                      </option>
                    ))}
                  </select>
                  <span className="ml-2 text-xs text-gray-500">(Choose a session to enable manual update)</span>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Attendance Rate</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Manual Update</TableHead>
                      <TableHead>Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>
                          <Badge variant={typeof student.attendance_rate === 'number' && !isNaN(student.attendance_rate) && student.attendance_rate >= 80 ? "default" : "destructive"}>
                            {typeof student.attendance_rate === 'number' && !isNaN(student.attendance_rate) ? `${student.attendance_rate}%` : '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>{student.present_sessions}</TableCell>
                        <TableCell>{student.late_sessions}</TableCell>
                        <TableCell>{student.absent_sessions}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!selectedSessionId || attendanceUpdateLoading[student.id]}
                              onClick={() => handleManualAttendanceUpdate(student.id, "present")}
                            >
                              Present
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!selectedSessionId || attendanceUpdateLoading[student.id]}
                              onClick={() => handleManualAttendanceUpdate(student.id, "late")}
                            >
                              Late
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!selectedSessionId || attendanceUpdateLoading[student.id]}
                              onClick={() => handleManualAttendanceUpdate(student.id, "absent")}
                            >
                              Absent
                            </Button>
                            {attendanceUpdateResult[student.id] && (
                              <span className="text-xs text-green-600">{attendanceUpdateResult[student.id]}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={removingStudentId === student.id}
                            onClick={() => handleRemoveStudent(student.id)}
                          >
                            {removingStudentId === student.id ? "Removing..." : "Remove"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Sessions</CardTitle>
                <CardDescription>History of all attendance sessions for this subject</CardDescription>
                <div className="mt-4">
                  <Label>Select Session to View Attendance</Label>
                  <select
                    className="border rounded px-2 py-1 ml-2"
                    value={selectedAttendanceSessionId}
                    onChange={e => setSelectedAttendanceSessionId(e.target.value)}
                  >
                    <option value="">-- Select Session --</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {new Date(session.session_date).toLocaleDateString()} {session.session_time}
                      </option>
                    ))}
                  </select>
                  <span className="ml-2 text-xs text-gray-500">(Choose a session to view and export attendance)</span>
                </div>
                {sessionAttendance.length > 0 && (
                  <div className="flex gap-2 mt-4">
                    <Button onClick={exportAttendanceToExcel} variant="outline">Export to Excel</Button>
                    <Button onClick={exportAttendanceToPDF} variant="outline">Export to PDF</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {attendanceLoading ? (
                  <div className="text-center text-gray-500">Loading attendance...</div>
                ) : sessionAttendance.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionAttendance.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>{student.name}</TableCell>
                          <TableCell>{student.student_id}</TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{student.status || "-"}</TableCell>
                          <TableCell>{student.check_in_time ? new Date(student.check_in_time).toLocaleTimeString() : "-"}</TableCell>
                          <TableCell>{student.check_out_time ? new Date(student.check_out_time).toLocaleTimeString() : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : selectedAttendanceSessionId ? (
                  <div className="text-center text-gray-500">No attendance records for this session.</div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Subject Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Subject Name</Label>
                    <p className="text-lg">{subject.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Subject Code</Label>
                    <p className="text-lg">{subject.code}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-gray-600">{subject.description || "No description"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Schedule</Label>
                    <p className="text-sm">{subject.schedule_days?.join(", ") || "Not set"}</p>
                    <p className="text-xs text-gray-600">{subject.start_time} - {subject.end_time}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Late Threshold</Label>
                    <p className="text-sm">{subject.late_threshold} minutes</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link href={`/teacher/qr/${subject.id}`} className="w-full">
                    <Button className="w-full">
                      <QrCode className="w-4 h-4 mr-2" />
                      Manage QR Codes
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full">
                    <Calendar className="w-4 h-4 mr-2" />
                    Create Session
                  </Button>
                  <Button variant="outline" className="w-full">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
} 