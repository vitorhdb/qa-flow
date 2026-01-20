import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  variant: 'risk' | 'quality' | 'security' | 'improvements';
  trend?: {
    value: number;
    positive: boolean;
  };
  onClick?: () => void;
  isSelected?: boolean;
}

export function MetricCard({ title, value, subtitle, icon: Icon, variant, trend, onClick, isSelected }: MetricCardProps) {
  const variantStyles = {
    risk: 'metric-card-risk border-risk-critical/30',
    quality: 'metric-card-quality border-primary/30',
    security: 'metric-card-security border-status-warning/30',
    improvements: 'metric-card-improvements border-status-passed/30',
  };

  const iconStyles = {
    risk: 'text-risk-critical',
    quality: 'text-primary',
    security: 'text-status-warning',
    improvements: 'text-status-passed',
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-status-passed';
    if (score >= 60) return 'text-status-warning';
    return 'text-risk-critical';
  };

  return (
    <div
      className={cn(
        'metric-card animate-fade-in',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-lg hover:border-primary/60 transition-shadow',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn(
            'text-3xl sm:text-4xl font-bold tracking-tight',
            typeof value === 'number' ? getScoreColor(value) : 'text-foreground'
          )}>
            {typeof value === 'number' ? `${value}%` : value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn('rounded-xl bg-secondary/50 p-3', iconStyles[variant])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <span className={cn(
            'text-xs font-medium',
            trend.positive ? 'text-status-passed' : 'text-risk-critical'
          )}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-muted-foreground">vs last analysis</span>
        </div>
      )}
    </div>
  );
}
