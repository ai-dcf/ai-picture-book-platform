"use client";
import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
} from 'recharts';
import { cn } from '@/lib/utils';
import { EmotionCurvePoint, EMOTION_INTENSITY_MAP } from '@/types/picturebook';

interface Props {
  data: EmotionCurvePoint[];
  onPointClick?: (index: number) => void;
  selectedIndex?: number | null;
  editable?: boolean;
}

const INTENSITY_LABELS: Record<number, string> = {
  '-6': '绝望',
  '-5': '极度低落',
  '-4': '很低落',
  '-3': '低落',
  '-2': '偏低',
  '-1': '微低',
  '0': '中性',
  '1': '微暖',
  '2': '偏暖',
  '3': '较正面',
  '4': '很正面',
  '5': '极度正面',
  '6': '巅峰',
};

function getIntensityColor(value: number): string {
  if (value >= 3) return '#22c55e';
  if (value >= 1) return '#86efac';
  if (value >= -1) return '#fbbf24';
  if (value >= -3) return '#fb923c';
  return '#ef4444';
}

interface ChartDataItem {
  index: number;
  label: string;
  emotion: string;
  intensity: number;
  isTurningPoint: boolean;
  displayLabel: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }> }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-elevated text-xs font-body">
      <p className="font-semibold text-foreground">{item.label}</p>
      <p className="text-muted-foreground mt-0.5">
        情绪：<span className="text-foreground font-medium">{item.emotion}</span>
      </p>
      <p className="text-muted-foreground">
        强度：<span className="font-medium" style={{ color: getIntensityColor(item.intensity) }}>
          {item.intensity > 0 ? '+' : ''}{item.intensity}
        </span>
      </p>
      {item.isTurningPoint && (
        <p className="text-amber-600 mt-0.5 font-medium">⚡ 关键转折点</p>
      )}
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ChartDataItem;
}

function CustomDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.isTurningPoint) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill="#f59e0b" stroke="#fff" strokeWidth={2} opacity={0.3} />
        <circle cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
        <text x={cx} y={cy - 14} textAnchor="middle" fill="#f59e0b" fontSize={12} fontWeight={700} fontFamily="sans-serif">
          ⚡
        </text>
      </g>
    );
  }
  const color = getIntensityColor(payload.intensity);
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />;
}

export default function EmotionCurveChart({ data, onPointClick, selectedIndex, editable }: Props) {
  const chartData: ChartDataItem[] = useMemo(() =>
    data.map((point, i) => ({
      index: i,
      label: point.label,
      emotion: point.emotion,
      intensity: point.intensity,
      isTurningPoint: point.isTurningPoint,
      displayLabel: point.emotion,
    })),
    [data]
  );

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs font-body text-muted-foreground border border-dashed border-border rounded-lg bg-muted/30">
        生成故事后将自动创建情绪曲线
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-56 w-full border border-border rounded-lg bg-card p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 20, bottom: 10, left: -10 }}
            onClick={(e: any) => {
              if (editable && onPointClick && e?.activeTooltipIndex !== undefined) {
                onPointClick(e.activeTooltipIndex);
              }
            }}
          >
            <defs>
              <linearGradient id="emotionAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                <stop offset="50%" stopColor="#a855f7" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.15} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />

            <XAxis
              dataKey="displayLabel"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval={0}
              angle={data.length > 6 ? -25 : 0}
              textAnchor={data.length > 6 ? 'end' : 'middle'}
              height={data.length > 6 ? 50 : 30}
            />

            <YAxis
              domain={[-6, 6]}
              ticks={[-6, -4, -2, 0, 2, 4, 6]}
              tickFormatter={(v: number) => INTENSITY_LABELS[v] || ''}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={65}
            />

            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 3" opacity={0.6} />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="intensity"
              stroke="transparent"
              fill="url(#emotionAreaGradient)"
              fillOpacity={1}
            />

            <Area
              type="monotone"
              dataKey="intensity"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              fill="transparent"
              dot={<CustomDot cx={0} cy={0} />}
              activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2, fill: '#fff' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {editable && (
        <div className="flex items-center gap-4 flex-wrap text-[10px] font-body text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#8b5cf6] rounded" />
            <span>情绪走势</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
            <span>正面</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
            <span>中性</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span>负面</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#f59e0b]">⚡</span>
            <span>关键转折点</span>
          </div>
        </div>
      )}
    </div>
  );
}
