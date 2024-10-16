// PasswordCheckerRunning.tsx
// @ts-nocheck
import { useEffect, useState } from 'react';
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
    isChecking: boolean;
    handleStopCheck: () => void;
    activeTab: string; // Add activeTab prop
}

export default function PasswordCheckerRunning({ progress, status, isChecking, handleStopCheck, onComplete, activeTab }: PasswordCheckerRunningProps) {
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
                .from('PasswordChecker_AutomationProgress')
                .select('logs')
                .eq('id', 1)
                .single();

            if (data && data.logs) {
                // Filter logs based on activeTab
                const filteredLogs = data.logs.filter(log => log.tab === activeTab);
                setLogs(filteredLogs);
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
                    table: 'PasswordChecker_AutomationProgress',
                },
                (payload) => {
                    if (payload.new && payload.new.logs) {
                        const filteredLogs = payload.new.logs.filter(log => log.tab === activeTab);
                        setLogs(filteredLogs);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeTab]); // Add activeTab as a dependency

    useEffect(() => {
        if (status === "Completed") {
            onComplete();
        }
    }, [status, onComplete]);

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
                                {activeTab === 'kra' && (
                                    <>
                                        <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                        <TableHead className="sticky top-0 bg-white">KRA Password</TableHead>
                                    </>
                                )}
                                {activeTab === 'nssf' && (
                                    <>
                                        <TableHead className="sticky top-0 bg-white">NSSF ID</TableHead>
                                        <TableHead className="sticky top-0 bg-white">NSSF Password</TableHead>
                                    </>
                                )}
                                {activeTab === 'nhif' && (
                                    <>
                                        <TableHead className="sticky top-0 bg-white">NHIF ID</TableHead>
                                        <TableHead className="sticky top-0 bg-white">NHIF Password</TableHead>
                                        <TableHead className="sticky top-0 bg-white">NHIF Code</TableHead>
                                    </>
                                )}
                                {activeTab === 'ecitizen' && (
                                    <>
                                        <TableHead className="sticky top-0 bg-white">eCitizen ID</TableHead>
                                        <TableHead className="sticky top-0 bg-white">eCitizen Password</TableHead>
                                        <TableHead className="sticky top-0 bg-white">Director</TableHead>
                                    </>
                                )}
                                {activeTab === 'quickbooks' && (
                                    <>
                                        <TableHead className="sticky top-0 bg-white">ID</TableHead>
                                        <TableHead className="sticky top-0 bg-white">Password</TableHead>
                                    </>
                                )}
                                <TableHead className="sticky top-0 bg-white">Status</TableHead>
                                <TableHead className="sticky top-0 bg-white">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{log.company_name}</TableCell>
                                    {activeTab === 'kra' ? (
                                        <>
                                            <TableCell>{log.kra_pin}</TableCell>
                                            <TableCell>{log.kra_password}</TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell>{log.identifier}</TableCell>
                                            <TableCell>{log.password}</TableCell>
                                        </>
                                    )}
                                    {(activeTab === 'nhif' || activeTab === 'nssf') && (
                                        <TableCell>{log.code}</TableCell>
                                    )}
                                    {activeTab === 'ecitizen' && (
                                        <TableCell>{log.director}</TableCell>
                                    )}
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