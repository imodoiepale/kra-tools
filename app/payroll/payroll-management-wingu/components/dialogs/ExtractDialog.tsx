import { useState, useEffect } from 'react'
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
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

// Define the API URL with a fallback to localhost if environment variable is not set
const API_BASE_URL = 'http://localhost:3005';

interface ExtractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payrollRecords: any[]
  monthNames: string[]
  selectedMonth: number
  selectedYear: number
}

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
  const [isLoading, setIsLoading] = useState(false)
  const [selectAll, setSelectAll] = useState(false)
  const [extractionStatus, setExtractionStatus] = useState<Record<string, any>>({})
  const [isExtracting, setIsExtracting] = useState(false)

  useEffect(() => {
    if (open) {
      // Log environment variables for debugging
      console.log('API Base URL:', API_BASE_URL);
      
      // Filter companies that have a finalization_date in their status
      // Include all companies with finalization dates, even if they've been extracted before
      const companies = payrollRecords.filter(record => {
        // Check for finalization_date in the status field
        const hasFinalizationDate = record.status && 
          record.status.finalization_date !== null && 
          record.status.finalization_date !== undefined;
        
        // We're no longer filtering out extracted companies
        return hasFinalizationDate;
      }).map(record => ({
        id: record.id,
        company_id: record.company_id,
        name: record.company?.company_name || 'Unknown Company',
        status: record.status || {},
        finalization_date: record.status?.finalization_date,
        finalization_date_formatted: record.status?.finalization_date ? 
          new Date(record.status.finalization_date).toLocaleDateString() : 'NIL',
        // Add extraction status for display
        extracted: record.status?.extracted ? 'Yes' : 'No',
        wingu_extraction: record.status?.wingu_extraction ? 'Yes' : 'No'
      }));
      
      console.log('Filtered finalized companies:', companies);
      
      setFinalizedCompanies(companies);
      setSelectedCompanies([]);
      setSelectAll(false);
      setExtractionStatus({});
      setIsExtracting(false);
    }
  }, [open, payrollRecords]);

  // Poll extraction status
  useEffect(() => {
    if (!isExtracting || Object.keys(extractionStatus).length === 0) return;

    const intervalId = setInterval(async () => {
      try {
        // Check status for each company in extraction
        const statusPromises = Object.keys(extractionStatus).map(async (companyId) => {
          const statusUrl = `${API_BASE_URL}/api/status/${companyId}`;
          console.log('Checking status at:', statusUrl);
          
          const response = await fetch(statusUrl);
          if (response.ok) {
            const status = await response.json();
            return { companyId, status };
          }
          return null;
        });

        const statuses = await Promise.all(statusPromises);
        const newStatus = { ...extractionStatus };
        let allCompleted = true;

        statuses.forEach(item => {
          if (item) {
            newStatus[item.companyId] = item.status;
            if (item.status.status !== 'completed' && item.status.status !== 'failed') {
              allCompleted = false;
            }
          }
        });

        setExtractionStatus(newStatus);

        // If all extractions are complete, stop polling
        if (allCompleted) {
          setIsExtracting(false);
          toast({
            title: "Extraction Complete",
            description: "All document extractions have completed.",
            variant: "default"
          });
        }
      } catch (error) {
        console.error('Error polling extraction status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [isExtracting, extractionStatus]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedCompanies(finalizedCompanies.map(company => company.id))
    } else {
      setSelectedCompanies([])
    }
  }

  const handleSelectCompany = (checked: boolean, companyId: string) => {
    if (checked) {
      setSelectedCompanies(prev => [...prev, companyId])
    } else {
      setSelectedCompanies(prev => prev.filter(id => id !== companyId))
      setSelectAll(false)
    }
  }

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
      setIsLoading(true)
      
      // Get the selected companies with full details
      const companiesToExtract = finalizedCompanies.filter(company => 
        selectedCompanies.includes(company.id)
      )

      const apiUrl = `${API_BASE_URL}/api/extract`;
      console.log('Sending extraction request to:', apiUrl);

      // First check if the server is running
      try {
        const healthCheck = await fetch(API_BASE_URL);
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
      setIsExtracting(true);

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
      setIsLoading(false)
      setIsExtracting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Prevent closing the dialog if extraction is in progress
      if (isExtracting && newOpen === false) {
        toast({
          title: "Extraction in Progress",
          description: "Please wait for the extraction to complete before closing.",
          variant: "destructive"
        })
        return
      }
      onOpenChange(newOpen)
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Extract Documents</DialogTitle>
          <DialogDescription>
            Select companies to extract documents for {monthNames[selectedMonth]} {selectedYear}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[400px] overflow-y-auto">
          {finalizedCompanies.length === 0 ? (
            <div className="py-6 text-center text-gray-500">
              No finalized companies found for this period.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectAll} 
                      onCheckedChange={handleSelectAll}
                      disabled={isExtracting}
                    />
                  </TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Finalization Date</TableHead>
                  <TableHead>Extracted</TableHead>
                  <TableHead>Wingu Extraction</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalizedCompanies.map((company) => {
                  const status = extractionStatus[company.id]
                  
                  return (
                    <TableRow key={company.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedCompanies.includes(company.id)}
                          onCheckedChange={(checked) => handleSelectCompany(checked, company.id)}
                          disabled={isExtracting}
                        />
                      </TableCell>
                      <TableCell>{company.name}</TableCell>
                      <TableCell>{company.finalization_date_formatted}</TableCell>
                      <TableCell>{company.extracted}</TableCell>
                      <TableCell>{company.wingu_extraction}</TableCell>
                      <TableCell>
                        {status ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {status.status === 'completed' ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : status.status === 'failed' ? (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              <span>
                                {status.status === 'completed'
                                  ? 'Completed'
                                  : status.status === 'failed'
                                  ? 'Failed'
                                  : status.status === 'processing'
                                  ? 'Processing'
                                  : 'Queued'}
                              </span>
                            </div>
                            {status.status === 'processing' && (
                              <Progress value={status.progress || 0} className="h-2" />
                            )}
                            {status.status === 'failed' && status.error && (
                              <span className="text-xs text-red-500">{status.error}</span>
                            )}
                            {status.status === 'completed' && status.completedAt && (
                              <span className="text-xs text-gray-500">
                                {new Date(status.completedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        ) : company.status?.extraction_failed ? (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span>Previous Extraction Failed</span>
                          </div>
                        ) : company.status?.wingu_extraction ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Previously Extracted</span>
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
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              if (!isExtracting) {
                onOpenChange(false)
              }
            }}
            disabled={isExtracting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleExtract} 
            disabled={selectedCompanies.length === 0 || isLoading || isExtracting}
          >
            {isLoading || isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isExtracting ? 'Extracting...' : 'Starting...'}
              </>
            ) : (
              'Extract Documents'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
