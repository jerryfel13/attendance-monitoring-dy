"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Users, Clock, Calendar, TrendingUp, AlertTriangle, User, LogOut, QrCode, Search, RotateCcw } from "lucide-react"
import Link from "next/link"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api"
import { Select as ShadSelect, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const { toast } = useToast();

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

    // Get active session for this subject
    apiClient.teacher.getActiveSession(id)
      .then(data => {
        if (data.session) {
          setActiveSession(data.session);
          setSelectedSessionId(String(data.session.id));
        }
      })
      .catch(() => {
        setActiveSession(null);
        setSelectedSessionId("");
      })
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

  // Update pending students when session attendance changes
  useEffect(() => {
    updatePendingStudents();
  }, [sessionAttendance, selectedSessionId]);

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

  const handleManualAttendanceUpdate = async (studentId: number, status: 'present' | 'late' | 'absent' | 'pending') => {
    if (!selectedSessionId) return;
    setAttendanceUpdateLoading((prev) => ({ ...prev, [studentId]: true }));
    setAttendanceUpdateResult((prev) => ({ ...prev, [studentId]: "" }));
    try {
      await apiClient.auth.manualAttendanceUpdate({
        sessionId: selectedSessionId,
        studentId: String(studentId),
        status,
      });
      
      let statusMessage = '';
      if (status === 'pending') {
        statusMessage = 'Student marked as pending (checked in). Set to present/late when they leave.';
      } else if (status === 'present' || status === 'late') {
        statusMessage = `Student marked as ${status} (checked out). Status automatically calculated based on check-in time and late threshold.`;
      } else {
        statusMessage = `Student marked as ${status}.`;
      }
      
      toast({ 
        title: "Attendance updated!", 
        description: statusMessage
      });
      setAttendanceUpdateResult((prev) => ({ ...prev, [studentId]: "" }));
      refetchAll();
    } catch (err: any) {
      toast({ title: "Error updating attendance", description: err.message || "Error", variant: "destructive" });
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

  const spinWheel = () => {
    if (pendingStudents.length === 0) {
      toast({
        title: "No pending students",
        description: "There are no pending students for recitation.",
        variant: "destructive"
      });
      return;
    }

    setIsSpinning(true);
    setSelectedStudent(null);

    // Simulate spinning animation
    const spinDuration = 3000; // 3 seconds
    const spinInterval = 100; // Change every 100ms
    const iterations = spinDuration / spinInterval;
    let currentIteration = 0;

    const spinIntervalId = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * pendingStudents.length);
      setSelectedStudent(pendingStudents[randomIndex]);
      currentIteration++;

      if (currentIteration >= iterations) {
        clearInterval(spinIntervalId);
        setIsSpinning(false);
        
        // Final selection
        const finalIndex = Math.floor(Math.random() * pendingStudents.length);
        const finalStudent = pendingStudents[finalIndex];
        setSelectedStudent(finalStudent);
        
        toast({
          title: "Student Selected!",
          description: `${finalStudent.name} has been selected for recitation.`,
          variant: "default"
        });
      }
    }, spinInterval);
  };

  const updatePendingStudents = () => {
    if (!selectedSessionId) {
      setPendingStudents([]);
      return;
    }

    // Get pending students from the current session attendance
    const pending = sessionAttendance.filter((student: any) => student.status === 'pending');
    setPendingStudents(pending);
  };

  function exportAttendanceToExcel() {
    const ws = XLSX.utils.json_to_sheet(sessionAttendance.map((s: any) => ({
      Name: s.name,
      "Student ID": s.student_id,
      Email: s.email,
      Status: s.status || "Not Scanned",
      "Check In": s.check_in_time ? new Date(s.check_in_time).toLocaleTimeString() : "-",
      "Check Out": s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString() : "-",
      "Notes": s.status === 'pending' ? 'Student checked in, waiting for check out' : 
               s.status === 'present' || s.status === 'late' ? 'Student completed attendance' :
               s.status === 'absent' ? 'Student marked absent' : 'No attendance record'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance_session_${selectedAttendanceSessionId}.xlsx`);
  }
  function exportAttendanceToPDF() {
    const doc = new jsPDF();
    doc.text("Attendance Report", 14, 16);
    (doc as any).autoTable({
      head: [["Name", "Student ID", "Email", "Status", "Check In", "Check Out", "Notes"]],
      body: sessionAttendance.map((s: any) => [
        s.name,
        s.student_id,
        s.email,
        s.status || "Not Scanned",
        s.check_in_time ? new Date(s.check_in_time).toLocaleTimeString() : "-",
        s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString() : "-",
        s.status === 'pending' ? 'Student checked in, waiting for check out' : 
        s.status === 'present' || s.status === 'late' ? 'Student completed attendance' :
        s.status === 'absent' ? 'Student marked absent' : 'No attendance record'
      ]),
      startY: 22,
    });
    doc.save(`attendance_session_${selectedAttendanceSessionId}.pdf`);
  }

  // Skeleton loading component
  const SubjectDetailsSkeleton = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Skeleton className="w-10 h-10" />
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

        <div className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
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

  if (loading) return <SubjectDetailsSkeleton />

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

  // Filter students based on search term
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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

      <main className="container mx-auto px-4 py-8 flex-1">
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
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search students by name, ID, or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Showing {filteredStudents.length} of {students.length} students
                  </div>
                </div>
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
                    {filteredStudents.map((student) => (
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
                            <ShadSelect
                              value=""
                              onValueChange={value => handleManualAttendanceUpdate(student.id, value as 'present' | 'late' | 'absent' | 'pending')}
                              disabled={!selectedSessionId || attendanceUpdateLoading[student.id]}
                            >
                              <SelectTrigger className="w-full">Update Status</SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending (Check In)</SelectItem>
                                <SelectItem value="present">Present (Auto-calculated)</SelectItem>
                                <SelectItem value="late">Late (Auto-calculated)</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                              </SelectContent>
                            </ShadSelect>
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
                          <TableCell>
                            <Badge 
                              variant={
                                student.status === 'present' ? 'default' :
                                student.status === 'late' ? 'secondary' :
                                student.status === 'pending' ? 'outline' :
                                student.status === 'absent' ? 'destructive' :
                                'secondary'
                              }
                            >
                              {student.status || "Not Scanned"}
                            </Badge>
                          </TableCell>
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
                  <Link href={`/teacher/qr/${subject.id}`} className="w-full">
                  <Button variant="outline" className="w-full">
                    <Calendar className="w-4 h-4 mr-2" />
                    Create Session
                  </Button>
                  </Link>
                  
                  {/* Recitation Spin Wheel */}
                  <div className="pt-4 border-t">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-semibold text-purple-900 mb-2">🎯 Recitation Spin Wheel</h3>
                      <p className="text-sm text-gray-600 mb-4">Randomly select a pending student for recitation</p>
                      
                      {/* Active Session Display */}
                      <div className="mb-4">
                        {activeSession ? (
                          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                            <div className="text-sm font-medium text-green-900 mb-1">Active Session:</div>
                            <div className="text-sm text-green-800">
                              {new Date(activeSession.session_date).toLocaleDateString()} at {activeSession.session_time}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="text-sm font-medium text-gray-900 mb-1">No Active Session</div>
                            <div className="text-sm text-gray-600">
                              Start a session in QR Management to enable recitation
                            </div>
                          </div>
                        )}
                      </div>
                      
                                             {/* Spin Wheel */}
                       {activeSession && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-center">
                            <div className="relative">
                              <div className={`w-24 h-24 rounded-full border-4 border-purple-300 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center transition-all duration-300 ${isSpinning ? 'animate-spin' : ''}`}>
                                {selectedStudent ? (
                                  <div className="text-center">
                                    <div className="text-sm font-bold text-purple-900">{selectedStudent.name}</div>
                                    <div className="text-xs text-purple-600">{selectedStudent.student_id}</div>
                                  </div>
                                ) : (
                                  <div className="text-center text-purple-600">
                                    <RotateCcw className="w-6 h-6 mx-auto mb-1" />
                                    <div className="text-xs">Click to spin</div>
                                  </div>
                                )}
                              </div>
                              {isSpinning && (
                                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-center">
                            <Button 
                              onClick={spinWheel}
                              disabled={isSpinning || pendingStudents.length === 0}
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              size="sm"
                            >
                              <RotateCcw className={`w-4 h-4 mr-2 ${isSpinning ? 'animate-spin' : ''}`} />
                              {isSpinning ? 'Spinning...' : 'Spin for Recitation'}
                            </Button>
                          </div>
                          
                          <div className="text-center">
                            <div className="text-sm font-medium text-purple-900">
                              {pendingStudents.length} pending students available
                            </div>
                          </div>
                          
                          {pendingStudents.length > 0 && (
                            <div className="mt-3">
                              <h4 className="text-sm font-medium text-purple-900 mb-2 text-center">Pending Students:</h4>
                              <div className="flex flex-wrap gap-1 justify-center">
                                {pendingStudents.map((student: any) => (
                                  <Badge 
                                    key={student.id} 
                                    variant={selectedStudent?.id === student.id ? "default" : "outline"}
                                    className={selectedStudent?.id === student.id ? "bg-purple-600" : ""}
                                  >
                                    {student.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {!activeSession && (
                        <div className="text-center text-gray-500 text-sm">
                          No active session. Start a session in QR Management to enable recitation.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
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