"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, LogOut } from "lucide-react"
import Link from "next/link"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface Subject {
  id: string
  name: string
  code: string
  description?: string
  schedule_days: string[]
  start_time: string
  end_time: string
  late_threshold: number
}

export default function EditSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use<{ id: string }>(params)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    schedule_days: [] as string[],
    start_time: "",
    end_time: "",
    late_threshold: 15
  })

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

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
        setFormData({
          name: data.subject.name || "",
          code: data.subject.code || "",
          description: data.subject.description || "",
          schedule_days: data.subject.schedule_days || [],
          start_time: data.subject.start_time || "",
          end_time: data.subject.end_time || "",
          late_threshold: data.subject.late_threshold || 15
        })
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [id, router])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      schedule_days: prev.schedule_days.includes(day)
        ? prev.schedule_days.filter(d => d !== day)
        : [...prev.schedule_days, day]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.code || !formData.start_time || !formData.end_time) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    if (formData.schedule_days.length === 0) {
      toast({
        title: "Schedule required",
        description: "Please select at least one day for the schedule.",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      await apiClient.teacher.updateSubject(id, formData)
      toast({
        title: "Subject updated successfully",
        description: `"${formData.name}" has been updated.`
      })
      router.push("/teacher/dashboard")
    } catch (error: any) {
      toast({
        title: "Error updating subject",
        description: error.message || "Failed to update subject",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
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
              <h1 className="text-xl font-semibold">Edit Subject</h1>
              <p className="text-sm text-gray-600">{subject.name} ({subject.code})</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Edit Subject Details</CardTitle>
              <CardDescription>Update the subject information below</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Subject Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Enter subject name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Subject Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => handleInputChange("code", e.target.value)}
                      placeholder="Enter subject code"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Enter subject description (optional)"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Schedule Days *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {daysOfWeek.map((day) => (
                      <Button
                        key={day}
                        type="button"
                        variant={formData.schedule_days.includes(day) ? "default" : "outline"}
                        onClick={() => handleDayToggle(day)}
                        className="text-sm"
                      >
                        {day.slice(0, 3)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Time *</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => handleInputChange("start_time", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Time *</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => handleInputChange("end_time", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="late_threshold">Late Threshold (minutes)</Label>
                    <Input
                      id="late_threshold"
                      type="number"
                      min="1"
                      max="60"
                      value={formData.late_threshold}
                      onChange={(e) => handleInputChange("late_threshold", parseInt(e.target.value) || 15)}
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <Button type="submit" disabled={saving} className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Link href="/teacher/dashboard" className="flex-1">
                    <Button type="button" variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
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