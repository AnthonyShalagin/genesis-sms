"use client";

import { useEffect, useState } from "react";

interface CommandLog {
  id: string;
  command: string;
  sender: string;
  status: string;
  response: string | null;
  error: string | null;
  createdAt: string;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchLogs() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setLogs(data.logs);
    } catch {
      console.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    success: "text-green-400",
    failed: "text-red-400",
    rejected: "text-yellow-400",
    pending: "text-blue-400",
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Genesis GV70 SMS Control</h1>
        <p className="text-gray-400">
          Text a command to your Gmail address to control your vehicle.
        </p>
        <div className="mt-4 bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-sm text-gray-400 mb-2">Available commands:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <code className="bg-gray-800 px-2 py-1 rounded">START [PIN]</code>
            <code className="bg-gray-800 px-2 py-1 rounded">STOP [PIN]</code>
            <code className="bg-gray-800 px-2 py-1 rounded">LOCK [PIN]</code>
            <code className="bg-gray-800 px-2 py-1 rounded">UNLOCK [PIN]</code>
            <code className="bg-gray-800 px-2 py-1 rounded">STATUS [PIN]</code>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Command Log</h2>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500">No commands yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left py-2 pr-4">Time</th>
                <th className="text-left py-2 pr-4">Command</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2">Response</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-gray-900 hover:bg-gray-900/50"
                >
                  <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 font-mono uppercase">
                    {log.command}
                  </td>
                  <td
                    className={`py-2 pr-4 font-semibold ${statusColor[log.status] || "text-gray-400"}`}
                  >
                    {log.status}
                  </td>
                  <td className="py-2 text-gray-300">
                    {log.response || log.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
