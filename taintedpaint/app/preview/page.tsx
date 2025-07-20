


/*
 * ArchiveDemo v6 – minimal Apple‑style archive browser
 * – Metrics: 进行中｜已报价｜已完成｜成单率
 */
'use client';
import { useState, useMemo } from 'react';

// ─── Utilities ────────────────────────────────────────────────────────────────
// 超轻量 mock 版 dayjs，只实现本例需要的 format / valueOf
const dayjs = (date: string) => ({
  format: (fmt: string) => {
    const d = new Date(date);
    if (fmt === 'MMM DD')   return d.toLocaleDateString('en', { month: 'short', day: '2-digit' });
    if (fmt === 'YYYY-MM')  return date.slice(0, 7);
    if (fmt === 'YYYY-MM-DD') return date;
    if (fmt === 'MMM YYYY') return d.toLocaleDateString('en', { month: 'short', year: 'numeric' });
    return date;
  },
  valueOf: () => new Date(date).getTime()
});

// Tailwind clsx‑like小助手，把真值 class 拼起来
const clsx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string;
  customer: string;
  engineer: string;
  qty: number;
  axis: string;
  value: number;      // CNY ¥
  date: string;       // ISO yyyy‑mm‑dd
  status: 'Working' | 'Quoted' | 'Finished';
}

// ─── Mock data (后端接口替换这里即可) ──────────────────────────────────────────
const jobs: Job[] = [
  { id: 'J1', customer: '海康威视', engineer: '李伟', qty: 3, axis: '5轴', value: 34000, date: '2025-07-19', status: 'Working' },
  { id: 'J2', customer: '海康威视', engineer: '张倩', qty: 1, axis: '3轴', value: 12000, date: '2025-07-15', status: 'Quoted' },
  { id: 'J3', customer: '大华股份', engineer: '陈宇', qty: 8, axis: '4轴', value: 78000, date: '2025-06-23', status: 'Finished' },
  { id: 'J4', customer: '富士康',   engineer: '王楠', qty: 2, axis: '5轴', value: 41000, date: '2025-07-03', status: 'Finished' },
  { id: 'J5', customer: '大华股份', engineer: '孙飞', qty: 5, axis: '3轴', value: 26000, date: '2025-06-18', status: 'Working' },
  { id: 'J6', customer: '比亚迪',   engineer: '刘明', qty: 4, axis: '4轴', value: 52000, date: '2025-07-12', status: 'Working' },
  { id: 'J7', customer: '宁德时代', engineer: '周华', qty: 6, axis: '5轴', value: 68000, date: '2025-07-08', status: 'Quoted' }
];

// Status → 颜色 / 中文标签（淡色、Apple 风）----------------------------------
const statusInfo = {
  Working:  { stripe: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800',   label: '进行中' },
  Quoted:   { stripe: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800', label: '已报价' },
  Finished: { stripe: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  label: '已完成' }
};

// ─── 主页面组件 ───────────────────────────────────────────────────────────────
export default function ArchivePage() {
  // ① 缓存下拉选项 ----------------------------------------------------------------
  const customers = useMemo(() => Array.from(new Set(jobs.map(j => j.customer))), []);
  const months    = useMemo(() => Array.from(new Set(jobs.map(j => dayjs(j.date).format('YYYY-MM')))), []);

  // ② 组件状态 --------------------------------------------------------------------
  const [activeCustomer, setActiveCustomer] = useState<string>('All');
  const [activeMonth,    setActiveMonth]    = useState<string>('All');
  const [q,              setQ]              = useState('');

  // ③ 过滤 + 排序 -----------------------------------------------------------------
  const filtered = jobs
    .filter(j => {
      const okCustomer = activeCustomer === 'All' || j.customer === activeCustomer;
      const okMonth    = activeMonth    === 'All' || dayjs(j.date).format('YYYY-MM') === activeMonth;
      const okSearch   = q === '' || j.engineer.toLowerCase().includes(q.toLowerCase());
      return okCustomer && okMonth && okSearch;
    })
    .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());

  // ④ 指标计算 --------------------------------------------------------------------
  const working  = filtered.filter(j => j.status === 'Working').length;
  const quoted   = filtered.filter(j => j.status === 'Quoted').length;
  const finished = filtered.filter(j => j.status === 'Finished').length;
  const denom    = quoted + finished;                        // 已报价 + 已完成
  const hitRate  = denom === 0 ? 0 : Math.round((finished / denom) * 100);

  // ⑤ 按天分组（页面时间线标题用） ---------------------------------------------------
  const byDay = filtered.reduce<Record<string, Job[]>>((acc, job) => {
    const d = dayjs(job.date).format('MMM DD');
    (acc[d] = acc[d] || []).push(job);
    return acc;
  }, {});

  // ⑥ JSX 渲染 --------------------------------------------------------------------
  return (
    <div
      className="min-h-screen bg-white font-sans text-gray-900"
      style={{ fontFamily: '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif' }}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Header & Filters (吸顶) ───────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-6 mb-8">
          <h1 className="text-3xl font-light mb-2">档案库</h1>

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
              placeholder="搜索工程师"
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
                {jobs.map(job => <JobCard key={job.id} job={job} />)}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">无匹配结果</p>
            </div>
          )}
        </div>
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

function JobCard({ job }: { job: Job }) {
  const colors = statusInfo[job.status];

  return (
    <div className="relative bg-white border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-sm">
      {/* 左侧竖条表示状态颜色 */}
      <div className={clsx('absolute left-0 top-0 w-1 h-full', colors.stripe)} />

      <div className="pl-6 pr-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 leading-tight">{job.engineer}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{job.customer}</p>
          </div>
          <span className={clsx(
            'text-xs font-medium px-2 py-1 rounded ml-3 whitespace-nowrap',
            colors.badge
          )}>
            {colors.label}
          </span>
        </div>

        <p className="text-xs text-gray-400 mb-3 font-mono tracking-wide">{dayjs(job.date).format('YYYY-MM-DD')}</p>

        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="font-medium">¥{(job.value / 1000).toFixed(0)}k</span>
          <span>{job.qty}件</span>
          <span>{job.axis}</span>
        </div>
      </div>
    </div>
  );
}

