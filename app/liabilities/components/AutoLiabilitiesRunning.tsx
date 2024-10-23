// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, PlayCircle, StopCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function AutoLiabilitiesRunning({ onComplete }) {
    const [progress, setProgress] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [currentCompany, setCurrentCompany] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState(null);
    
    useEffect(() => {
        const fetchInitialProgress = async () => {
            await fetchProgress();
        };
    
        fetchInitialProgress();
        const interval = setInterval(fetchProgress, 5000);
        return () => clearInterval(interval);
    }, []);
    
    const fetchProgress = async () => {
        try {
            const response = await fetch('/api/liability-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'progress' })
            });
            
            const data = await response.json();
            console.log('Fetched Data:', data);
            setProgress(data.progress === 'error' ? 0 : data.progress);
            setIsRunning(data.isRunning);
            setStatus(data.progress === 'error' ? 'error' : data.status || 'running');
            setCurrentCompany(data.currentCompany);
            setLogs(data.logs || []);
    
            if (!data.isRunning && data.progress === 100) {
                onComplete();
            }
        } catch (error) {
            console.error('Error fetching progress:', error);
        }
    };
    
    const handleStop = async () => {
        try {
            const response = await fetch('/api/liability-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop', updateQueued: true })
            });
            if (response.ok) {
                setIsRunning(false);
                setStatus('stopped');
                // Refresh the logs to show updated statuses
                await fetchProgress();
                onComplete();
            } else {
                throw new Error('Failed to stop extraction');
            }
        } catch (error) {
            console.error('Error stopping extraction:', error);
            alert('Failed to stop extraction. Please try again.');
        }
    };

    const handleResume = async () => {
        try {
          setError(null); // Clear any previous errors
          
          // Validate required data before making request
          if (!currentCompany) {
            throw new Error('No company selected for resume');
          }
          
          const response = await fetch('/api/liability-extractor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'resume',
              company: currentCompany,
              lastProgress: progress,
              // Add company ID if available
              companyId: logs.find(log => log.company === currentCompany)?.id
            })
          });
          
          const data = await response.json(); // Parse response data
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to resume extraction');
          }
          
          setIsRunning(true);
          setStatus('running');
          await fetchProgress();
          
        } catch (error) {
          console.error('Error resuming extraction:', error);
          setError(error.message);
          setStatus('error');
        }
      };
      
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Auto Ledger Extraction in Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Progress value={progress} className="w-full" />
                <div className="flex justify-between items-center">
                    <p className="text-lg font-medium">{progress}% complete</p>
                    <div className="space-x-2">
                        {status === 'running' ? (
                            <Button 
                                onClick={handleStop} 
                                variant="destructive" 
                                size="lg"
                                className="flex items-center gap-2"
                            >
                                <StopCircle className="w-4 h-4" />
                                Stop Extraction
                            </Button>
                        ) : (
                            <Button 
                                onClick={handleResume}
                                variant="default"
                                size="lg"
                                className="flex items-center gap-2"
                            >
                                <PlayCircle className="w-4 h-4" />
                                Resume Extraction
                            </Button>
                        )}
                    </div>
                </div>
                {currentCompany && (
                    <div className={`flex items-center p-4 text-sm rounded-lg ${
                        status === 'running' ? 'text-blue-800 border-blue-300 bg-blue-50' :
                        status === 'stopped' ? 'text-yellow-800 border-yellow-300 bg-yellow-50' :
                        'text-green-800 border-green-300 bg-green-50'
                    }`} role="alert">
                        <AlertCircle className="flex-shrink-0 inline w-4 h-4 mr-3" />
                        <div>
                            <span className="font-medium">Currently processing:</span> {currentCompany}
                            <span className="ml-2">({status})</span>
                        </div>
                    </div>
                )}
                <div className="h-[300px] overflow-y-auto border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Company</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead>Last Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index}>
                                    <TableCell>{log.company}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                            log.status === 'running' ? 'bg-blue-100 text-blue-800' :
                                            log.status === 'stopped' ? 'bg-yellow-100 text-yellow-800' :
                                            log.status === 'queued' ? 'bg-purple-100 text-purple-800' :
                                            log.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            log.status === 'error' || (log.progress < 100 && log.status !== 'running') ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {log.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>{log.progress}%</TableCell>
                                    <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}