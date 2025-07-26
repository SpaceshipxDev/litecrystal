"use client"

import type { Task } from "@/types"
import { useState, useRef, useEffect } from "react"
import { Folder, Plus, Loader2, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface CreateJobFormProps {
  onJobCreated: (task: Task) => void
}

export default function CreateJobForm({ onJobCreated }: CreateJobFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [representative, setRepresentative] = useState("")
  const [inquiryDate, setInquiryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [customerOptions, setCustomerOptions] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inquiryDateInputRef = useRef<HTMLInputElement>(null)

  const openInquiryDatePicker = () => {
    const input = inquiryDateInputRef.current
    if (!input) return
    if ((input as any).showPicker) {
      (input as any).showPicker()
    } else {
      input.focus()
      input.click()
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/jobs')
        if (res.ok) {
          const data = await res.json()
          const taskValues = Object.values(data.tasks || {}) as Task[]
          const names = Array.from(new Set(taskValues.map((t) => t.customerName)))
          setCustomerOptions(names)
        }
      } catch {}
    })()
  }, [])

  const getFolderName = (): string => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return "选择文件夹"
    }
    const firstPath = (selectedFiles[0] as any).webkitRelativePath || ""
    return firstPath.split("/")[0] || "已选文件夹"
  }

  const handleCreateJob = async () => {
    if (
      !selectedFiles ||
      selectedFiles.length === 0 ||
      !customerName.trim() ||
      !representative.trim() ||
      !inquiryDate.trim()
    )
      return

    setIsCreating(true)
    try {
      const formData = new FormData()
      
      for (const file of Array.from(selectedFiles)) {
        formData.append("files", file)
        formData.append("filePaths", (file as any).webkitRelativePath)
      }
      
      formData.append("customerName", customerName.trim())
      formData.append("representative", representative.trim())
      formData.append("inquiryDate", inquiryDate.trim())
      formData.append("notes", notes.trim())
      formData.append("folderName", getFolderName())

      const res = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("服务端错误")

      const newTask: Task = await res.json()
      onJobCreated(newTask)

      setSelectedFiles(null)
      setCustomerName("")
      setRepresentative("")
      setInquiryDate("")
      setNotes("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      console.error("任务创建失败", err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex-shrink-0 w-80 bg-white rounded-xl shadow-sm border border-gray-200/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-gray-100 rounded-lg">
          <Plus className="w-4 h-4 text-gray-600" />
        </div>
        <h2 className="text-sm font-medium text-gray-900">新建任务</h2>
      </div>

      <div className="space-y-3">
        <label
          htmlFor="folderUpload"
          className="flex items-center gap-3 w-full rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer px-3 py-2.5 group"
        >
          <Folder className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          <span className={`text-sm flex-1 truncate ${
            selectedFiles ? "text-gray-900 font-medium" : "text-gray-500"
          }`}>
            {getFolderName()}
          </span>
          <Input
            id="folderUpload"
            ref={fileInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => setSelectedFiles(e.target.files)}
          />
        </label>

        <Input
          list="customer-list"
          placeholder="客户名称"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="h-9 text-sm bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500"
        />
        <datalist id="customer-list">
          {customerOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <Input
          placeholder="负责人"
          value={representative}
          onChange={(e) => setRepresentative(e.target.value)}
          className="h-9 text-sm bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500"
        />

        <div className="relative">
          <Input
            readOnly
            placeholder="询价日期"
            value={inquiryDate}
            onClick={openInquiryDatePicker}
            className="h-9 text-sm bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500 pr-9 cursor-pointer"
          />
          <Calendar 
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" 
          />
          <input
            ref={inquiryDateInputRef}
            type="date"
            value={inquiryDate}
            onChange={(e) => setInquiryDate(e.target.value)}
            className="sr-only"
          />
        </div>

        <Input
          placeholder="备注（可选）"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-9 text-sm bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500"
        />

        <Button
          onClick={handleCreateJob}
          className="w-full h-9 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          disabled={
            !selectedFiles ||
            selectedFiles.length === 0 ||
            !customerName ||
            !representative ||
            !inquiryDate ||
            isCreating
          }
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "创建任务"
          )}
        </Button>
      </div>
    </div>
  )
}
