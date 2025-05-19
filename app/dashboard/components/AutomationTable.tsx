// app/dashboard/components/AutomationTable.tsx

import { useState } from "react";
import { motion } from "framer-motion";
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
import {
  Play as PlayIcon,
  Loader2 as Loader2Icon,
  Check as CheckIcon,
  X as XIcon,
  Download as DownloadIcon,
  Key as KeyIcon,
  FileText as FileTextIcon,
  CheckCircle as CheckCircleIcon,
  MessageSquare as MessageSquareIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Building2 as Building2Icon,
  Activity as ActivityIcon,
  ChevronRight as ChevronRightIcon,
  ArrowRight as ArrowRightIcon
} from "lucide-react";
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

// Enhanced Sheet component with futuristic styling
interface EnhancedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const EnhancedSheet: React.FC<EnhancedSheetProps> = ({ open, onOpenChange, children }) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto bg-gradient-to-br from-white to-gray-50 border-l border-blue-100 text-gray-800 p-0 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/20 to-indigo-100/30 pointer-events-none" />
        <div className="h-full flex flex-col p-6 overflow-hidden relative z-10">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Badge component with futuristic styling (light theme)
const NeuralBadge = ({ children, variant, className = "" }) => {
  const getBadgeStyles = (variant) => {
    switch (variant) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'failed':
        return 'bg-rose-100 text-rose-700 border-rose-300';
      case 'paused':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'data':
        return 'bg-violet-100 text-violet-700 border-violet-300';
      case 'integration':
        return 'bg-cyan-100 text-cyan-700 border-cyan-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyles(variant)} ${className}`}>
      {children}
    </span>
  );
};

// Animated Section component (light theme)
const AnimatedSection = ({ icon: Icon, title, children, expanded = true, onToggle }) => {
  return (
    <div className="mb-6 rounded-xl bg-white border border-blue-100 shadow-sm overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-50/50 transition-colors" 
        onClick={onToggle}
      >
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-blue-100">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRightIcon className="h-4 w-4 text-blue-400" />
        </motion.div>
      </div>
      
      <motion.div
        initial={false}
        animate={{ 
          height: expanded ? 'auto' : 0,
          opacity: expanded ? 1 : 0
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="p-3 pt-0">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// Progress indicator component (light theme)
const ProgressRing = ({ value, size = 40, strokeWidth = 3 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  return (
    <svg height={size} width={size} className="transform -rotate-90">
      <circle
        className="text-gray-200"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        className="text-blue-500"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  );
};

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
                      <div className={`flex-shrink-0 h-4 w-4 flex items-center justify-center rounded-full ${typeColors.bg} ${typeColors.text}`}>
                        <TypeIcon className="h-2 w-2" />
                      </div>
                      <div className="ml-3">
                        <div className="font-medium">{automation.name}</div>
                        {/* <div className="text-xs text-gray-500">{formatType(automation.type)}</div> */}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDateRelative(automation.last_run_at)}</div>
                    {/* <div className="text-xs text-gray-500">by System</div> */}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{automation.cron_schedule}</div>
                    {/* <div className="text-xs text-gray-500">
                      Next: {formatDateNext(automation.next_run_at)}
                    </div> */}
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
        <EnhancedSheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          {/* Header section */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <NeuralBadge variant={selectedAutomation.type.toLowerCase()}>
                  {formatType(selectedAutomation.type)}
                </NeuralBadge>
                <h2 className="text-xl font-semibold text-gray-800">{selectedAutomation.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <NeuralBadge variant={selectedAutomation.status.toLowerCase()}>
                  {formatStatus(selectedAutomation.status)}
                </NeuralBadge>
                <span className="text-xs text-gray-500">Last run: {formatDateRelative(selectedAutomation.lastRun)}</span>
              </div>
            </div>
            
            {/* <ProgressRing value={75} /> */}
          </div>
          
          {/* Main content - unified view with expandable sections */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {/* Details section */}
            <AnimatedSection 
              icon={InfoIcon} 
              title="Automation Details" 
              expanded={activeTab === "details"}
              onToggle={() => setActiveTab(activeTab === "details" ? "" : "details")}
            >
              <AutomationMetadata automation={selectedAutomation} />
            </AnimatedSection>
            
            {/* Companies section */}
            <AnimatedSection 
              icon={Building2Icon} 
              title="Target Companies" 
              expanded={activeTab === "companies"}
              onToggle={() => setActiveTab(activeTab === "companies" ? "" : "companies")}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-gray-500">
                  {selectedCompanies.size} of {selectedAutomation.companies.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    className="text-xs text-blue-600 flex items-center hover:text-blue-700 transition-colors"
                    onClick={handleSelectAllCompanies}
                  >
                    <CheckIcon className="h-3 w-3 mr-1" />
                    All
                  </button>
                  <button 
                    className="text-xs text-gray-500 flex items-center hover:text-gray-700 transition-colors"
                    onClick={handleDeselectAllCompanies}
                  >
                    <XIcon className="h-3 w-3 mr-1" />
                    None
                  </button>
                </div>
              </div>
              
              <div className="space-y-1 max-h-40 overflow-y-auto">
                <CompanyList
                  companies={selectedAutomation.companies}
                  selectedCompanies={selectedCompanies}
                  onSelectionChange={handleCompanySelectionChange}
                />
              </div>
              
              <div className="mt-4 flex gap-2">
                <button 
                  className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium ${
                    selectedCompanies.size > 0 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={selectedCompanies.size === 0}
                  onClick={handleRunSelected}
                >
                  <PlayIcon className="h-3 w-3 mr-2" />
                  Run Selected ({selectedCompanies.size})
                </button>
                <button 
                  className="px-3 py-1.5 rounded-lg bg-white text-blue-600 border border-blue-300 flex items-center text-sm font-medium hover:bg-blue-50 transition-colors"
                  onClick={handleRunAll}
                >
                  <PlayIcon className="h-3 w-3 mr-2" />
                  Run All ({selectedAutomation.companies.length})
                </button>
              </div>
            </AnimatedSection>
            
            {/* Execution section */}
            <AnimatedSection 
              icon={ActivityIcon} 
              title="Execution Status" 
              expanded={activeTab === "execution"}
              onToggle={() => setActiveTab(activeTab === "execution" ? "" : "execution")}
            >
              <ExecutionStatus
                automation={selectedAutomation}
                selectedCompanies={selectedCompanies}
              />
            </AnimatedSection>
            
            {/* Logs section */}
            <AnimatedSection 
              icon={FileTextIcon} 
              title="System Logs" 
              expanded={activeTab === "logs"}
              onToggle={() => setActiveTab(activeTab === "logs" ? "" : "logs")}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-gray-500">Recent activity</span>
                <button 
                  className="text-xs text-blue-600 flex items-center hover:text-blue-700 transition-colors"
                  onClick={handleDownloadLogs}
                >
                  <DownloadIcon className="h-3 w-3 mr-1" />
                  Export
                </button>
              </div>
              
              <div className="space-y-1 max-h-40 overflow-y-auto">
                <LogsList logs={selectedAutomation.logs} />
              </div>
            </AnimatedSection>
          </div>
          
          {/* Footer with action buttons */}
          <div className="pt-4 border-t border-gray-200 mt-auto flex justify-between">
            <button 
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setIsSheetOpen(false)}
            >
              Close
            </button>
            <button className="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors">
              View full details
              <ArrowRightIcon className="h-3 w-3 ml-1" />
            </button>
          </div>
        </EnhancedSheet>
      )}
    </>
  );
}