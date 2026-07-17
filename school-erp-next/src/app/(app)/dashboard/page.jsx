'use client';

import { useEffect, useState } from 'react';
import API from '@/lib/api';
import {
  Users, UserSquare2, BookOpen, Bus, TrendingUp, TrendingDown,
  DoorOpen, Library as LibraryIcon, CalendarDays, MapPin, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { useAcademicYear } from '@/lib/AcademicYearContext';
import RouteGuard from '@/components/RouteGuard';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtK = (n) => {
  const a = Math.abs(n);
  if (a >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (a >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (a >= 1000) return '₹' + (n / 1000).toFixed(0) + 'k';
  return '₹' + n;
};

const CHART = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

const tooltipStyle = {
  background: 'var(--surface)', border: '1px solid var(--border-col)',
  borderRadius: 10, fontSize: 12, color: 'var(--text-primary)', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
};

function DashboardInner() {
  const { year } = useAcademicYear();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!year) return;
    setLoading(true);
    API.get(`/dashboard/advanced?year=${year}`)
      .then((r) => setD(r.data))
      .catch(() => setD(null))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="empty-state"><span className="loading-spinner" /> Loading dashboard…</div>;
  if (!d) return <div className="empty-state">Couldn't load the dashboard.</div>;

  const c = d.counts;
  const sAtt = d.attendanceToday.student;
  const tAtt = d.attendanceToday.teacher;
  const pl = d.profitLoss || [];
  const current = pl.find((p) => p.isCurrent) || pl[pl.length - 1] || {};
  const netProfit = current.profit || 0;

  const donut = (a) => {
    if (a.marked === 0) return [{ name: 'Not marked', value: 1, color: '#e2e8f0' }];
    return [
      { name: 'Present', value: a.present, color: '#22c55e' },
      { name: 'Absent', value: a.absent, color: '#ef4444' },
      { name: 'Late', value: a.late, color: '#f59e0b' },
      { name: 'Leave', value: a.leave, color: '#8b5cf6' },
    ].filter((x) => x.value > 0);
  };

  return (
    <div className="dash">
      {/* ── Top stat cards ── */}
      <div className="dash-stats">
        <StatCard icon={<Users size={22} />} tone="a" value={c.totalStudents} label="Students" sub={`${c.boys} boys · ${c.girls} girls`} />
        <StatCard icon={<UserSquare2 size={22} />} tone="b" value={c.totalTeachers} label="Teachers" />
        <StatCard icon={<BookOpen size={22} />} tone="c" value={c.totalClasses} label="Classes" />
        <StatCard icon={<DoorOpen size={22} />} tone="d" value={c.insideNow} label="Inside Campus" sub="right now" />
        <StatCard icon={<LibraryIcon size={22} />} tone="e" value={c.booksIssued} label="Books Issued" />
        <StatCard icon={<Bus size={22} />} tone="f" value={c.totalBuses} label="Buses" />
      </div>

      {/* ── Row: profit/loss (wide) + net card ── */}
      <div className="dash-row dash-row-pl">
        <div className="dash-card">
          <div className="dash-card-head">
            <h3>Profit &amp; Loss — 5 Year Trend</h3>
            <span className="dash-badge">Income vs Expense</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pl} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-col)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={54} />
              <Tooltip content={<PLTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[5, 5, 0, 0]} maxBarSize={26} />
              <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[5, 5, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`dash-net-card ${netProfit >= 0 ? 'profit' : 'loss'}`}>
          <div className="dnc-icon">{netProfit >= 0 ? <TrendingUp size={26} /> : <TrendingDown size={26} />}</div>
          <div className="dnc-label">Net {netProfit >= 0 ? 'Profit' : 'Loss'} · {year}</div>
          <div className="dnc-value">{fmt(Math.abs(netProfit))}</div>
          <div className="dnc-split">
            <div><span className="dnc-k"><ArrowUpRight size={13} /> Income</span><span className="dnc-v up">{fmtK(current.income || 0)}</span></div>
            <div><span className="dnc-k"><ArrowDownRight size={13} /> Expense</span><span className="dnc-v down">{fmtK(current.expense || 0)}</span></div>
          </div>
        </div>
      </div>

      {/* ── Row: two attendance donuts + fee gauge ── */}
      <div className="dash-row dash-row-3">
        <AttendanceDonut title="Student Attendance" subtitle="Today" att={sAtt} data={donut(sAtt)} />
        <AttendanceDonut title="Teacher Attendance" subtitle="Today" att={tAtt} data={donut(tAtt)} />
        <div className="dash-card dash-fee">
          <div className="dash-card-head"><h3>Fee Collection</h3><span className="dash-badge">{year}</span></div>
          <div className="dash-fee-body">
            <div className="dash-fee-ring" style={{ '--pct': d.fees.total > 0 ? (d.fees.collected / d.fees.total) * 100 : 0 }}>
              <div className="dash-fee-ring-inner">
                <div className="dfr-pct">{d.fees.total > 0 ? Math.round((d.fees.collected / d.fees.total) * 100) : 0}%</div>
                <div className="dfr-lbl">collected</div>
              </div>
            </div>
            <div className="dash-fee-legend">
              <div><span className="dot green" /> Collected <b>{fmtK(d.fees.collected)}</b></div>
              <div><span className="dot red" /> Due <b>{fmtK(d.fees.due)}</b></div>
              <div><span className="dot blue" /> Fines <b>{fmtK(d.fees.finesCollected)}</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row: class distribution + attendance trend ── */}
      <div className="dash-row dash-row-2">
        <div className="dash-card">
          <div className="dash-card-head"><h3>Students per Class</h3></div>
          {d.classDistribution.length === 0 ? <div className="empty-state" style={{ padding: 30 }}>No class data.</div> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={d.classDistribution} layout="vertical" margin={{ top: 4, right: 16, left: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-col)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip cursor={{ fill: 'rgba(59,130,246,0.06)' }} contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Students" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {d.classDistribution.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><h3>Attendance Trend</h3><span className="dash-badge">last 7 days · present %</span></div>
          {d.attendanceTrend.length === 0 ? <div className="empty-state" style={{ padding: 30 }}>No attendance marked this week.</div> : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={d.attendanceTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="attg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-col)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" width={40} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Present']} />
                <Area type="monotone" dataKey="percent" stroke="#3b82f6" strokeWidth={2.5} fill="url(#attg)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Upcoming events ── */}
      <div className="dash-card">
        <div className="dash-card-head"><h3><CalendarDays size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Upcoming Events</h3></div>
        {d.upcomingEvents.length === 0 ? <div className="empty-state" style={{ padding: 24 }}>No upcoming events.</div> : (
          <div className="dash-events">
            {d.upcomingEvents.map((e, i) => (
              <div className="dash-event" key={i}>
                <div className="de-date">
                  <div className="de-day">{new Date(e.date + 'T00:00:00').getDate()}</div>
                  <div className="de-mon">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}</div>
                </div>
                <div className="de-body">
                  <div className="de-title">{e.eventTitle}</div>
                  <div className="de-meta">{e.eventType}{e.venue && <> · <MapPin size={11} /> {e.venue}</>}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, tone, value, label, sub }) {
  return (
    <div className={`dash-stat dash-stat-${tone}`}>
      <div className="ds-icon">{icon}</div>
      <div className="ds-body">
        <div className="ds-value">{value}</div>
        <div className="ds-label">{label}</div>
        {sub && <div className="ds-sub">{sub}</div>}
      </div>
    </div>
  );
}

function AttendanceDonut({ title, subtitle, att, data }) {
  const pct = att.percent;
  return (
    <div className="dash-card dash-donut">
      <div className="dash-card-head"><h3>{title}</h3><span className="dash-badge">{subtitle}</span></div>
      <div className="dash-donut-body">
        <div className="dash-donut-chart">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={46} outerRadius={64} paddingAngle={2} stroke="none">
                {data.map((x, i) => <Cell key={i} fill={x.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="dash-donut-center">
            <div className="ddc-pct">{att.marked === 0 ? '—' : `${pct}%`}</div>
            <div className="ddc-lbl">present</div>
          </div>
        </div>
        <div className="dash-donut-legend">
          {att.marked === 0 ? <div className="ddl-empty">Not marked yet today</div> : (
            <>
              <div><span className="dot green" /> Present <b>{att.present}</b></div>
              {att.absent > 0 && <div><span className="dot red" /> Absent <b>{att.absent}</b></div>}
              {att.late > 0 && <div><span className="dot amber" /> Late <b>{att.late}</b></div>}
              {att.leave > 0 && <div><span className="dot violet" /> Leave <b>{att.leave}</b></div>}
              <div className="ddl-total">of {att.total} total</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PLTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === 'income')?.value || 0;
  const expense = payload.find((p) => p.dataKey === 'expense')?.value || 0;
  const profit = income - expense;
  return (
    <div style={{ ...tooltipStyle, padding: '10px 12px' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#16a34a' }}>Income: {fmt(income)}</div>
      <div style={{ color: '#dc2626' }}>Expense: {fmt(expense)}</div>
      <div style={{ fontWeight: 700, marginTop: 3, color: profit >= 0 ? '#16a34a' : '#dc2626' }}>
        {profit >= 0 ? 'Profit' : 'Loss'}: {fmt(Math.abs(profit))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard module="Dashboard">
      <DashboardInner />
    </RouteGuard>
  );
}
