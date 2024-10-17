// PasswordCheckerRunning.tsx
// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Progress } from "@/components/ui/progress";
import { supabase } from '@/lib/supabase';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface PasswordCheckerRunningProps {
    onComplete: () => void;
    progress: number;
    status: string;
    activeTab: string; // Add activeTab prop
    setActiveTab: (tab: string) => void; // Add setActiveTab prop
}

export function PasswordCheckerRunning({ onComplete, progress, status, activeTab, setActiveTab }: PasswordCheckerRunningProps) {
    const [logs, setLogs] = useState([]);
    const [totalCompanies, setTotalCompanies] = useState(0);

    useEffect(() => {
        const fetchTotalCompanies = async () => {
            const { count } = await supabase
                .from('PasswordChecker')
                .select('*', { count: 'exact' });

            setTotalCompanies(count || 0);
        };

        fetchTotalCompanies();

        const fetchLogs = async () => {
            const { data, error } = await supabase
                .from('AutomationProgress')
                .select('logs')
                .eq('id', 1)
                .single();

            if (data && data.logs) {
                setLogs(data.logs);
            }
        };

        fetchLogs();

        const channel = supabase
            .channel('table-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'AutomationProgress',
                },
                (payload) => {
                    if (payload.new && payload.new.logs) {
                        setLogs(payload.new.logs);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (status === "Completed") {
            onComplete();
            setActiveTab("reports"); // Navigate to reports tab when completed
        }
    }, [status, onComplete, setActiveTab]);

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Password Check in Progress</h3>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-500">
                Status: {status}
            </p>
            <p className="text-sm text-gray-500">
                {Math.round(progress / 100 * totalCompanies)} out of {totalCompanies} companies checked ({progress.toFixed(1)}%)
            </p>

            <div className="overflow-x-auto">
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                    <Table>
                        <TableCaption>Password Check Logs</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky top-0 bg-white">#</TableHead>
                                <TableHead className="sticky top-0 bg-white">Company</TableHead>
                                <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                <TableHead className="sticky top-0 bg-white">Password</TableHead>
                                <TableHead className="sticky top-0 bg-white">Status</TableHead>
                                <TableHead className="sticky top-0 bg-white">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{log.company_name}</TableCell>
                                    <TableCell>{log.kra_pin}</TableCell>
                                    <TableCell>{log.kra_password}</TableCell>
                                    <TableCell>{log.status}</TableCell>
                                    <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}