"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, QrCode, CheckCircle, Plus } from "lucide-react"
import Link from "next/link"
import { apiClient } from "@/lib/api"

export default function CreateSubjectPage() {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    schedule: "",
    days: [] as string[],
    lateThreshold: "15",
  })
  const [timeSlots, setTimeSlots] = useState([
    { startTime: "", endTime: "", days: [] as string[] }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [qrCode, setQrCode] = useState("")
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/auth/login?role=teacher")
      return
    }
  }, [router])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }))
  }

  const handleTimeSlotChange = (index: number, field: string, value: string) => {
    setTimeSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, [field]: value } : slot
    ))
  }

  const handleTimeSlotDayToggle = (slotIndex: number, day: string) => {
    setTimeSlots(prev => prev.map((slot, i) => 
      i === slotIndex ? {
        ...slot,
        days: slot.days.includes(day) ? slot.days.filter((d) => d !== day) : [...slot.days, day]
      } : slot
    ))
  }

  const addTimeSlot = () => {
    setTimeSlots(prev => [...prev, { startTime: "", endTime: "", days: [] }])
  }

  const removeTimeSlot = (index: number) => {
    if (timeSlots.length > 1) {
      setTimeSlots(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const userData = localStorage.getItem("user")
      if (!userData) {
        router.push("/auth/login")
        return
      }
      const user = JSON.parse(userData)

      // Validate that at least one time slot has complete information
      const validTimeSlots = timeSlots.filter(slot => 
        slot.startTime && slot.endTime && slot.days.length > 0
      )
      
      if (validTimeSlots.length === 0) {
        alert("Please add at least one complete time slot with days selected")
        return
      }

      // For now, we'll use the first time slot for the main subject creation
      // In a full implementation, you might want to create multiple subjects or modify the backend
      const firstSlot = validTimeSlots[0]
      
      const data = await apiClient.teacher.createSubject({
        name: formData.name,
        code: formData.code,
        description: formData.description,
        teacher_id: user.id,
        schedule_days: firstSlot.days,
        start_time: firstSlot.startTime,
        end_time: firstSlot.endTime,
        late_threshold: parseInt(formData.lateThreshold),
      })
      if (!data || !data.subject) {
        console.error("Failed to create subject:", data?.error)
        return
      }

      // Generate QR code data
      const qrData = `SUBJECT:${formData.name} (${formData.code})`
      setQrCode(qrData)
      setSuccess(true)
    } catch (error) {
      console.error("Failed to create subject:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center space-x-4">
              <Link href="/teacher/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">Subject Created Successfully</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 flex-1">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-green-600">Subject Created!</CardTitle>
                <CardDescription>
                  {formData.name} ({formData.code}) has been created successfully
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="w-32 h-32 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-16 h-16 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium mb-2">Enrollment QR Code</p>
                  <p className="text-xs text-gray-600 break-all bg-white p-2 rounded border">{qrCode}</p>
                </div>

                <Alert>
                  <AlertDescription>
                    Share this QR code with students to allow them to enroll in your subject.
                  </AlertDescription>
                </Alert>

                <div className="flex space-x-2">
                  <Link href="/teacher/dashboard" className="flex-1">
                    <Button variant="outline" className="w-full bg-transparent">
                      Back to Dashboard
                    </Button>
                  </Link>
                  <Link href={`/teacher/qr/${Date.now()}`} className="flex-1">
                    <Button className="w-full">Manage QR Codes</Button>
                  </Link>
                </div>
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/teacher/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Create New Subject</h1>
              <p className="text-sm text-gray-600">Set up a new subject with QR codes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Subject Information</CardTitle>
              <CardDescription>Fill in the details for your new subject</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Subject Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Data Structures"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Subject Code</Label>
                    <Input
                      id="code"
                      placeholder="e.g., CS201"
                      value={formData.code}
                      onChange={(e) => handleInputChange("code", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the subject"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Class Schedule</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTimeSlot}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Time Slot
                    </Button>
                  </div>
                  
                  {timeSlots.map((slot, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Time Slot {index + 1}</Label>
                        {timeSlots.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeTimeSlot(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => handleTimeSlotChange(index, "startTime", e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => handleTimeSlotChange(index, "endTime", e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Days</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {days.map((day) => (
                            <Button
                              key={day}
                              type="button"
                              variant={slot.days.includes(day) ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleTimeSlotDayToggle(index, day)}
                            >
                              {day.slice(0, 3)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lateThreshold">Late Threshold (minutes)</Label>
                  <Select onValueChange={(value) => handleInputChange("lateThreshold", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select late threshold" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="20">20 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating Subject..." : "Create Subject & Generate QR"}
                </Button>
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
