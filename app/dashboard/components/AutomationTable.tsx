// app/dashboard/components/AutomationTable.tsx

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayIcon, Loader2Icon, CheckIcon, XIcon, DownloadIcon, KeyIcon, FileTextIcon, CheckCircleIcon, MessageSquareIcon, SettingsIcon } from "lucide-react";
import { Automation } from "../types";
import {
  formatDateRelative,
  formatDateNext,
  getTypeIcon,
  getTypeColor,
  getStatusColor,
  formatType,
  formatStatus
} from "../utils/sampleData";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationMetadata } from "./details/AutomationMetadata";
import { CompanyList } from "./details/CompanyList";
import { LogsList } from "./details/LogsList";
import { ExecutionStatus } from "./details/ExecutionStatus";
import { useAutomations } from "../hooks/useAutomations";

interface AutomationTableProps {
  automations: Automation[];
}

export function AutomationTable({ automations }: AutomationTableProps) {
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("details");
  const { runAutomation, runCompanies } = useAutomations();

  const handleRowClick = (automation: Automation) => {
    setSelectedAutomation(automation);
    setIsSheetOpen(true);
  };

  const handleRunAutomation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    runAutomation(id);
  };

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
    if (selectedAutomation) {
      const allCompanyIds = selectedAutomation.companies.map(company => company.id);
      setSelectedCompanies(new Set(allCompanyIds));
    }
  };

  const handleDeselectAllCompanies = () => {
    setSelectedCompanies(new Set());
  };

  const handleRunSelected = () => {
    if (selectedCompanies.size === 0 || !selectedAutomation) return;

    runCompanies(
      selectedAutomation.id,
      Array.from(selectedCompanies)
    );

    setActiveTab("execution");
  };

  const handleRunAll = () => {
    if (!selectedAutomation) return;
    
    const allCompanyIds = selectedAutomation.companies.map(company => company.id);
    setSelectedCompanies(new Set(allCompanyIds));

    runCompanies(
      selectedAutomation.id,
      allCompanyIds
    );

    setActiveTab("execution");
  };

  const handleDownloadLogs = () => {
    if (!selectedAutomation) return;
    
    // In a real app, this would download the logs
    const logData = selectedAutomation.logs
      .map(log => `[${new Date(log.timestamp).toLocaleString()}] ${log.type.toUpperCase()}: ${log.message}`)
      .join('\n');

    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedAutomation.name.replace(/\s+/g, '_')}_logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (automations.length === 0) {
    return (
      <div className="text-center py-8 border rounded-lg bg-gray-50">
        <p className="text-gray-500">No automations found</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Automation</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.map((automation) => {
              const typeColors = getTypeColor(automation.type);
              const statusColors = getStatusColor(automation.status);
              const isRunning = automation.status === 'in-progress';
              let TypeIcon;
              switch(getTypeIcon(automation.type)) {
                case 'key': TypeIcon = KeyIcon; break;
                case 'download': TypeIcon = DownloadIcon; break;
                case 'file-text': TypeIcon = FileTextIcon; break;
                case 'check-circle': TypeIcon = CheckCircleIcon; break;
                case 'message-square': TypeIcon = MessageSquareIcon; break;
                default: TypeIcon = SettingsIcon;
              }

              return (
                <TableRow
                  key={automation.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(automation)}
                >
                  <TableCell>
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full ${typeColors.bg} ${typeColors.text}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div className="ml-3">
                        <div className="font-medium">{automation.name}</div>
                        <div className="text-xs text-gray-500">{formatType(automation.type)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDateRelative(automation.last_run_at)}</div>
                    <div className="text-xs text-gray-500">by System</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{automation.cron_schedule}</div>
                    <div className="text-xs text-gray-500">
                      Next: {formatDateNext(automation.next_run_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${statusColors.bg} ${statusColors.text} border-0`}
                    >
                      {formatStatus(automation.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isRunning}
                      onClick={(e) => handleRunAutomation(e, automation.id)}
                    >
                      {isRunning ? (
                        <>
                          <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
                          Running
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-4 w-4 mr-1" />
                          Run
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedAutomation && (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle className="flex items-center gap-2">
                <Badge className={`${getTypeColor(selectedAutomation.type).bg} ${getTypeColor(selectedAutomation.type).text} border-0`}>
                  {selectedAutomation.type}
                </Badge>
                {selectedAutomation.name}
              </SheetTitle>
              <div className="flex items-center text-sm text-gray-500">
                <Badge
                  variant="outline"
                  className={`${getStatusColor(selectedAutomation.status).bg} ${getStatusColor(selectedAutomation.status).text} border-0`}
                >
                  {formatStatus(selectedAutomation.status)}
                </Badge>
              </div>
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="companies">Companies</TabsTrigger>
                <TabsTrigger value="execution">Execution</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <AutomationMetadata automation={selectedAutomation} />
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
                  companies={selectedAutomation.companies}
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
                    Run All ({selectedAutomation.companies.length})
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
                  automation={selectedAutomation}
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

                <LogsList logs={selectedAutomation.logs} />
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}