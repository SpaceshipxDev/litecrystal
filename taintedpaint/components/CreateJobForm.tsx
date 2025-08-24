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
  const [deliveryDate, setDeliveryDate] = useState("")
  const [ynmxId, setYnmxId] = useState("")
  const [notes, setNotes] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [customerOptions, setCustomerOptions] = useState<string[]>([])
  const [userName, setUserName] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadIndex, setUploadIndex] = useState(0)
  const [resumeTask, setResumeTask] = useState<Task | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inquiryDateInputRef = useRef<HTMLInputElement>(null)
  const deliveryDateInputRef = useRef<HTMLInputElement>(null)

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

  const openDeliveryDatePicker = () => {
    const input = deliveryDateInputRef.current
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
          const names = Array.from(
            new Set(
              taskValues
                .map((t) => t.customerName)
                .filter((name): name is string => Boolean(name))
            )
          )
          setCustomerOptions(names)
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try {
        const u = JSON.parse(stored)
        setUserName(u.name || '')
      } catch {}
    }
  }, [])

  const getFolderName = (): string => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return "选择文件夹"
    }
    const firstPath = (selectedFiles[0] as any).webkitRelativePath || ""
    return firstPath.split("/")[0] || "已选文件夹"
  }

  const uploadFilesSequentially = async (
    taskId: string,
    startIndex = 0
  ): Promise<Task> => {
    if (!selectedFiles) throw new Error("no files")
    let latest: Task | null = null
    const filesArr = Array.from(selectedFiles)
    for (let i = startIndex; i < filesArr.length; i++) {
      const file = filesArr[i]
      const rel = (file as any).webkitRelativePath || file.name
      const form = new FormData()
      form.append("files", file, rel)
      form.append("updatedBy", userName)
      const res = await fetch(`/api/jobs/${taskId}/upload`, {
        method: "POST",
        body: form,
      })
      if (!res.ok) throw new Error("upload failed")
      latest = await res.json()
      setUploadIndex(i + 1)
      setUploadProgress(Math.round(((i + 1) / filesArr.length) * 100))
    }
    if (!latest) throw new Error("no response")
    return latest
  }

  const handleCreateJob = async () => {
    setIsCreating(true)
    setErrorMsg("")
    try {
      // Step 1: create job metadata
      const metaForm = new FormData()

      metaForm.append("customerName", customerName.trim())
      metaForm.append("representative", representative.trim())
      metaForm.append("inquiryDate", inquiryDate.trim())
      metaForm.append("deliveryDate", deliveryDate.trim())
      metaForm.append("ynmxId", ynmxId.trim())
      metaForm.append("notes", notes.trim())
      metaForm.append("updatedBy", userName)

      const res = await fetch("/api/jobs", {
        method: "POST",
        body: metaForm,
      })

      if (!res.ok) throw new Error("服务端错误")

      const newTask: Task = await res.json()

      let finalTask: Task = newTask

      // Step 2: upload files if any
      if (selectedFiles && selectedFiles.length > 0) {
        try {
          finalTask = await uploadFilesSequentially(newTask.id)
        } catch (e) {
          setErrorMsg("文件上传失败，请重试")
          setResumeTask(newTask)
          return
        }
      }

      onJobCreated(finalTask)

      setSelectedFiles(null)
      setCustomerName("")
      setRepresentative("")
      setInquiryDate("")
      setDeliveryDate("")
      setYnmxId("")
      setNotes("")
      setUploadProgress(0)
      setUploadIndex(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      console.error("任务创建失败", err)
      setErrorMsg("任务创建失败，请稍后重试")
    } finally {
      setIsCreating(false)
    }
  }

  const resumeUpload = async () => {
    if (!resumeTask) return
    setIsCreating(true)
    setErrorMsg("")
    try {
      const finalTask = await uploadFilesSequentially(resumeTask.id, uploadIndex)
      onJobCreated(finalTask)
      setResumeTask(null)
      setSelectedFiles(null)
      setCustomerName("")
      setRepresentative("")
      setInquiryDate("")
      setDeliveryDate("")
      setYnmxId("")
      setNotes("")
      setUploadProgress(0)
      setUploadIndex(0)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (e) {
      console.error("继续上传失败", e)
      setErrorMsg("文件上传失败，请重试")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex-shrink-0 w-80 rounded-[2px] border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-gray-100 rounded-[2px]">
          <Plus className="w-4 h-4 text-gray-700" />
        </div>
        <h2 className="text-sm font-medium text-gray-900 tracking-tight">新建任务</h2>
      </div>

      <div className="space-y-3">
        <label
          htmlFor="folderUpload"
          className="flex items-center gap-3 w-full rounded-[2px] bg-white hover:bg-gray-50 border border-gray-200 transition-colors cursor-pointer px-3 py-2.5 group"
        >
          <Folder className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
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
          className="h-9 text-sm rounded-[2px]"
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
          className="h-9 text-sm rounded-[2px]"
        />


        <div className="relative">
          <Input
            readOnly
            placeholder="询价日期"
            value={inquiryDate}
            onClick={openInquiryDatePicker}
            className="h-9 text-sm pr-9 cursor-pointer rounded-[2px]"
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

        <div className="relative">
          <Input
            readOnly
            placeholder="交货日期"
            value={deliveryDate}
            onClick={openDeliveryDatePicker}
            className="h-9 text-sm pr-9 cursor-pointer rounded-[2px]"
          />
          <Calendar
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          />
          <input
            ref={deliveryDateInputRef}
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="sr-only"
          />
        </div>

        <Input
          placeholder="生产编号"
          value={ynmxId}
          onChange={(e) => setYnmxId(e.target.value)}
          className="h-9 text-sm rounded-[2px]"
        />

        <Input
          placeholder="备注 (可选）"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-9 text-sm rounded-[2px]"
        />
        {uploadProgress > 0 && (
          <p className="text-sm text-gray-500">
            上传进度 {uploadProgress}% ({uploadIndex}/{selectedFiles?.length || 0})
          </p>
        )}
        {errorMsg && (
          <p className="text-sm text-red-500">{errorMsg}</p>
        )}

        {resumeTask ? (
          <Button
            onClick={resumeUpload}
            className="w-full h-9 text-white text-sm font-medium rounded-[2px] transition-all disabled:opacity-50"
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "继续上传"
            )}
          </Button>
        ) : (
          <Button
            onClick={handleCreateJob}
            className="w-full h-9 text-white text-sm font-medium rounded-[2px] transition-all disabled:opacity-50"
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "创建任务"
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
