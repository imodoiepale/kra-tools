// app/dashboard/types.ts

export type AutomationType = 'authentication' | 'extraction' | 'compliance' | 'verification' | 'communication';

export type AutomationStatus = 'success' | 'failed' | 'in-progress' | 'pending';

export type CompanyStatus = AutomationStatus;

export interface Company {
    id: string;
    name: string;
    status: CompanyStatus;
    last_run: string;
}

export interface LogEntry {
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
    timestamp: string;
}

export interface Automation {
    id: string;
    name: string;
    description: string;
    type: AutomationType;
    cron_schedule: string;
    last_run_at: string;
    next_run_at: string;
    status: AutomationStatus;
    companies: Company[];
    logs: LogEntry[];
}

export interface AutomationStats {
    total: number;
    success: number;
    failed: number;
    inProgress: number;
    pending: number;
    byType: Record<AutomationType, number>;
}

export type AutomationFilters = {
    type?: AutomationType;
    status?: AutomationStatus;
    search?: string;
};