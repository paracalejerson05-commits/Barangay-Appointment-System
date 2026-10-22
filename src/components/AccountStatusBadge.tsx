import React from 'react';
import { AccountStatus } from '../lib/profileUtils';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface AccountStatusBadgeProps {
  status: AccountStatus | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

export function AccountStatusBadge({
  status,
  size = 'md',
  className,
  showIcon = true
}: AccountStatusBadgeProps) {
  const normalized = (status || '').toString().toLowerCase();

  let isApproved = normalized === 'approved' || normalized === 'active';
  let isRejected = normalized === 'rejected' || normalized === 'disapproved' || normalized === 'inactive' || normalized === 'deactivated';
  let isPending = !isApproved && !isRejected;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3.5 py-1.5 text-sm gap-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  if (isApproved) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors",
          sizeClasses[size],
          className
        )}
      >
        {showIcon && (
          <span className="text-emerald-500 flex-shrink-0" aria-hidden="true">
            🟢
          </span>
        )}
        <span>Approved</span>
      </span>
    );
  }

  if (isRejected) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-semibold rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 transition-colors",
          sizeClasses[size],
          className
        )}
      >
        {showIcon && (
          <span className="text-red-500 flex-shrink-0" aria-hidden="true">
            🔴
          </span>
        )}
        <span>Rejected</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors",
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <span className="text-amber-500 flex-shrink-0" aria-hidden="true">
          🟡
        </span>
      )}
      <span>Pending Approval</span>
    </span>
  );
}
