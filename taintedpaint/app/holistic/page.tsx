


/*
 * ArchiveDemo v6 – minimal Apple‑style archive browser
 * – Metrics: 进行中｜已报价｜已完成｜成单率
 */
'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Task, Column, BoardData } from '@/types';
import { baseColumns } from '@/lib/baseColumns';
import TaskModal from '@/components/TaskModal';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// ─── Utilities ────────────────────────────────────────────────────────────────
// 超轻量 mock 版 dayjs，只实现本例需要的 format / valueOf。
// 统一使用中文显示月份，避免受浏览器语言影响
const dayjs = (date: string) => ({
  format: (fmt: string, locale = 'zh-CN') => {
    const d = new Date(date);
    if (fmt === 'MMM DD')   return d.toLocaleDateString(locale, { month: 'short', day: '2-digit' });
    if (fmt === 'YYYY-MM')  return date.slice(0, 7);
    if (fmt === 'YYYY-MM-DD') return date;
    if (fmt === 'MMM YYYY') return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
    return date;
  },
  valueOf: () => new Date(date).getTime()
});

// Tailwind clsx‑like小助手，把真值 class 拼起来
const clsx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

type Status = 'Working' | 'Quoted' | 'Finished'

interface Job extends Task {
  status: Status;
  qty?: number;
  axis?: string;
  value?: number;
}

const getStatus = (t: Task): Status => {
  if (t.columnId === "archive2") return "Finished"
  if (t.columnId === "archive") return "Quoted"
  return "Working"
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Status → 颜色 / 中文标签（淡色、Apple 风）----------------------------------
const statusInfo = {
  Working:  { stripe: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800',   label: '进行中' },
  Quoted:   { stripe: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800', label: '已报价' },
  Finished: { stripe: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  label: '已完成' }
};

// ─── 主页面组件 ───────────────────────────────────────────────────────────────
export default function ArchivePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [viewMode, setViewMode] = useState<'business' | 'production'>('production');
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.replace('/login');
    } else {
      try {
        const u = JSON.parse(user);
        const dept = u.department || '';
        setViewMode(dept === '商务' ? 'business' : 'production');
      } catch {}
      setReady(true);
    }
  }, [router]);
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [columns, setColumns] = useState<Column[]>(baseColumns);
  if (!ready) return null;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs");
        if (res.ok) {
          const data: BoardData = await res.json();
          setTasks(data.tasks || {});
          const map = new Map((data.columns || []).map(c => [c.id, c]));
          setColumns(
            baseColumns.map(b => {
              const saved = map.get(b.id);
              return { ...b, ...saved, pendingTaskIds: saved?.pendingTaskIds || [] };
            })
          );
        }
      } catch {}
    })();
  }, []);

  const jobs = useMemo<Job[]>(() =>
    Object.values(tasks)
      .filter(t => columns.some(c => c.taskIds.includes(t.id)))
      .map(t => ({ ...t, status: getStatus(t) }))
  , [tasks, columns]);

  const customers = useMemo(() => {
    if (viewMode !== 'business') return [];
    const names = jobs
      .map(j => j.customerName)
      .filter((n): n is string => Boolean(n));
    return Array.from(new Set(names));
  }, [jobs, viewMode]);
  const months    = useMemo(() => {
    const formatted = jobs
      .map(j => j.inquiryDate)
      .filter((d): d is string => Boolean(d))
      .map(d => dayjs(d).format("YYYY-MM"));
    return Array.from(new Set(formatted));
  }, [jobs]);

  // ② 组件状态 --------------------------------------------------------------------
  const [activeCustomer, setActiveCustomer] = useState<string>('All');
  const [activeMonth,    setActiveMonth]    = useState<string>('All');
  const [q,              setQ]              = useState('');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskColumnTitle, setSelectedTaskColumnTitle] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userName, setUserName] = useState("");

  const handleTaskUpdated = useCallback((updated: Task) => {
    setTasks(prev => ({ ...prev, [updated.id]: updated }));
    setSelectedTask(updated);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUserName(u.name || '');
      } catch {}
    }
  }, []);

  // ③ 过滤 + 排序 -----------------------------------------------------------------
  const filtered = jobs
    .filter(j => {
      const okCustomer =
        viewMode === 'business'
          ? activeCustomer === "All" || j.customerName === activeCustomer
          : true;
      const okMonth =
        activeMonth === "All" ||
        (j.inquiryDate ? dayjs(j.inquiryDate).format("YYYY-MM") === activeMonth : false);
      const okSearch =
        q === ""
          ? true
          : viewMode === 'business'
          ? (j.representative || "").toLowerCase().includes(q.toLowerCase())
          : (j.ynmxId || "").toLowerCase().includes(q.toLowerCase());
      return okCustomer && okMonth && okSearch;
    })
    .sort(
      (a, b) => dayjs(b.inquiryDate || '').valueOf() - dayjs(a.inquiryDate || '').valueOf()
    );

  // ④ 指标计算 --------------------------------------------------------------------
  const working  = filtered.filter(j => j.status === 'Working').length;
  const quoted   = filtered.filter(j => j.status === 'Quoted').length;
  const finished = filtered.filter(j => j.status === 'Finished').length;
  const denom    = quoted + finished;                        // 已报价 + 已完成
  const hitRate  = denom === 0 ? 0 : Math.round((finished / denom) * 100);
  const byDay = filtered.reduce<Record<string, Job[]>>((acc, job) => {
    const d = dayjs(job.inquiryDate || '').format("MMM DD");
    (acc[d] = acc[d] || []).push(job);
    return acc;
  }, {});

  const handleJobClick = (job: Job) => {
    setSelectedTask(job);
    const col = columns.find(c => c.id === job.columnId);
    setSelectedTaskColumnTitle(col ? col.title : null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedTask(null);
      setSelectedTaskColumnTitle(null);
    }, 300);
  };

  // ⑥ JSX 渲染 --------------------------------------------------------------------
  return (
    <div
      className="min-h-screen bg-white font-sans text-gray-900"
      style={{ fontFamily: '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif' }}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Header & Filters (吸顶) ───────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-6 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" aria-label="返回看板" className="text-gray-500 hover:text-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-light">档案库</h1>
          </div>

          {/* ── Metrics 指标栏 ─────────────────────────────── */}
          <div className="text-sm text-gray-600 mb-6 space-x-8">
            <span>进行中 <strong className="text-gray-900">{working}</strong></span>
            <span>已报价 <strong className="text-gray-900">{quoted}</strong></span>
            <span>已完成 <strong className="text-gray-900">{finished}</strong></span>
            <span>成单率 <strong className="text-gray-900">{hitRate}%</strong></span>
          </div>

          {/* ── Filters 过滤器 ─────────────────────────────── */}
          <div className="space-y-3">
            {/* 客户选择 */}
            <div className="flex flex-wrap gap-2">
              {['全部', ...customers].map(c => (
                <Chip key={c} active={activeCustomer === (c === '全部' ? 'All' : c)}
                      onClick={() => setActiveCustomer(c === '全部' ? 'All' : c)}>
                  {c}
                </Chip>
              ))}
            </div>
            {/* 月份选择 */}
            <div className="flex flex-wrap gap-2">
              {['All', ...months].map(m => (
                <Chip key={m} active={activeMonth === m} onClick={() => setActiveMonth(m)}>
                  {m === 'All' ? '全部月份' : dayjs(m).format('MMM YYYY')}
                </Chip>
              ))}
            </div>
            {/* 搜索框 */}
            <input
              type="search"
              placeholder={viewMode === 'business' ? '搜索工程师' : '搜索编号'}
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full max-w-sm border-0 border-b border-gray-300 bg-transparent px-0 py-2 text-sm
                         focus:border-gray-900 focus:ring-0 placeholder-gray-400"
            />
          </div>
        </div>

        {/* ── Timeline 列表 ────────────────────────────────────── */}
        <div className="space-y-12">
          {Object.entries(byDay).map(([day, jobs]) => (
            <div key={day}>
              <h2 className="text-sm font-medium text-gray-400 mb-6 uppercase tracking-wider">{day}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map(job => (
                  <JobCard key={job.id} job={job} onClick={() => handleJobClick(job)} viewMode={viewMode} />
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">无匹配结果</p>
            </div>
          )}
        </div>
        <TaskModal
          open={isModalOpen}
          task={selectedTask}
          columnTitle={selectedTaskColumnTitle}
          viewMode={viewMode}
          userName={userName}
          onOpenChange={(o) => !o && closeModal()}
          onTaskUpdated={handleTaskUpdated}
        />
      </div>
    </div>
  );
}

// ─── 复用小组件 ──────────────────────────────────────────────────
function Chip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-full',
        active
          ? 'bg-gray-900 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      )}
    >
      {children}
    </button>
  );
}

