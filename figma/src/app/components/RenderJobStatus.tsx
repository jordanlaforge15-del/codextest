import { Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export type RenderJobState = 'enqueued' | 'in_progress' | 'completed' | 'error';

export interface RenderJob {
  id: string;
  status: RenderJobState;
  itemCount: number;
  createdAt: Date;
  errorMessage?: string;
}

interface RenderJobStatusProps {
  job: RenderJob;
}

export function RenderJobStatus({ job }: RenderJobStatusProps) {
  const getStatusConfig = () => {
    switch (job.status) {
      case 'enqueued':
        return {
          icon: <Clock className="w-4 h-4" />,
          text: 'Enqueued',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
        };
      case 'in_progress':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: 'In Progress',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: 'Completed',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: 'Error',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
        };
    }
  };

  const config = getStatusConfig();
  const timeAgo = formatTimeAgo(job.createdAt);

  return (
    <div className={`p-3 rounded-lg ${config.bgColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={config.color}>{config.icon}</span>
        <span className={`text-sm font-medium ${config.color}`}>
          {config.text}
        </span>
      </div>
      <p className="text-xs text-gray-600">
        {job.itemCount} {job.itemCount === 1 ? 'item' : 'items'} • {timeAgo}
      </p>
      {job.status === 'error' && job.errorMessage && (
        <p className="text-xs text-red-600 mt-1">{job.errorMessage}</p>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
