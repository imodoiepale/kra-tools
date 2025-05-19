// app/dashboard/components/DashboardHeader.tsx

import { Button } from "@/components/ui/button";
import { PlusIcon, RefreshCcwIcon } from "lucide-react";
import { AutomationDialog } from "./dialogs/AutomationDialog";
import { useState } from "react";

interface DashboardHeaderProps {
    refreshData: () => void;
    isRefreshing: boolean;
}

export function DashboardHeader({ refreshData, isRefreshing }: DashboardHeaderProps) {
    const [showNewAutomationDialog, setShowNewAutomationDialog] = useState(false);

    return (
        <header className="bg-white border-b sticky top-0 z-10">
            <div className="container p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">Automation Dashboard</h1>
                    {/* <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Admin
                    </span> */}
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshData}
                        disabled={isRefreshing}
                    >
                        <RefreshCcwIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                    {/* <Button
                        size="sm"
                        onClick={() => setShowNewAutomationDialog(true)}
                    >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        New Automation
                    </Button> */}
                </div>
            </div>

            {/* <AutomationDialog
                open={showNewAutomationDialog}
                onOpenChange={setShowNewAutomationDialog}
            /> */}
        </header>
    );
}