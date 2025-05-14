// app/dashboard/utils/utils.ts

import { toast } from "@/components/ui/use-toast";
import { AutomationStatus, Company } from "../types";

/**
 * Shows a notification toast
 */
export function showNotification(
    title: string,
    description?: string,
    variant: 'default' | 'success' | 'destructive' = 'default'
) {
    toast({
        title,
        description,
        variant
    });
}

/**
 * Calculate completion percentage for companies in an automation
 */
export function calculateCompletionPercentage(companies: Company[]): number {
    if (companies.length === 0) return 0;

    const completedCount = companies.filter(
        company => company.status === 'success' || company.status === 'failed'
    ).length;

    return Math.round((completedCount / companies.length) * 100);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string): boolean {
    const date = new Date(dateString);
    const today = new Date();

    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

/**
 * Check if a date is in the future
 */
export function isFuture(dateString: string): boolean {
    const date = new Date(dateString);
    const now = new Date();

    return date.getTime() > now.getTime();
}

/**
 * Get color class for progress bar based on status
 */
export function getProgressColorClass(status: AutomationStatus): string {
    switch (status) {
        case 'success': return 'bg-emerald-500';
        case 'failed': return 'bg-red-500';
        case 'in-progress': return 'bg-blue-500';
        case 'pending': return 'bg-amber-500';
        default: return 'bg-gray-500';
    }
}

/**
 * Format a cron schedule expression into a human-readable string
 */
export function formatCronSchedule(cronExpression: string): string {
    // This is a simplified version - a real implementation would parse the cron expression
    // and convert it to a human-readable format

    const parts = cronExpression.split(' ');

    if (parts.length !== 5) {
        return cronExpression;
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Every minute';
    }

    if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Hourly';
    }

    if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Daily at midnight';
    }

    if (minute === '0' && hour === '8' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Daily at 8:00 AM';
    }

    if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '1') {
        return 'Weekly on Monday at midnight';
    }

    if (minute === '0' && hour === '0' && dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
        return 'Monthly on the 1st at midnight';
    }

    return cronExpression;
}

/**
 * Parse a time string (HH:MM) and return a Date object
 */
export function parseTimeString(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
}

/**
 * Convert a Date to a time string (HH:MM)
 */
export function dateToTimeString(date: Date): string {
    return date.toTimeString().substring(0, 5);
}