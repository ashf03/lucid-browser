import React from 'react';
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../ui/chart";

export interface ChartData {
  type: 'pie' | 'line' | 'bar';
  data: Array<{ [key: string]: string | number }>;
  dataKey: string;
  nameKey: string;
  title?: string;
}

interface ChartProps {
  data: Array<{ [key: string]: string | number }>;
  type: 'pie' | 'line' | 'bar';
  dataKey: string;
  nameKey: string;
  title?: string;
  description?: string;
}

// Define direct color values (Tailwind-inspired palette)
const COLORS = [
  // Blues
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', 
  // Greens
  '#10b981', '#059669', '#047857', '#065f46', 
  // Purples
  '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', 
  // Reds
  '#ef4444', '#dc2626', '#b91c1c', '#991b1b',
  // Oranges/Ambers
  '#f59e0b', '#d97706', '#b45309', '#92400e',
  // Teals/Cyans
  '#06b6d4', '#0891b2', '#0e7490', '#155e75',
  // Pinks/Fuchsias
  '#ec4899', '#db2777', '#be185d', '#9d174d',
  // Indigos
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3'
];

// Helper function to get random colors
const getRandomColors = (count: number) => {
  const selectedColors: string[] = [];
  
  // Create a shuffled copy of the colors array
  const shuffled = [...COLORS].sort(() => 0.5 - Math.random());
  
  // Take the first 'count' colors from the shuffled array
  // If we need more colors than available, cycle through the array again
  for (let i = 0; i < count; i++) {
    selectedColors.push(shuffled[i % shuffled.length]);
  }
  
  return selectedColors;
};

export const DynamicChart: React.FC<ChartProps> = ({ 
  data, 
  type, 
  dataKey, 
  nameKey,
  title = 'Data Visualization',
  description = ''
}) => {
  // Enhanced data validation
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('Invalid or empty data provided to chart');
    return null;
  }

  // Enhanced key validation with type checking
  const isValidData = data.every(item => 
    typeof item[dataKey] === 'number' && 
    typeof item[nameKey] === 'string'
  );

  if (!isValidData) {
    console.error('Invalid data types in chart data');
    return null;
  }

  // Convert string numbers to actual numbers if needed
  const normalizedData = data.map(item => ({
    ...item,
    [dataKey]: typeof item[dataKey] === 'string' ? parseFloat(item[dataKey] as string) : item[dataKey]
  }));

  // Chart configuration for shadcn/ui components
  const chartConfig = {
    [dataKey]: {
      label: dataKey,
      color: 'hsl(var(--primary))',
    }
  } as ChartConfig;

  switch (type) {
    case 'line':
      return (
        <Card className='shadow-none border-none w-full bg-transparent outline-none'>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description || `${normalizedData[0]?.[nameKey] ? normalizedData[0][nameKey].toString().slice(0, 4) : ''} - ${normalizedData[normalizedData.length-1]?.[nameKey] ? normalizedData[normalizedData.length-1][nameKey].toString().slice(0, 4) : ''} ${new Date().getFullYear()}`}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <LineChart
                accessibilityLayer
                data={normalizedData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey={nameKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => 
                    typeof value === 'string' && value.length > 3 
                      ? value.slice(0, 3)
                      : value
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Line
                  dataKey={dataKey}
                  type="natural"
                  stroke={COLORS[0]}
                  strokeWidth={2}
                  dot={{
                    fill: COLORS[0],
                  }}
                  activeDot={{
                    r: 6,
                  }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="leading-none text-muted-foreground">
              Showing {dataKey} values for {normalizedData.length} {nameKey} entries
            </div>
          </CardFooter>
        </Card>
      );

    case 'bar':
      return (
        <Card className='border-none shadow-none bg-transparent outline-none w-full'>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description || `${normalizedData[0]?.[nameKey] ? normalizedData[0][nameKey].toString().slice(0, 4) : ''} - ${normalizedData[normalizedData.length-1]?.[nameKey] ? normalizedData[normalizedData.length-1][nameKey].toString().slice(0, 4) : ''} ${new Date().getFullYear()}`}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <BarChart 
                data={normalizedData}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey={nameKey}
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  interval={0}
                  tick={{ fill: '#666', fontSize: 12 }}
                  tickFormatter={(value) => 
                    typeof value === 'string' && value.length > 3 
                      ? value.slice(0, 3)
                      : value
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar 
                  dataKey={dataKey} 
                  fill="#3b82f6"
                  radius={4}
                >
                  {(() => {
                    // Get random color selection for each data point
                    const randomColors = getRandomColors(normalizedData.length);
                    
                    return normalizedData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={randomColors[index]}
                      />
                    ));
                  })()}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="leading-none text-muted-foreground">
              Showing {dataKey} values for {normalizedData.length} {nameKey} entries
            </div>
          </CardFooter>
        </Card>
      );

    case 'pie':
      return (
        <Card className="flex flex-col bg-transparent w-full outline-none border-none shadow-none">
          <CardHeader className="items-center pb-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description || `${new Date().getFullYear()}`}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-[250px] px-0"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey={nameKey} hideLabel />}
                />
                <Pie
                  data={normalizedData}
                  dataKey={dataKey}
                  nameKey={nameKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  labelLine={false}
                  label={({ payload, ...props }) => {
                    return (
                      <text
                        cx={props.cx}
                        cy={props.cy}
                        x={props.x}
                        y={props.y}
                        textAnchor={props.textAnchor}
                        dominantBaseline={props.dominantBaseline}
                        fill="hsla(var(--foreground))"
                      >
                        {payload[dataKey]}
                      </text>
                    )
                  }}
                >
                  {(() => {
                    const pieColors = getRandomColors(normalizedData.length);
                    return normalizedData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index]} />
                    ));
                  })()}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col gap-2 text-sm">
            <div className="leading-none text-muted-foreground">
              Showing {dataKey} distribution across {normalizedData.length} {nameKey} entries
            </div>
          </CardFooter>
        </Card>
      );

    default:
      return null;
  }
};

export default DynamicChart;