import React from 'react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  title?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong while loading data.',
  onRetry,
  title = 'Error loading data',
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
      <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
    <p className="text-xs text-slate-400 mb-4 max-w-xs">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 text-xs font-bold text-white bg-violet-600/80 hover:bg-violet-600 rounded-lg transition-colors"
      >
        🔄 Retry
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{
  icon?: string;
  message?: string;
  title?: string;
}> = ({ icon = '📭', message = 'No data available yet.', title }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <span className="text-3xl mb-3">{icon}</span>
    {title && <h3 className="text-sm font-bold text-white mb-1">{title}</h3>}
    <p className="text-xs text-slate-500">{message}</p>
  </div>
);
