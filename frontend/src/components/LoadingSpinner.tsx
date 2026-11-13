import React from 'react';

interface LoadingSpinnerProps {
  label?: string;
  overlay?: boolean;
  size?: number;
}

/**
 * LoadingSpinner
 * A full-screen animated spinner used while the app boots or routes transition.
 * Reuses the project's slate-on-white aesthetic with a spinning ring.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ label = 'Loading...', overlay = true, size = 64 }) => {
  const ringClass = `border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin`;
  const spinner = (
    <div className="text-center">
      <div className={ringClass} style={{ width: size, height: size }} />
      {label && <p className="text-slate-600 mt-4">{label}</p>}
    </div>
  );

  if (!overlay) return spinner;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {spinner}
    </div>
  );
};

export default LoadingSpinner;
