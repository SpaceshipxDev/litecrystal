"use client"

import { useRef, useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"
import type { Task } from "@/types"

export default function NewTaskDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (task: Task) => void
}) {
  const [customerName, setCustomerName] = useState("")
  const [representative, setRepresentative] = useState("")
  const [inquiryDate, setInquiryDate] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [ynmxId, setYnmxId] = useState("")
  const [notes, setNotes] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [userName, setUserName] = useState("")
  const inquiryDateInputRef = useRef<HTMLInputElement>(null)
  const deliveryDateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { setUserName(JSON.parse(stored).name || '') } catch {}
    }
  }, [])

  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const input = ref.current
    if (!input) return
    if ((input as any).showPicker) (input as any).showPicker()
    else { input.focus(); input.click() }
  }

  const handleCreate = async () => {
    if (!customerName.trim() || !representative.trim() || !inquiryDate.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          representative: representative.trim(),
          inquiryDate: inquiryDate.trim(),
          deliveryDate: deliveryDate.trim(),
          ynmxId: ynmxId.trim(),
          notes: notes.trim(),
          updatedBy: userName,
          noFiles: true,
        })
      })
      if (!res.ok) throw new Error("服务端错误")
      const task: Task = await res.json()
      onCreated(task)
      onOpenChange(false)
      setCustomerName(""); setRepresentative(""); setInquiryDate(""); setDeliveryDate(""); setYnmxId(""); setNotes("")
    } catch (e) {
      console.error(e)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="客户名称" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <Input placeholder="负责人" value={representative} onChange={(e) => setRepresentative(e.target.value)} />
          <div className="relative">
            <Input readOnly placeholder="询价日期" value={inquiryDate} onClick={() => openPicker(inquiryDateInputRef)} className="pr-9" />
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input ref={inquiryDateInputRef} type="date" value={inquiryDate} onChange={(e) => setInquiryDate(e.target.value)} className="sr-only" />
          </div>
          <div className="relative">
            <Input readOnly placeholder="交货日期" value={deliveryDate} onClick={() => openPicker(deliveryDateInputRef)} className="pr-9" />
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input ref={deliveryDateInputRef} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="sr-only" />
          </div>
          <Input placeholder="生产编号" value={ynmxId} onChange={(e) => setYnmxId(e.target.value)} />
          <Input placeholder="备注（可选）" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleCreate} disabled={!customerName || !representative || !inquiryDate || isCreating}>{isCreating ? '创建中...' : '创建'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


