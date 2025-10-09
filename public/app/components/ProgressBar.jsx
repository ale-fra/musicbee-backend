export function ProgressBar({ label, value, percent, gradient }) {
  const safePercent = Math.min(100, Math.max(0, percent ?? 0));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-semibold text-slate-100">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800/80">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${safePercent}%`, background: gradient }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
