"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectTrigger, SelectContent, SelectValue } from "@/components/ui/select";
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
    apiClient.request(`/subjects/${params.id}`)
      .then((res: any) => setSubject(res.subject))
      .catch(() => setSubject(null));
    // Fetch sessions
    apiClient.request(`/subjects/${params.id}/sessions`)
      .then((res: any) => setSessions(res.sessions || []))
      .catch(() => setSessions([]));
    // Fetch all attendance records for this subject/student
    apiClient.request(`/student/${user.id}/attendance?subjectId=${params.id}`)
      .then((res: any) => setAttendance(res.attendance || []))
      .catch(() => setAttendance([]))
      .finally(() => setLoading(false));
  }, [user, params.id]);

  // Filter attendance by session if selected
  const filteredAttendance = selectedSession
    ? attendance.filter((a: any) => a.session_id === selectedSession)
    : attendance;

  return (
    <div className="container mx-auto px-4 py-8">
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
                <SelectItem value="">All Sessions</SelectItem>
                {sessions.map((session: any) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.session_date} {session.session_time}
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
                      <td className="border px-2 py-1">{record.session_date}</td>
                      <td className="border px-2 py-1">{record.session_time}</td>
                      <td className="border px-2 py-1">{record.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 