function BlockedField() {
  return (
    <span className="relative inline-block w-6 h-3 rounded-sm bg-gray-200/70 overflow-hidden">
      <span className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
    </span>
  );
}

function JobCard({ job, onClick, viewMode }: { job: Job; onClick: () => void; viewMode: 'business' | 'production' }) {
  const colors = statusInfo[job.status];

  return (
    <div onClick={onClick} className="relative bg-white border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-sm cursor-pointer">
      {/* 左侧竖条表示状态颜色 */}
      <div className={clsx('absolute left-0 top-0 w-1 h-full', colors.stripe)} />

      <div className="pl-6 pr-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 leading-tight">
              {viewMode === 'business' ? job.representative : job.ynmxId}
            </h3>
            {viewMode === 'business' && (
              <p className="text-sm text-gray-500 mt-0.5">{job.customerName}</p>
            )}
          </div>
          <span className={clsx(
            'text-xs font-medium px-2 py-1 rounded ml-3 whitespace-nowrap',
            colors.badge
          )}>
            {colors.label}
          </span>
        </div>

        <p className="text-xs text-gray-400 mb-3 font-mono tracking-wide">{dayjs(job.inquiryDate || '').format('YYYY-MM-DD')}</p>

        <div className="flex items-center gap-3 text-xs text-gray-600">
          {job.value ? (
            <span className="font-medium">¥{(job.value / 1000).toFixed(0)}k</span>
          ) : (
            <span className="inline-flex items-center gap-0.5 font-medium">
              ¥<BlockedField />
            </span>
          )}
          {job.qty ? (
            <span>{job.qty}件</span>
          ) : (
            <span className="inline-flex items-center">
              <BlockedField />件
            </span>
          )}
          {job.axis ? (
            <span>{job.axis}</span>
          ) : (
            <span className="inline-flex items-center">
              <BlockedField />轴
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

