// @ts-nocheck

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

export const AutomationRunner = () => {
  const [status, setStatus] = useState('Idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<string | null>(null);

  const runAutomation = async () => {
    setStatus('Running');
    setLogs(prevLogs => [...prevLogs, 'Starting automation...']);
    setExcelData(null);

    try {
      const response = await fetch('/api/run-automation', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setLogs(prevLogs => [...prevLogs, 'Automation completed successfully']);
        setStatus('Completed');
        setExcelData(data.excelBuffer);
      } else {
        throw new Error(data.error || 'An error occurred');
      }
    } catch (error) {
      setLogs(prevLogs => [...prevLogs, `Error: ${error.message}`]);
      setStatus('Error');
    }
  };

  const downloadExcel = () => {
    if (excelData) {
      const blob = new Blob([Buffer.from(excelData, 'base64')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PASSWORD VALIDATION - KRA - COMPANIES.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      <Button onClick={runAutomation} disabled={status === 'Running'}>
        {status === 'Running' ? 'Running...' : 'Start Automation'}
      </Button>
      {excelData && (
        <Button onClick={downloadExcel} className="ml-4">
          Download Excel Report
        </Button>
      )}
      <div className="mt-4">
        <h3 className="text-lg font-semibold">Status: {status}</h3>
        <div className="mt-2 p-4 bg-gray-100 rounded">
          <h4 className="font-semibold mb-2">Logs:</h4>
          {logs.map((log, index) => (
            <p key={index}>{log}</p>
          ))}
        </div>
      </div>
    </div>
  );
};