// app/dashboard/components/sheets/AutomationDetailsSheet.tsx

import { useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetClose
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Automation } from "../../types";
import { formatDate, getTypeColor, getStatusColor, formatStatus } from "../../utils/sampleData";
import { CompanyList } from "../details/CompanyList";
import { LogsList } from "../details/LogsList";
import { AutomationMetadata } from "../details/AutomationMetadata";
import { ExecutionStatus } from "../details/ExecutionStatus";
import { useAutomations } from "../../hooks/useAutomations";
import { DownloadIcon, PlayIcon, CheckIcon, XIcon } from "lucide-react";

interface AutomationDetailsSheetProps {
    automation: Automation;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AutomationDetailsSheet({
    automation,
    open,
    onOpenChange
}: AutomationDetailsSheetProps) {
    const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState("details");
    const { runCompanies } = useAutomations();

    const typeColors = getTypeColor(automation.type);
    const statusColors = getStatusColor(automation.status);

    const handleCompanySelectionChange = (companyId: string, isSelected: boolean) => {
        setSelectedCompanies(prev => {
            const newSet = new Set(prev);
            if (isSelected) {
                newSet.add(companyId);
            } else {
                newSet.delete(companyId);
            }
            return newSet;
        });
    };

    const handleSelectAllCompanies = () => {
        const allCompanyIds = automation.companies.map(company => company.id);
        setSelectedCompanies(new Set(allCompanyIds));
    };

    const handleDeselectAllCompanies = () => {
        setSelectedCompanies(new Set());
    };

    const handleRunSelected = () => {
        if (selectedCompanies.size === 0) return;

        runCompanies(
            automation.id,
            Array.from(selectedCompanies)
        );

        setActiveTab("execution");
    };

    const handleRunAll = () => {
        const allCompanyIds = automation.companies.map(company => company.id);
        setSelectedCompanies(new Set(allCompanyIds));

        runCompanies(
            automation.id,
            allCompanyIds
        );

        setActiveTab("execution");
    };

    const handleDownloadLogs = () => {
        // In a real app, this would download the logs
        const logData = automation.logs
            .map(log => `[${formatDate(log.timestamp)}] ${log.type.toUpperCase()}: ${log.message}`)
            .join('\n');

        const blob = new Blob([logData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${automation.name.replace(/\s+/g, '_')}_logs.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-2">
                        <Badge className={`${typeColors.bg} ${typeColors.text} border-0`}>
                            {automation.type}
                        </Badge>
                        {automation.name}
                    </SheetTitle>
                    <div className="flex items-center text-sm text-gray-500">
                        <Badge
                            variant="outline"
                            className={`${statusColors.bg} ${statusColors.text} border-0 mr-2`}
                        >
                            {formatStatus(automation.status)}
                        </Badge>
                        <span>Last run: {formatDate(automation.last_run_at)}</span>
                    </div>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="companies">Companies</TabsTrigger>
                        <TabsTrigger value="execution">Execution</TabsTrigger>
                        <TabsTrigger value="logs">Logs</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <AutomationMetadata automation={automation} />
                    </TabsContent>

                    <TabsContent value="companies">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-medium">Companies</h3>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSelectAllCompanies}
                                >
                                    <CheckIcon className="h-3 w-3 mr-1" />
                                    Select All
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDeselectAllCompanies}
                                >
                                    <XIcon className="h-3 w-3 mr-1" />
                                    Deselect All
                                </Button>
                            </div>
                        </div>

                        <CompanyList
                            companies={automation.companies}
                            selectedCompanies={selectedCompanies}
                            onSelectionChange={handleCompanySelectionChange}
                        />

                        <div className="mt-4 flex gap-2">
                            <Button
                                onClick={handleRunSelected}
                                disabled={selectedCompanies.size === 0}
                            >
                                <PlayIcon className="h-4 w-4 mr-2" />
                                Run Selected ({selectedCompanies.size})
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleRunAll}
                            >
                                <PlayIcon className="h-4 w-4 mr-2" />
                                Run All ({automation.companies.length})
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="execution">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-medium">Execution Status</h3>
                            <span className="text-xs text-gray-500">
                                {selectedCompanies.size} companies selected
                            </span>
                        </div>

                        <ExecutionStatus
                            automation={automation}
                            selectedCompanies={selectedCompanies}
                        />
                    </TabsContent>

                    <TabsContent value="logs">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-medium">Recent Logs</h3>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadLogs}
                            >
                                <DownloadIcon className="h-3 w-3 mr-1" />
                                Download
                            </Button>
                        </div>

                        <LogsList logs={automation.logs} />
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}