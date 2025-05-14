// app/dashboard/components/details/ExecutionStatus.tsx

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Automation } from "../../types";
import { getStatusColor, formatStatus } from "../../utils/sampleData";
import { Loader2Icon } from "lucide-react";

interface ExecutionStatusProps {
    automation: Automation;
    selectedCompanies: Set<string>;
}

export function ExecutionStatus({
    automation,
    selectedCompanies
}: ExecutionStatusProps) {
    if (selectedCompanies.size === 0) {
        return (
            <div className="text-center py-8 border rounded-lg bg-gray-50">
                <p className="text-gray-500">No companies selected for execution</p>
            </div>
        );
    }

    // Get selected companies with their execution status
    const selectedCompanyList = automation.companies.filter(
        company => selectedCompanies.has(company.id)
    );

    return (
        <ScrollArea className="h-60 border rounded-lg">
            <div className="p-4 space-y-2">
                {selectedCompanyList.map((company) => {
                    const statusColors = getStatusColor(company.status);
                    const isRunning = company.status === 'in-progress';

                    return (
                        <div
                            key={company.id}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                            <span className="text-sm">{company.name}</span>
                            <Badge
                                variant="outline"
                                className={`flex items-center gap-1 ${statusColors.bg} ${statusColors.text} border-0`}
                            >
                                {isRunning && <Loader2Icon className="h-3 w-3 animate-spin" />}
                                {formatStatus(company.status)}
                            </Badge>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}