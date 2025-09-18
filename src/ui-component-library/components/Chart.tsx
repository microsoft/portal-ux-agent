import React from 'react';
import type { ChartProps } from '../specs.js';

function normalizeNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function pickColor(index: number, palette?: string[]): string {
  const defaultPalette = ['#2563eb', '#10b981', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6'];
  const colors = palette && palette.length ? palette : defaultPalette;
  return colors[index % colors.length];
}

interface CartesianConfig {
  width: number;
  height: number;
  padding: number;
}

const cartesianConfig: CartesianConfig = {
  width: 320,
  height: 160,
  padding: 24,
};

function buildCartesianPoints(data: any[], valueKey: string): { x: number; y: number }[] {
  const { width, height, padding } = cartesianConfig;
  const values = data.map(item => normalizeNumber(item?.[valueKey]));
  const max = Math.max(...values, 1);
  const span = Math.max(values.length - 1, 1);

  return values.map((value, index) => {
    const x = padding + (index / span) * (width - padding * 2);
    const y = height - padding - (value / max) * (height - padding * 2);
    return { x, y };
  });
}

function renderEmptyState(message: string): React.ReactElement {
  return <div className="chart-empty">{message}</div>;
}

function renderLineChart(data: any[], props: ChartProps): React.ReactElement {
  const valueKey = props.yKeys?.[0] || props.valueKey || 'value';
  const points = buildCartesianPoints(data, valueKey);

  if (!points.length) {
    return renderEmptyState('No data');
  }

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${cartesianConfig.width} ${cartesianConfig.height}`} className="chart-svg">
      <path d={path} fill="none" stroke={pickColor(0, props.colors)} strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

function renderAreaChart(data: any[], props: ChartProps): React.ReactElement {
  const valueKey = props.yKeys?.[0] || props.valueKey || 'value';
  const points = buildCartesianPoints(data, valueKey);

  if (!points.length) {
    return renderEmptyState('No data');
  }

  const { width, height, padding } = cartesianConfig;
  const topPath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const closedPath = `${topPath} L${lastPoint.x.toFixed(2)},${height - padding} L${firstPoint.x.toFixed(2)},${height - padding} Z`;

  const color = pickColor(0, props.colors);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
      <path d={closedPath} fill={color} opacity={0.15} />
      <path d={topPath} fill="none" stroke={color} strokeWidth={3} />
    </svg>
  );
}

function renderBarChart(data: any[], props: ChartProps): React.ReactElement {
  const valueKey = props.yKeys?.[0] || props.valueKey || 'value';
  const labelKey = props.xKey || props.labelKey || 'label';
  const values = data.map(item => normalizeNumber(item?.[valueKey]));
  if (!values.length) {
    return renderEmptyState('No data');
  }
  const { width, height, padding } = cartesianConfig;
  const max = Math.max(...values, 1);
  const barWidth = (width - padding * 2) / Math.max(values.length, 1) - 8;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
      {values.map((value, index) => {
        const x = padding + index * (barWidth + 8);
        const barHeight = (value / max) * (height - padding * 2);
        const y = height - padding - barHeight;
        return (
          <g key={index}>
            <rect
              x={x}
              y={y}
              width={Math.max(barWidth, 6)}
              height={Math.max(barHeight, 2)}
              rx={4}
              fill={pickColor(index, props.colors)}
            />
            <text x={x + Math.max(barWidth, 6) / 2} y={height - padding + 16} textAnchor="middle" className="chart-axis-label">
              {String(data[index]?.[labelKey] ?? '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function renderPieChart(data: any[], props: ChartProps): React.ReactElement {
  const valueKey = props.valueKey || 'value';
  const labelKey = props.labelKey || 'label';
  const total = data.reduce((sum, item) => sum + Math.max(0, normalizeNumber(item?.[valueKey])), 0);
  if (!total) {
    return renderEmptyState('No data');
  }
  const radius = 70;
  let startAngle = 0;

  const segments = data.map((item, index) => {
    const value = Math.max(0, normalizeNumber(item?.[valueKey]));
    const fraction = value / total;
    const sweep = fraction * Math.PI * 2;
    const endAngle = startAngle + sweep;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const x1 = radius + radius * Math.cos(startAngle);
    const y1 = radius + radius * Math.sin(startAngle);
    const x2 = radius + radius * Math.cos(endAngle);
    const y2 = radius + radius * Math.sin(endAngle);
    const d = `M${radius},${radius} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`;
    startAngle = endAngle;

    return (
      <path key={index} d={d} fill={pickColor(index, props.colors)} opacity={0.85} />
    );
  });

  return (
    <div className="chart-pie">
      <svg viewBox={`0 0 ${radius * 2} ${radius * 2}`} className="chart-svg">
        {segments}
      </svg>
      <ul className="chart-legend">
        {data.map((item, index) => (
          <li key={index}>
            <span className="chart-legend-swatch" style={{ background: pickColor(index, props.colors) }} />
            <span>{String(item?.[labelKey] ?? '')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderRadarChart(data: any[], props: ChartProps): React.ReactElement {
  const valueKey = props.valueKey || 'value';
  const labelKey = props.labelKey || 'label';
  const values = data.map(item => Math.max(0, normalizeNumber(item?.[valueKey])));
  if (!values.length) {
    return renderEmptyState('No data');
  }
  const max = Math.max(...values, 1);
  const radius = 80;
  const angleStep = (Math.PI * 2) / values.length;

  const points = values
    .map((value, index) => {
      const ratio = value / max;
      const angle = -Math.PI / 2 + index * angleStep;
      const x = radius + Math.cos(angle) * radius * ratio;
      const y = radius + Math.sin(angle) * radius * ratio;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="chart-radar">
      <svg viewBox={`0 0 ${radius * 2} ${radius * 2}`} className="chart-svg">
        <polygon points={points} fill={pickColor(0, props.colors)} opacity={0.2} />
        <polygon points={points} fill="none" stroke={pickColor(0, props.colors)} strokeWidth={2} />
        {values.map((_, index) => {
          const angle = -Math.PI / 2 + index * angleStep;
          const x = radius + Math.cos(angle) * (radius + 10);
          const y = radius + Math.sin(angle) * (radius + 10);
          return (
            <text key={index} x={x} y={y} textAnchor="middle" className="chart-axis-label">
              {String(data[index]?.[labelKey] ?? '')}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function renderRadialChart(data: any[], props: ChartProps): React.ReactElement {
  const valueKey = props.valueKey || 'value';
  const value = Math.max(0, normalizeNumber(data?.[0]?.[valueKey] ?? 0));
  const max = Math.max(normalizeNumber(data?.[0]?.max ?? 100), 1);
  const percentage = Math.min(1, value / max);
  const size = 160;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage);

  return (
    <div className="chart-radial">
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={pickColor(0, props.colors)}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="chart-radial-value">
          {Math.round(percentage * 100)}%
        </text>
      </svg>
    </div>
  );
}

function renderChartVisualization(props: ChartProps): React.ReactElement {
  const data = Array.isArray(props.data) ? props.data : [];

  switch (props.type) {
    case 'line':
      return renderLineChart(data, props);
    case 'area':
      return renderAreaChart(data, props);
    case 'bar':
      return renderBarChart(data, props);
    case 'pie':
      return renderPieChart(data, props);
    case 'radar':
      return renderRadarChart(data, props);
    case 'radial':
      return renderRadialChart(data, props);
    default:
      return renderEmptyState('Unsupported chart type');
  }
}

export const Chart: React.FC<ChartProps> = ({ title, ...props }) => (
  <div className="card chart-card">
    {title ? <h3 className="chart-title">{title}</h3> : null}
    <div className={`chart-visualization chart-${props.type}`}>
      {renderChartVisualization(props)}
    </div>
  </div>
);

export default Chart;
