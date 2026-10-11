"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@jotdown/core/components/ui/chart";

type Row = Record<string, string | number>;

type ChartProps = {
  type: "bar" | "line" | "area" | "pie" | "radar";
  data: Row[];
  x: string;
  series: Record<string, string>;
  stacked?: boolean;
  horizontal?: boolean;
  unit?: string;
  caption?: string;
};

/**
 * A chart of literal data, written straight into a page, in the brand's chart palette.
 *
 * `x` names the field every row is labelled by, and `series` maps each plotted
 * field to its label, coloured `--chart-1` to `--chart-5` in the order given. A
 * pie plots its one series and colours each row instead. A legend appears once
 * there is more than one thing to tell apart.
 *
 * @example <Chart type="bar" x="month" data={[{ month: "Jan", saves: 186 }]} series={{ saves: "Studio saves" }} />
 */
export default function Chart({ type, data, x, series, stacked, horizontal, unit, caption }: ChartProps) {
  const keys = Object.keys(series);
  const round = type === "pie" || type === "radar";
  const config = type === "pie" ? sliceConfig(data, x) : seriesConfig(series);

  return (
    <figure className="my-8">
      <div className="rounded-(--jd-radius) border border-border bg-card p-5">
        <ChartContainer config={config} className={round ? "mx-auto aspect-square max-h-80" : "aspect-2/1 w-full"}>
          {plot({ type, data, x, keys, stacked, horizontal, unit })}
        </ChartContainer>
      </div>
      {caption && <figcaption className="mt-3 text-1sm text-muted-foreground leading-normal">{caption}</figcaption>}
    </figure>
  );
}

/** The Recharts chart for one `type`, with the axes, tooltip and legend that type wants. */
function plot({
  type,
  data,
  x,
  keys,
  stacked,
  horizontal,
  unit,
}: Omit<ChartProps, "series" | "caption"> & { keys: string[] }) {
  switch (type) {
    case "bar":
      return barChart(data, x, keys, { stacked, horizontal, unit });
    case "line":
      return lineChart(data, x, keys, unit);
    case "area":
      return areaChart(data, x, keys, { stacked, unit });
    case "pie": {
      const [value] = keys;
      return value === undefined ? null : pieChart(data, x, value);
    }
    case "radar":
      return radarChart(data, x, keys);
  }
}

/**
 * The palette colour of the n-th series or slice, wrapping after five.
 *
 * @example color(0); // "var(--chart-1)"
 */
function color(index: number) {
  return `var(--chart-${(index % 5) + 1})`;
}

function seriesConfig(series: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(series).map(([key, label], index) => [key, { label, color: color(index) }]),
  ) satisfies ChartConfig;
}

function sliceConfig(data: Row[], x: string) {
  return Object.fromEntries(
    data.map((row, index) => [String(row[x]), { label: String(row[x]), color: color(index) }]),
  ) satisfies ChartConfig;
}

function barChart(
  data: Row[],
  x: string,
  keys: string[],
  { stacked, horizontal, unit }: { stacked?: boolean; horizontal?: boolean; unit?: string },
) {
  return (
    <BarChart accessibilityLayer data={data} layout={horizontal ? "vertical" : "horizontal"}>
      <CartesianGrid vertical={!!horizontal} horizontal={!horizontal} />
      {horizontal ? (
        <>
          <YAxis type="category" dataKey={x} tickLine={false} axisLine={false} width={96} />
          <XAxis type="number" tickLine={false} axisLine={false} unit={unit} />
        </>
      ) : (
        <>
          <XAxis dataKey={x} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={48} unit={unit} />
        </>
      )}
      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
      {keys.length > 1 && <ChartLegend itemSorter={null} content={<ChartLegendContent />} />}
      {keys.map((key, index) => (
        <Bar
          key={key}
          dataKey={key}
          fill={color(index)}
          radius={4}
          maxBarSize={40}
          stackId={stacked ? "stack" : undefined}
        />
      ))}
    </BarChart>
  );
}

function lineChart(data: Row[], x: string, keys: string[], unit?: string) {
  return (
    <LineChart accessibilityLayer data={data}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey={x} tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} width={48} unit={unit} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
      {keys.length > 1 && <ChartLegend itemSorter={null} content={<ChartLegendContent />} />}
      {keys.map((key, index) => (
        <Line key={key} dataKey={key} type="monotone" stroke={color(index)} strokeWidth={2} dot={false} />
      ))}
    </LineChart>
  );
}

function areaChart(data: Row[], x: string, keys: string[], { stacked, unit }: { stacked?: boolean; unit?: string }) {
  return (
    <AreaChart accessibilityLayer data={data}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey={x} tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} width={48} unit={unit} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
      {keys.length > 1 && <ChartLegend itemSorter={null} content={<ChartLegendContent />} />}
      {keys.map((key, index) => (
        <Area
          key={key}
          dataKey={key}
          type="monotone"
          stroke={color(index)}
          fill={color(index)}
          fillOpacity={0.25}
          stackId={stacked ? "stack" : undefined}
        />
      ))}
    </AreaChart>
  );
}

function pieChart(data: Row[], x: string, value: string) {
  return (
    <PieChart>
      <ChartTooltip content={<ChartTooltipContent nameKey={x} hideLabel />} />
      <Pie data={data} dataKey={value} nameKey={x} innerRadius="55%" strokeWidth={2}>
        {data.map((row, index) => (
          <Cell key={String(row[x])} fill={color(index)} />
        ))}
      </Pie>
      <ChartLegend itemSorter={null} content={<ChartLegendContent nameKey={x} />} />
    </PieChart>
  );
}

function radarChart(data: Row[], x: string, keys: string[]) {
  return (
    <RadarChart data={data} outerRadius="70%">
      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
      <PolarGrid />
      <PolarAngleAxis dataKey={x} />
      {keys.length > 1 && <ChartLegend itemSorter={null} content={<ChartLegendContent />} />}
      {keys.map((key, index) => (
        <Radar key={key} dataKey={key} stroke={color(index)} fill={color(index)} fillOpacity={0.3} />
      ))}
    </RadarChart>
  );
}
