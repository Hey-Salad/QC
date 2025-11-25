/**
 * HeySalad QC - AlertBadge Component
 * 
 * Badge component for displaying pass/fail/warning states.
 * Requirements: 6.4
 */

export type AlertStatus = 'pass' | 'fail' | 'warning';

export interface AlertBadgeProps {
  status: AlertStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusStyles: Record<AlertStatus, { bg: string; text: string; icon: string }> = {
  pass: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    icon: '✓',
  },
  fail: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    icon: '✗',
  },
  warning: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    icon: '!',
  },
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

const defaultLabels: Record<AlertStatus, string> = {
  pass: 'Pass',
  fail: 'Fail',
  warning: 'Warning',
};

export function AlertBadge({ status, label, size = 'md' }: AlertBadgeProps) {
  const styles = statusStyles[status];
  const displayLabel = label ?? defaultLabels[status];
  
  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full font-medium ${styles.bg} ${styles.text} ${sizeStyles[size]}`}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      <span aria-hidden="true">{styles.icon}</span>
      {displayLabel}
    </span>
  );
}
