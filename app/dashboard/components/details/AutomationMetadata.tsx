// app/dashboard/components/details/AutomationMetadata.tsx

import {
    Card,
    CardContent
} from "@/components/ui/card";
import { Automation } from "../../types";
import { formatDate, formatType } from "../../utils/sampleData";

interface AutomationMetadataProps {
    automation: Automation;
}

export function AutomationMetadata({ automation }: AutomationMetadataProps) {
    return (
        <Card>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="text-sm font-medium">{automation.name}</p>
                </div>

                <div>
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="text-sm font-medium">{automation.description}</p>
                </div>

                <div>
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="text-sm font-medium">{formatType(automation.type)}</p>
                </div>

                <div>
                    <p className="text-xs text-gray-500">Schedule</p>
                    <p className="text-sm font-medium">{automation.cron_schedule}</p>
                </div>

                <div>
                    <p className="text-xs text-gray-500">Last Run</p>
                    <p className="text-sm font-medium">{formatDate(automation.last_run_at)}</p>
                </div>

                <div>
                    <p className="text-xs text-gray-500">Next Run</p>
                    <p className="text-sm font-medium">{formatDate(automation.next_run_at)}</p>
                </div>

                <div>
                    <p className="text-xs text-gray-500">Companies</p>
                    <p className="text-sm font-medium">{automation.companies.length} companies</p>
                </div>

                <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm font-medium">System</p>
                </div>
            </CardContent>
        </Card>
    );
}