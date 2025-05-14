// app/dashboard/components/details/LogsList.tsx

import { ScrollArea } from "@/components/ui/scroll-area";
import { LogEntry } from "../../types";
import { formatDateRelative } from "../../utils/sampleData";
import { AlertTriangleIcon, AlertCircleIcon, InfoIcon, CheckCircleIcon } from "lucide-react";

interface LogsListProps {
    logs: LogEntry[];
}

export function LogsList({ logs }: LogsListProps) {
    if (logs.length === 0) {
        return (
            <div className="text-center py-8 border rounded-lg bg-gray-50">
                <p className="text-gray-500">No logs available</p>
            </div>
        );
    }

    // Sort logs by timestamp (newest first)
    const sortedLogs = [...logs].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const getLogIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <CheckCircleIcon className="h-4 w-4 text-emerald-500" />;
            case 'error':
                return <AlertCircleIcon className="h-4 w-4 text-red-500" />;
            case 'warning':
                return <AlertTriangleIcon className="h-4 w-4 text-amber-500" />;
            case 'info':
            default:
                return <InfoIcon className="h-4 w-4 text-blue-500" />;
        }
    };

    const getLogBorderClass = (type: string) => {
        switch (type) {
            case 'success': return 'border-l-emerald-500';
            case 'error': return 'border-l-red-500';
            case 'warning': return 'border-l-amber-500';
            case 'info':
            default: return 'border-l-blue-500';
        }
    };

    return (
        <ScrollArea className="h-60 border rounded-lg">
            <div className="p-4 space-y-3">
                {sortedLogs.map((log, index) => (
                    <div
                        key={index}
                        className={`pl-4 py-2 border-l-2 ${getLogBorderClass(log.type)}`}
                    >
                        <div className="flex items-start">
                            <div className="mr-2 mt-0.5">
                                {getLogIcon(log.type)}
                            </div>
                            <div>
                                <p className="text-sm">{log.message}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {formatDateRelative(log.timestamp)}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}