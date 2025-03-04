// @ts-nocheck
import { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from '@/hooks/use-toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, CheckCircle, AlertCircle, FileDown, Database, CloudUpload } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

// Define the API URL with a fallback to localhost if environment variable is not set
const API_BASE_URL = process.env.NEXT_PUBLIC_EXTRACTION_API_URL || 'http://localhost:3005';

interface ExtractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payrollRecords: any[]
  monthNames: string[]
  selectedMonth: number
  selectedYear: number
}

type ExtractionState = 'idle' | 'starting' | 'extracting' | 'completed' | 'failed';

export function ExtractDialog({
  open,
  onOpenChange,
  payrollRecords,
  monthNames,
  selectedMonth,
  selectedYear
}: ExtractDialogProps) {
  const [finalizedCompanies, setFinalizedCompanies] = useState<any[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [extractionState, setExtractionState] = useState<ExtractionState>('idle')
  const [selectAll, setSelectAll] = useState(false)
  const [extractionStatus, setExtractionStatus] = useState<Record<string, any>>({})
  const [completedCount, setCompletedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      console.log('API Base URL:', API_BASE_URL);

      // Filter companies that have a finalization_date in their status
      const companies = payrollRecords.filter(record => {
        const hasFinalizationDate = record.status &&
          record.status.finalization_date !== null &&
          record.status.finalization_date !== undefined;

        return hasFinalizationDate;
      }).map(record => ({
        id: record.id,
        company_id: record.company_id,
        name: record.company?.company_name || 'Unknown Company',
        status: record.status || {},
        finalization_date: record.status?.finalization_date,
        finalization_date_formatted: record.status?.finalization_date ?
          new Date(record.status.finalization_date).toLocaleDateString() : 'NIL',
        extracted: record.status?.extracted ? 'Yes' : 'No',
        wingu_extraction: record.status?.wingu_extraction ? 'Yes' : 'No'
      }));

      console.log('Filtered finalized companies:', companies);

      setFinalizedCompanies(companies);
      setSelectedCompanies([]);
      setSelectAll(false);
      setExtractionStatus({});
      setExtractionState('idle');
      setCompletedCount(0);
      setTotalCount(0);
    }
  }, [open, payrollRecords]);

  // Other functions remain the same...
  // (handleSelectAll, handleSelectCompany, handleExtract, etc.)

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedCompanies(finalizedCompanies.map(company => company.id))
    } else {
      setSelectedCompanies([])
    }
  }, [finalizedCompanies]);

  const handleSelectCompany = useCallback((checked: boolean, companyId: string) => {
    if (checked) {
      setSelectedCompanies(prev => [...prev, companyId])
    } else {
      setSelectedCompanies(prev => prev.filter(id => id !== companyId))
      setSelectAll(false)
    }
  }, []);

  // Start extraction process
  const handleExtract = async () => {
    if (selectedCompanies.length === 0) {
      toast({
        title: "No companies selected",
        description: "Please select at least one company to extract.",
        variant: "destructive"
      })
      return
    }

    try {
      setExtractionState('starting')

      // Get the selected companies with full details
      const companiesToExtract = finalizedCompanies.filter(company =>
        selectedCompanies.includes(company.id)
      )

      const apiUrl = `${API_BASE_URL}/api/extract`;
      console.log('Sending extraction request to:', apiUrl);

      // First check if the server is running
      try {
        const healthCheck = await fetch(`${API_BASE_URL}/health`);
        if (!healthCheck.ok) {
          throw new Error(`Server health check failed: ${healthCheck.status}`);
        }
        console.log('Server is running:', await healthCheck.json());
      } catch (healthError) {
        console.error('Server health check error:', healthError);
        throw new Error(`Extraction server is not running. Please start the server at ${API_BASE_URL} first.`);
      }

      // Trigger the extraction process
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companies: companiesToExtract,
          monthYear: `${monthNames[selectedMonth]} ${selectedYear}`,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          credentials: {
            username: 'tushar',
            password: '0700298298'
          }
        })
      })

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to start extraction process: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Extraction started:', result);

      // Initialize extraction status for each company
      const initialStatus = {};
      companiesToExtract.forEach(company => {
        initialStatus[company.id] = { status: 'processing', progress: 0 };
      });

      setExtractionStatus(initialStatus);
      setExtractionState('extracting');
      setTotalCount(companiesToExtract.length);
      setCompletedCount(0);

      toast({
        title: "Extraction Started",
        description: `Started extracting data for ${selectedCompanies.length} companies.`,
        variant: "default"
      })
    } catch (error) {
      console.error('Extraction error:', error)
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to start the extraction process. Please try again.",
        variant: "destructive"
      })
      setExtractionState('failed')
    }
  }

  // Handle dialog close
  const handleCloseDialog = () => {
    if (extractionState === 'extracting') {
      toast({
        title: "Extraction in Progress",
        description: "Please wait for the extraction to complete before closing.",
        variant: "destructive"
      })
      return
    }

    // Reset state and close dialog
    setExtractionState('idle')
    onOpenChange(false)
  }

  // Generate button text based on current state
  const getButtonText = () => {
    switch (extractionState) {
      case 'starting':
        return 'Starting Extraction...';
      case 'extracting':
        return `Extracting... (${completedCount}/${totalCount})`;
      case 'completed':
        return 'Extraction Complete';
      case 'failed':
        return 'Retry Extraction';
      default:
        return 'Extract Documents';
    }
  }

  // Determine if the extract button should be disabled
  const isExtractButtonDisabled =
    selectedCompanies.length === 0 ||
    extractionState === 'starting' ||
    extractionState === 'extracting';

  return (
    <Dialog
      open={open}
      onOpenChange={handleCloseDialog}
    >
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] flex flex-col p-0 bg-white overflow-hidden">
        {/* Header with light blue background - Exact match from the image */}
        <div className="bg-[#ebf3ff] px-6 py-8 flex flex-col items-center">
          <div className="w-10 h-10 bg-[#3b82f6] rounded-full flex items-center justify-center mb-3">
            <CloudUpload className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-[#1e3a8a] text-xl font-medium mb-1">Extract Statutory Documents</h2>
          <p className="text-[#1e40af] text-sm text-center max-w-[450px]">
            {monthNames[selectedMonth]} {selectedYear}
          </p>
        </div>

        {/* Main content with white background */}
        <div className="px-6 py-4 flex-1 flex flex-col overflow-hidden">
          {/* Company Information section */}
          <div className="mb-4 border border-[#e5e7eb] rounded-md overflow-hidden">
            <div className="px-4 py-3 bg-white">
              <h3 className="text-[#3b82f6] text-sm font-medium">Company Information</h3>
            </div>

            <div className="border-t border-[#e5e7eb] px-4 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-[#64748b] text-sm mb-1">Companies Selected</p>
                <p className="font-medium">{selectedCompanies.length} of {finalizedCompanies.length}</p>
              </div>
              <div>
                <p className="text-[#64748b] text-sm mb-1">Statement Period</p>
                <div className="flex items-center">
                  <span className="text-[#3b82f6] mr-2">📅</span>
                  <span>{monthNames[selectedMonth]} {selectedYear}</span>
                </div>
              </div>
              <div>
                <p className="text-[#64748b] text-sm mb-1">Status</p>
                <div className="flex items-center">
                  {extractionState === 'idle' && <span>Ready to Extract</span>}
                  {extractionState === 'starting' && <span>Starting Extraction...</span>}
                  {extractionState === 'extracting' && <span>Extracting ({completedCount}/{totalCount})</span>}
                  {extractionState === 'completed' && <span className="text-[#16a34a]">Extraction Complete</span>}
                  {extractionState === 'failed' && <span className="text-[#dc2626]">Extraction Failed</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Progress indicator for overall extraction */}
          {extractionState === 'extracting' && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Overall Progress</span>
                <span className="text-[#3b82f6]">{completedCount}/{totalCount} companies</span>
              </div>
              <Progress
                value={(completedCount / totalCount) * 100}
                className="h-2 bg-[#e5e7eb]"
                indicatorClassName="bg-[#3b82f6]"
              />
            </div>
          )}

          {/* Company list with scrollable container */}
          <div className="flex-1 overflow-hidden flex flex-col border border-[#e5e7eb] rounded-md">
            {finalizedCompanies.length === 0 ? (
              <div className="py-8 text-center text-gray-500 flex-1 flex items-center justify-center">
                <div>
                  <Database className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p>No finalized companies found for this period.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow className="border-b border-[#e5e7eb]">
                      <TableHead className="w-12 pl-4">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                          disabled={extractionState === 'extracting' || extractionState === 'starting'}
                          id="select-all"
                          className="border-[#3b82f6] data-[state=checked]:bg-[#3b82f6] data-[state=checked]:text-white"
                        />
                      </TableHead>
                      <TableHead className="font-medium">Company</TableHead>
                      <TableHead className="font-medium">Finalized On</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalizedCompanies.map((company) => {
                      const status = extractionStatus[company.id];

                      return (
                        <TableRow key={company.id} className="hover:bg-[#f8fafc] border-b border-[#e5e7eb]">
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={selectedCompanies.includes(company.id)}
                              onCheckedChange={(checked) => handleSelectCompany(checked, company.id)}
                              disabled={extractionState === 'extracting' || extractionState === 'starting'}
                              id={`select-${company.id}`}
                              className="border-[#3b82f6] data-[state=checked]:bg-[#3b82f6] data-[state=checked]:text-white"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{company.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {company.extracted === 'Yes' && (
                                <Badge variant="outline" className="mr-1 text-xs bg-[#f0f9ff] text-[#0369a1] border-[#0ea5e9]">
                                  Previously Extracted
                                </Badge>
                              )}
                              {company.wingu_extraction === 'Yes' && (
                                <Badge variant="outline" className="text-xs bg-[#f0fdf4] text-[#166534] border-[#22c55e]">
                                  Wingu Extraction
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{company.finalization_date_formatted}</TableCell>
                          <TableCell>
                            {status ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {status.status === 'completed' ? (
                                    <CheckCircle className="h-4 w-4 text-[#16a34a]" />
                                  ) : status.status === 'failed' ? (
                                    <AlertCircle className="h-4 w-4 text-[#dc2626]" />
                                  ) : (
                                    <Loader2 className="h-4 w-4 animate-spin text-[#3b82f6]" />
                                  )}
                                  <span className={`font-medium ${status.status === 'completed' ? 'text-[#16a34a]' :
                                      status.status === 'failed' ? 'text-[#dc2626]' :
                                        'text-[#3b82f6]'
                                    }`}>
                                    {status.status === 'completed'
                                      ? 'Completed'
                                      : status.status === 'failed'
                                        ? 'Failed'
                                        : status.status === 'processing'
                                          ? 'Processing'
                                          : 'Queued'}
                                  </span>
                                </div>
                                {status.status === 'processing' && status.message && (
                                  <span className="text-xs text-gray-600">{status.message}</span>
                                )}
                                {status.status === 'processing' && (
                                  <Progress
                                    value={status.progress || 0}
                                    className="h-1.5 mt-1 bg-[#e5e7eb]"
                                    indicatorClassName="bg-[#3b82f6]"
                                  />
                                )}
                                {status.status === 'failed' && status.error && (
                                  <span className="text-xs text-[#dc2626] mt-1">{status.error}</span>
                                )}
                                {status.status === 'completed' && status.completedAt && (
                                  <span className="text-xs text-gray-500 mt-1">
                                    Completed at {new Date(status.completedAt).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            ) : company.status?.extraction_failed ? (
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-[#dc2626]" />
                                <span className="text-[#dc2626] font-medium">Previous Extraction Failed</span>
                              </div>
                            ) : company.status?.wingu_extraction ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-[#16a34a]" />
                                <span className="text-[#16a34a] font-medium">Previously Extracted</span>
                              </div>
                            ) : (
                              <span className="text-gray-500">Not started</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="px-6 py-4 border-t border-[#e5e7eb] flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {selectedCompanies.length > 0 &&
              `${selectedCompanies.length} companies selected`
            }
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={extractionState === 'extracting' || extractionState === 'starting'}
              className="bg-white border-[#e5e7eb] hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExtract}
              disabled={isExtractButtonDisabled}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white flex items-center"
            >
              {(extractionState === 'starting' || extractionState === 'extracting') && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {extractionState === 'completed' && (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {getButtonText()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}