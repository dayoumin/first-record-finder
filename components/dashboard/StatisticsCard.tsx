'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, FlaskConical, ScrollText, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatisticsCardProps {
  title: string;
  value: number;
  description?: string;
  icon?: 'papers' | 'patents' | 'reports' | 'trend';
  loading?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const iconMap = {
  papers: FileText,
  patents: FlaskConical,
  reports: ScrollText,
  trend: TrendingUp,
};

export function StatisticsCard({
  title,
  value,
  description,
  icon = 'papers',
  loading = false,
  trend,
}: StatisticsCardProps) {
  const Icon = iconMap[icon];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-20 animate-pulse bg-muted rounded" />
        ) : (
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p
            className={cn(
              'text-xs mt-1 flex items-center gap-1',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            <TrendingUp
              className={cn('h-3 w-3', !trend.isPositive && 'rotate-180')}
            />
            {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
