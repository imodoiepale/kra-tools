// app/dashboard/utils/sampleData.ts

import { Automation } from '../types';

export const sampleAutomations: Automation[] = [
    {
        id: '1',
        name: 'KRA Portal Login',
        description: 'Automates login using credentials stored in Supabase',
        type: 'authentication',
        cron_schedule: 'Daily at 8:00 AM',
        last_run_at: '2023-05-15T10:30:00',
        next_run_at: '2023-05-15T11:00:00',
        status: 'success',
        companies: [
            { id: 'c1', name: 'Company A', status: 'success', last_run: '2023-05-15T10:30:00' },
            { id: 'c2', name: 'Company B', status: 'success', last_run: '2023-05-15T10:30:00' },
            { id: 'c3', name: 'Company C', status: 'failed', last_run: '2023-05-15T10:30:00' }
        ],
        logs: [
            { type: 'info', message: 'Starting login process for Company A', timestamp: '2023-05-15T10:30:05' },
            { type: 'success', message: 'Successfully logged in to Company A', timestamp: '2023-05-15T10:30:15' },
            { type: 'info', message: 'Starting login process for Company B', timestamp: '2023-05-15T10:30:20' },
            { type: 'success', message: 'Successfully logged in to Company B', timestamp: '2023-05-15T10:30:30' },
            { type: 'info', message: 'Starting login process for Company C', timestamp: '2023-05-15T10:30:35' },
            { type: 'error', message: 'Failed to login to Company C: Invalid credentials', timestamp: '2023-05-15T10:30:45' }
        ]
    },
    {
        id: '2',
        name: 'Tax Compliance Check',
        description: 'Verifies tax compliance status for all registered companies',
        type: 'compliance',
        cron_schedule: 'Daily at 9:00 AM',
        last_run_at: '2023-05-15T09:00:00',
        next_run_at: '2023-05-16T09:00:00',
        status: 'in-progress',
        companies: [
            { id: 'c4', name: 'Company D', status: 'success', last_run: '2023-05-15T09:00:00' },
            { id: 'c5', name: 'Company E', status: 'in-progress', last_run: '2023-05-15T09:00:00' }
        ],
        logs: [
            { type: 'info', message: 'Starting tax compliance check', timestamp: '2023-05-15T09:00:00' },
            { type: 'success', message: 'Company D compliance verified', timestamp: '2023-05-15T09:05:00' },
            { type: 'info', message: 'Processing Company E compliance check', timestamp: '2023-05-15T09:10:00' }
        ]
    },
    {
        id: '3',
        name: 'VAT Data Extraction',
        description: 'Extracts VAT return data from KRA portal',
        type: 'extraction',
        cron_schedule: 'Weekly on Monday',
        last_run_at: '2023-05-08T08:00:00',
        next_run_at: '2023-05-15T08:00:00',
        status: 'failed',
        companies: [
            { id: 'c6', name: 'Company F', status: 'failed', last_run: '2023-05-08T08:00:00' },
            { id: 'c7', name: 'Company G', status: 'failed', last_run: '2023-05-08T08:00:00' }
        ],
        logs: [
            { type: 'error', message: 'Rate limit exceeded for VAT data extraction', timestamp: '2023-05-08T08:15:00' },
            { type: 'warning', message: 'Retry attempt failed', timestamp: '2023-05-08T08:30:00' }
        ]
    },
    {
        id: '4',
        name: 'Document Verification',
        description: 'Verifies submitted tax documents and certificates',
        type: 'verification',
        cron_schedule: 'Every 6 hours',
        last_run_at: '2023-05-15T06:00:00',
        next_run_at: '2023-05-15T12:00:00',
        status: 'pending',
        companies: [
            { id: 'c8', name: 'Company H', status: 'pending', last_run: '2023-05-15T06:00:00' },
            { id: 'c9', name: 'Company I', status: 'pending', last_run: '2023-05-15T06:00:00' }
        ],
        logs: [
            { type: 'info', message: 'Document verification queue updated', timestamp: '2023-05-15T06:00:00' }
        ]
    },
    {
        id: '5',
        name: 'Payment Notification',
        description: 'Sends payment reminders and receipt confirmations',
        type: 'communication',
        cron_schedule: 'Daily at 3:00 PM',
        last_run_at: '2023-05-14T15:00:00',
        next_run_at: '2023-05-15T15:00:00',
        status: 'success',
        companies: [
            { id: 'c10', name: 'Company J', status: 'success', last_run: '2023-05-14T15:00:00' },
            { id: 'c11', name: 'Company K', status: 'success', last_run: '2023-05-14T15:00:00' }
        ],
        logs: [
            { type: 'success', message: 'Payment notifications sent to all companies', timestamp: '2023-05-14T15:05:00' },
            { type: 'info', message: 'Email delivery confirmation received', timestamp: '2023-05-14T15:10:00' }
        ]
    }
];

// Utility function to get icon for automation type
export function getTypeIcon(type: string): string {
    switch (type) {
        case 'authentication': return 'key';
        case 'extraction': return 'download';
        case 'compliance': return 'file-text';
        case 'verification': return 'check-circle';
        case 'communication': return 'message-square';
        default: return 'settings';
    }
}

// Format a date relative to now
export function formatDateRelative(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
}

// Format the next run time
export function formatDateNext(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Tomorrow';
    return `${Math.floor(diff / 86400000)} days`;
}

// Format a date for display
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Get color for automation type
export function getTypeColor(type: string): { bg: string; text: string; border: string } {
    switch (type) {
        case 'authentication':
            return { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-600' };
        case 'extraction':
            return { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-600' };
        case 'compliance':
            return { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-600' };
        case 'verification':
            return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-600' };
        case 'communication':
            return { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-600' };
        default:
            return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-600' };
    }
}

// Get color for status
export function getStatusColor(status: string): { bg: string; text: string } {
    switch (status) {
        case 'success':
            return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
        case 'failed':
            return { bg: 'bg-red-100', text: 'text-red-700' };
        case 'in-progress':
            return { bg: 'bg-blue-100', text: 'text-blue-700' };
        case 'pending':
            return { bg: 'bg-amber-100', text: 'text-amber-700' };
        default:
            return { bg: 'bg-gray-100', text: 'text-gray-700' };
    }
}

// Format automation type label
export function formatType(type: string): string {
    const types: Record<string, string> = {
        authentication: 'Authentication',
        extraction: 'Data Extraction',
        compliance: 'Compliance',
        verification: 'Verification',
        communication: 'Communication'
    };
    return types[type] || type;
}

// Format status label
export function formatStatus(status: string): string {
    const statuses: Record<string, string> = {
        success: 'Success',
        failed: 'Failed',
        'in-progress': 'In Progress',
        pending: 'Pending'
    };
    return statuses[status] || status;
}