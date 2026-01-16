'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface YearlyData {
  year: number;
  papers?: number;
  patents?: number;
  reports?: number;
}

interface YearlyTrendChartProps {
  data: YearlyData[];
  title?: string;
  showPapers?: boolean;
  showPatents?: boolean;
  showReports?: boolean;
}

export function YearlyTrendChart({
  data,
  title = '연도별 추이',
  showPapers = true,
  showPatents = true,
  showReports = true,
}: YearlyTrendChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((d) => d.year > 0)
      .sort((a, b) => a.year - b.year)
      .map((d) => ({
        year: d.year.toString(),
        논문: d.papers || 0,
        특허: d.patents || 0,
        보고서: d.reports || 0,
      }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              {showPapers && (
                <Line
                  type="monotone"
                  dataKey="논문"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {showPatents && (
                <Line
                  type="monotone"
                  dataKey="특허"
                  stroke="hsl(142.1 76.2% 36.3%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {showReports && (
                <Line
                  type="monotone"
                  dataKey="보고서"
                  stroke="hsl(47.9 95.8% 53.1%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
