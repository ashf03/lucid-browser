import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Activity } from 'lucide-react';
import { Cpu, Equalizer, Memory, Rss, TreeStructure } from '@phosphor-icons/react';

export interface MemoryData {
  process: {
    heapTotal: number;
    heapUsed: number;
    external: number;
    rss: number;
  };
  timestamp: number;
}

const MemoryUsage: React.FC = () => {
  const [memoryData, setMemoryData] = useState<MemoryData[]>([]);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchMemoryUsage = async () => {
      try {
        const data = await window.electronAPI.ipcRenderer.invoke('get-memory-usage');
        setMemoryData(prev => {
          const newData = [...prev, { ...data, timestamp: Date.now() }];
          return newData.slice(-60);
        });
      } catch (error) {
        console.error('Failed to fetch memory usage:', error);
        setIsRunning(false);
      }
    };

    if (isRunning) {
      fetchMemoryUsage();
      intervalId = setInterval(fetchMemoryUsage, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const getCurrentMemoryUsage = () => {
    if (memoryData.length === 0) return null;
    return memoryData[memoryData.length - 1];
  };

  const currentMemory = getCurrentMemoryUsage();

  const MemoryMetricCard = ({ title, value, icon: Icon, color }: { 
    title: string; 
    value: string; 
    icon: React.ElementType;
    color: string;
  }) => (
    <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <h4 className="font-medium text-sm text-zinc-600 dark:text-zinc-400">{title}</h4>
      </div>
      <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <Card className="border-none shadow-transparent bg-background border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <div className="flex items-center pb-3 gap-2">
            <Equalizer className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl text-zinc-900 dark:text-zinc-50">Memory Usage Monitor</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {currentMemory && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MemoryMetricCard
                title="RSS Memory"
                value={formatBytes(currentMemory.process.rss)}
                icon={Rss}
                color="text-zinc-800 dark:text-zinc-400"
              />
              <MemoryMetricCard
                title="Heap Total"
                value={formatBytes(currentMemory.process.heapTotal)}
                icon={TreeStructure}
                color="text-zinc-800 dark:text-zinc-400"
              />
              <MemoryMetricCard
                title="Heap Used"
                value={formatBytes(currentMemory.process.heapUsed)}
                icon={Cpu}
                color="text-zinc-800 dark:text-zinc-400"
              />
              <MemoryMetricCard
                title="External"
                value={formatBytes(currentMemory.process.external)}
                icon={Memory}
                color="text-zinc-800 dark:text-zinc-400"
              />
            </div>
          )}

          <div className="h-72 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={memoryData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                  opacity={0.4}
                />
                <XAxis
                  dataKey="timestamp"
                  domain={['auto', 'auto']}
                  tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                />
                <YAxis
                  tickFormatter={(value) => `${(value / 1024 / 1024).toFixed(0)}MB`}
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                />
                <Tooltip
                  formatter={(value: number) => formatBytes(value)}
                  labelFormatter={(timestamp) => new Date(Number(timestamp)).toLocaleTimeString()}
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--foreground)'
                  }}
                />
                <Legend className="text-zinc-600 dark:text-zinc-400" />
                <Line
                  type="monotone"
                  dataKey="process.heapUsed"
                  stroke="rgb(113 113 122)"
                  name="Heap Used"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="process.rss"
                  stroke="rgb(113 113 122)"
                  name="RSS"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemoryUsage;