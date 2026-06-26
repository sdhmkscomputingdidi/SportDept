import React from 'react';
import { Link } from 'react-router-dom';

type StatCardColor = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan';

const COLOR_CONFIG: Record<StatCardColor, {
  gradient: string;
  border: string;
  text: string;
}> = {
  violet: {
    gradient: 'from-violet-500/20 to-violet-600/10',
    border: 'border-violet-500/30',
    text: 'text-violet-300',
  },
  blue: {
    gradient: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
  },
  emerald: {
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
  },
  amber: {
    gradient: 'from-amber-500/20 to-amber-600/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
  },
  rose: {
    gradient: 'from-rose-500/20 to-rose-600/10',
    border: 'border-rose-500/30',
    text: 'text-rose-300',
  },
  cyan: {
    gradient: 'from-cyan-500/20 to-cyan-600/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-300',
  },
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  color?: StatCardColor;
  link?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, icon, color = 'violet', link,
}) => {
  const cfg = COLOR_CONFIG[color];
  const classes = `rounded-xl bg-gradient-to-br ${cfg.gradient} border ${cfg.border} p-5 transition-all hover:scale-[1.02] hover:shadow-lg group`;

  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-extrabold text-white group-hover:scale-110 transition-transform">
          {value}
        </span>
      </div>
      <p className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{label}</p>
    </>
  );

  if (link) {
    return <Link to={link} className={classes}>{inner}</Link>;
  }
  return <div className={classes}>{inner}</div>;
};

export const StatCardSkeleton: React.FC = () => (
  <div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-5 animate-pulse">
    <div className="flex items-center justify-between mb-3">
      <div className="w-8 h-8 rounded-lg bg-slate-700/50" />
      <div className="w-12 h-7 rounded bg-slate-700/50" />
    </div>
    <div className="w-20 h-3 rounded bg-slate-700/50" />
  </div>
);

export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 64 }) => (
  <div className="bg-slate-800/20 rounded-lg animate-pulse flex items-center justify-center" style={{ minHeight: height * 4 }}>
    <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg">
        <div className="w-6 h-6 rounded-full bg-slate-700/50" />
        <div className="flex-1 space-y-1.5">
          <div className="w-2/3 h-3 rounded bg-slate-700/50" />
          <div className="w-1/3 h-2 rounded bg-slate-700/30" />
        </div>
        <div className="w-14 h-3 rounded bg-slate-700/50" />
      </div>
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="animate-pulse space-y-2">
    <div className="flex gap-4 pb-2 border-b border-slate-800/60">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex-1 h-3 rounded bg-slate-700/30" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 py-2.5">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="flex-1 h-3 rounded bg-slate-700/50" />
        ))}
      </div>
    ))}
  </div>
);
