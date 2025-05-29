// @ts-nocheck
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    FileText,
    CheckCircle,
    Clock,
    AlertTriangle,
    TrendingUp,
    Building2,
    Calendar,
    BarChart3,
    Download,
    RefreshCw,
    Users,
    Package,
    Target
} from "lucide-react";
import { format } from "date-fns";
import { FileManagementStats, Company, FileRecord } from '../types/fileManagement';

interface DashboardProps {
    stats: FileManagementStats;
    companies: Company[];
    fileRecords: FileRecord[];
    onRefresh: () => void;
    isLoading?: boolean;
}

export default function Dashboard({
    stats,
    companies,
    fileRecords,
    onRefresh,
    isLoading = false
}: DashboardProps) {

    // Calculate monthly trends
    const monthlyTrends = useMemo(() => {
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            return {
                month: format(date, 'MMM'),
                year: date.getFullYear(),
                monthIndex: date.getMonth() + 1
            };
        }).reverse();

        return last6Months.map(({ month, year, monthIndex }) => {
            const monthRecords = fileRecords.filter(record =>
                record.year === year && record.month === monthIndex
            );

            return {
                month,
                received: monthRecords.filter(r => r.received_at).length,
                delivered: monthRecords.filter(r => r.delivered_at).length
            };
        });
    }, [fileRecords]);

    // Calculate category breakdown
    const categoryBreakdown = useMemo(() => {
        const categories = companies.reduce((acc, company) => {
            acc[company.category] = (acc[company.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(categories).map(([category, count]) => ({
            category: category.charAt(0).toUpperCase() + category.slice(1),
            count,
            percentage: (count / companies.length) * 100
        }));
    }, [companies]);

    // Calculate performance metrics
    const performanceMetrics = useMemo(() => {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const thisMonthRecords = fileRecords.filter(r =>
            r.year === currentYear && r.month === currentMonth
        );

        const avgProcessingTime = thisMonthRecords
            .filter(r => r.received_at && r.delivered_at)
            .reduce((acc, record) => {
                const received = new Date(record.received_at!);
                const delivered = new Date(record.delivered_at!);
                const days = Math.ceil((delivered.getTime() - received.getTime()) / (1000 * 60 * 60 * 24));
                return acc + days;
            }, 0) / thisMonthRecords.filter(r => r.received_at && r.delivered_at).length || 0;

        return {
            avgProcessingTime: Math.round(avgProcessingTime),
            onTimeDelivery: 95, // Calculate based on your SLA
            clientSatisfaction: 4.8 // From feedback system
        };
    }, [fileRecords]);

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600 mt-1">
                        File management overview for {format(new Date(), 'MMMM yyyy')}
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="flex items-center"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Download className="h-4 w-4 mr-2" />
                        Export Report
                    </Button>
                </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Total Companies</CardTitle>
                        <div className="p-2 bg-blue-100 rounded-full">
                            <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{stats.total_companies}</div>
                        <div className="flex items-center mt-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                Active: {companies.filter(c => c.status === 'active').length}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Files Received</CardTitle>
                        <div className="p-2 bg-green-100 rounded-full">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.received_this_month}</div>
                        <div className="mt-2">
                            <Progress value={stats.completion_rate} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">
                                {stats.completion_rate.toFixed(1)}% completion rate
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Files Delivered</CardTitle>
                        <div className="p-2 bg-purple-100 rounded-full">
                            <Package className="h-4 w-4 text-purple-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{stats.delivered_this_month}</div>
                        <div className="mt-2">
                            <Progress value={stats.delivery_rate} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">
                                {stats.delivery_rate.toFixed(1)}% delivery rate
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Pending Items</CardTitle>
                        <div className="p-2 bg-red-100 rounded-full">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {stats.pending_receipt + stats.pending_delivery}
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                                Receipt: {stats.pending_receipt}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                Delivery: {stats.pending_delivery}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center text-blue-800">
                            <Target className="h-5 w-5 mr-2" />
                            Performance Metrics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Avg Processing Time</span>
                            <Badge className="bg-blue-100 text-blue-800">
                                {performanceMetrics.avgProcessingTime} days
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">On-time Delivery</span>
                            <Badge className="bg-green-100 text-green-800">
                                {performanceMetrics.onTimeDelivery}%
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Client Satisfaction</span>
                            <Badge className="bg-yellow-100 text-yellow-800">
                                ⭐ {performanceMetrics.clientSatisfaction}/5.0
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center text-blue-800">
                            <Users className="h-5 w-5 mr-2" />
                            Company Categories
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {categoryBreakdown.map((item, index) => (
                            <div key={item.category} className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">{item.category}</span>
                                    <Badge variant="secondary">{item.count}</Badge>
                                </div>
                                <Progress value={item.percentage} className="h-2" />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center text-blue-800">
                            <Clock className="h-5 w-5 mr-2" />
                            Quick Actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700">
                            <FileText className="h-4 w-4 mr-2" />
                            Process Pending Files
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                            <Calendar className="h-4 w-4 mr-2" />
                            Schedule Deliveries
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Send Reminders
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Trends Chart */}
            <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center text-blue-800">
                        <TrendingUp className="h-5 w-5 mr-2" />
                        Monthly Trends (Last 6 Months)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center space-x-4 text-sm">
                            <div className="flex items-center">
                                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                                <span>Files Received</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                <span>Files Delivered</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {monthlyTrends.map((trend, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">{trend.month}</span>
                                        <div className="flex space-x-4 text-sm">
                                            <span className="text-blue-600">↑ {trend.received}</span>
                                            <span className="text-green-600">↓ {trend.delivered}</span>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full"
                                                style={{ width: `${(trend.received / Math.max(...monthlyTrends.map(t => t.received))) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full"
                                                style={{ width: `${(trend.delivered / Math.max(...monthlyTrends.map(t => t.delivered))) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center text-blue-800">
                        <BarChart3 className="h-5 w-5 mr-2" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {fileRecords
                            .filter(record => record.updated_at)
                            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                            .slice(0, 5)
                            .map((record, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-2 rounded-full ${record.status === 'delivered' ? 'bg-green-100' :
                                                record.status === 'received' ? 'bg-blue-100' :
                                                    record.status === 'nil' ? 'bg-red-100' : 'bg-gray-100'
                                            }`}>
                                            {record.status === 'delivered' ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                                                record.status === 'received' ? <FileText className="h-4 w-4 text-blue-600" /> :
                                                    record.status === 'nil' ? <AlertTriangle className="h-4 w-4 text-red-600" /> :
                                                        <Clock className="h-4 w-4 text-gray-600" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{record.company_name}</p>
                                            <p className="text-xs text-gray-500">
                                                {record.status === 'delivered' ? 'Documents delivered' :
                                                    record.status === 'received' ? 'Documents received' :
                                                        record.status === 'nil' ? 'Marked as NIL' : 'Status updated'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">
                                            {format(new Date(record.updated_at), 'MMM d, HH:mm')}
                                        </p>
                                        <Badge variant="outline" className="text-xs">
                                            {format(new Date(record.year, record.month - 1), 'MMM yyyy')}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}