"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectTrigger, SelectContent, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function StudentAttendanceDetails({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [subject, setSubject] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Function to format session date and time
  const formatSessionDisplay = (session: any) => {
    try {
      const date = new Date(session.session_date);
      const time = session.session_time;
      
      // Format date as "Mon DD, YYYY"
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      // Format time as "HH:MM AM/PM"
      const formattedTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : '';
      
      return `${formattedDate} ${formattedTime}`;
    } catch (error) {
      // Fallback to original format if parsing fails
      return `${session.session_date} ${session.session_time}`;
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/auth/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    // Fetch subject info
    apiClient.request(`/subjects?route=get&id=${params.id}`)
      .then((res: any) => setSubject(res.subject))
      .catch(() => setSubject(null));
    // Fetch sessions
    apiClient.request(`/subjects?route=sessions&id=${params.id}`)
      .then((res: any) => setSessions(res.sessions || []))
      .catch(() => setSessions([]));
    // Fetch all attendance records for this subject/student
    apiClient.request(`/subjects?route=student-attendance&studentId=${user.id}&subjectId=${params.id}`)
      .then((res: any) => setAttendance(res.attendance || []))
      .catch(() => setAttendance([]))
      .finally(() => setLoading(false));
  }, [user, params.id]);

  // Filter attendance by session if selected
  const filteredAttendance = selectedSession && selectedSession !== "all"
    ? attendance.filter((a: any) => a.session_id === selectedSession)
    : attendance;

  // Debug logging
  console.log('Selected session:', selectedSession);
  console.log('All attendance records:', attendance);
  console.log('Filtered attendance records:', filteredAttendance);

  // Skeleton loading component
  const AttendanceSkeleton = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-6">
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center space-x-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-64" />
            </div>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex space-x-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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

  if (loading) return <AttendanceSkeleton />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => router.push("/student/dashboard")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      <Card>
        <CardHeader>
          <CardTitle>Attendance Details - {subject?.name || "Subject"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center space-x-4">
            <span>Filter by Session:</span>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {sessions.map((session: any) => (
                  <SelectItem key={session.id} value={session.id}>
                    {formatSessionDisplay(session)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead>
                <tr>
                  <th className="border px-2 py-1">Date</th>
                  <th className="border px-2 py-1">Time</th>
                  <th className="border px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="text-center">Loading...</td></tr>
                ) : filteredAttendance.length === 0 ? (
                  <tr><td colSpan={3} className="text-center">No attendance records found.</td></tr>
                ) : (
                  filteredAttendance.map((record: any) => (
                    <tr key={record.id}>
                        <td className="border px-2 py-1">{record.formatted_date || record.session_date}</td>
                        <td className="border px-2 py-1">{record.formatted_time || record.session_time}</td>
                      <td className="border px-2 py-1">{record.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
  );
} 