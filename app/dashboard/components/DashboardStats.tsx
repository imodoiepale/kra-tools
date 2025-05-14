// app/dashboard/components/DashboardStats.tsx

import {
    CheckCircleIcon,
    AlertCircleIcon,
    ClockIcon,
    TimerIcon,
    KeyIcon,
    DownloadIcon,
    FileTextIcon,
    CheckIcon,
    MessageSquareIcon
} from "lucide-react";
import { AutomationStats } from "../types";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardStatsProps {
    stats: AutomationStats;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
    const statusStats = [
        {
            label: "Success",
            value: stats.success,
            icon: CheckCircleIcon,
            color: "text-emerald-500",
            bgColor: "bg-emerald-50"
        },
        {
            label: "Failed",
            value: stats.failed,
            icon: AlertCircleIcon,
            color: "text-red-500",
            bgColor: "bg-red-50"
        },
        {
            label: "In Progress",
            value: stats.inProgress,
            icon: ClockIcon,
            color: "text-blue-500",
            bgColor: "bg-blue-50"
        },
        {
            label: "Pending",
            value: stats.pending,
            icon: TimerIcon,
            color: "text-amber-500",
            bgColor: "bg-amber-50"
        },
    ];

    const typeStats = [
        {
            label: "Authentication",
            value: stats.byType.authentication,
            icon: KeyIcon,
            color: "text-indigo-500",
            bgColor: "bg-indigo-50"
        },
        {
            label: "Extraction",
            value: stats.byType.extraction,
            icon: DownloadIcon,
            color: "text-emerald-500",
            bgColor: "bg-emerald-50"
        },
        {
            label: "Compliance",
            value: stats.byType.compliance,
            icon: FileTextIcon,
            color: "text-amber-500",
            bgColor: "bg-amber-50"
        },
        {
            label: "Verification",
            value: stats.byType.verification,
            icon: CheckIcon,
            color: "text-blue-500",
            bgColor: "bg-blue-50"
        },
        {
            label: "Communication",
            value: stats.byType.communication,
            icon: MessageSquareIcon,
            color: "text-pink-500",
            bgColor: "bg-pink-50"
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4">Status Overview</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {statusStats.map((stat) => (
                            <div key={stat.label} className="flex flex-col items-center p-4 rounded-lg border">
                                <div className={`p-2 rounded-full ${stat.bgColor} ${stat.color} mb-2`}>
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                <span className="text-2xl font-semibold">{stat.value}</span>
                                <span className="text-sm text-gray-500">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4">Automation Types</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {typeStats.map((stat) => (
                            <div key={stat.label} className="flex flex-col items-center p-3 rounded-lg border">
                                <div className={`p-2 rounded-full ${stat.bgColor} ${stat.color} mb-2`}>
                                    <stat.icon className="h-4 w-4" />
                                </div>
                                <span className="text-xl font-semibold">{stat.value}</span>
                                <span className="text-xs text-gray-500 text-center">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}