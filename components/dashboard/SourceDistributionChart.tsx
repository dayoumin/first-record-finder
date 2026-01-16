'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SourceData {
  name: string;
  value: number;
  color: string;
}

interface SourceDistributionChartProps {
  data: SourceData[];
  title?: string;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142.1 76.2% 36.3%)',
  'hsl(47.9 95.8% 53.1%)',
  'hsl(346.8 77.2% 49.8%)',
  'hsl(200 80% 50%)',
  'hsl(280 65% 60%)',
];

export function SourceDistributionChart({
  data,
  title = '소스별 분포',
}: SourceDistributionChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((d) => d.value > 0)
      .map((d, i) => ({
        ...d,
        color: d.color || COLORS[i % COLORS.length],
      }));
  }, [data]);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  // 접근성을 위한 데이터 설명 텍스트 생성
  const accessibleDescription = useMemo(() => {
    if (chartData.length === 0) return '데이터가 없습니다';
    return chartData
      .map((d) => `${d.name}: ${d.value}건 (${((d.value / total) * 100).toFixed(1)}%)`)
      .join(', ');
  }, [chartData, total]);

  if (chartData.length === 0) {
    return (
      <Card role="region" aria-label={title}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="h-[250px] flex items-center justify-center text-muted-foreground"
            role="status"
          >
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="transition-all duration-200 hover:shadow-md"
      role="region"
      aria-label={title}
    >
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 스크린 리더를 위한 숨겨진 데이터 설명 */}
        <div className="sr-only" aria-live="polite">
          {title}: {accessibleDescription}. 총 {total.toLocaleString()}건
        </div>

        <div className="h-[250px]" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-opacity hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [
                  `${(value as number).toLocaleString()}건 (${(((value as number) / total) * 100).toFixed(1)}%)`,
                  '',
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center text-sm text-muted-foreground mt-2" aria-hidden="true">
          총 {total.toLocaleString()}건
        </div>
      </CardContent>
    </Card>
  );
}
