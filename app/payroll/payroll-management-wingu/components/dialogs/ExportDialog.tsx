// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { Download, X, Check, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CompanyPayrollRecord, DocumentType } from "../../types";
import { exportDocuments } from "../../utils/payrollUtils";
import { useToast } from "@/hooks/use-toast";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRecords: CompanyPayrollRecord[];
  monthNames: string[];
  selectedMonth: number;
  selectedYear: number;
}

// Document types that can be exported
const DOCUMENT_TYPES: { id: DocumentType; label: string; icon: React.ReactNode }[] = [
  { id: "paye_csv", label: "PAYE Returns (CSV)", icon: <FileText className="h-4 w-4 text-blue-500" /> },
  { id: "hslevy_csv", label: "Housing Levy Returns (CSV)", icon: <FileText className="h-4 w-4 text-green-500" /> },
  { id: "zip_file_kra", label: "KRA ZIP File", icon: <FileText className="h-4 w-4 text-amber-500" /> },
  { id: "shif_exl", label: "SHIF Returns (Excel)", icon: <FileText className="h-4 w-4 text-purple-500" /> },
  { id: "nssf_exl", label: "NSSF Returns (Excel)", icon: <FileText className="h-4 w-4 text-rose-500" /> },
];

// Company categories
const COMPANY_CATEGORIES = [
  { id: "acc", label: "Accounting" },
  { id: "audit_tax", label: "Audit & Tax" },
  { id: "cps_sheria", label: "CPS Sheria" },
  { id: "imm", label: "IMM" },
];

// Obligation statuses
const OBLIGATION_STATUSES = [
  { id: "active", label: "Active" },
  { id: "cancelled", label: "Cancelled" },
  { id: "dormant", label: "Dormant" },
  { id: "no_obligation", label: "No Obligation" },
  { id: "missing", label: "Missing" },
];

export function ExportDialog({
  open,
  onOpenChange,
  payrollRecords,
  monthNames,
  selectedMonth,
  selectedYear,
}: ExportDialogProps) {
  const { toast } = useToast();

  // State for export configuration
  const [selectedDocTypes, setSelectedDocTypes] = useState<DocumentType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedObligations, setSelectedObligations] = useState<string[]>([]);
  const [exportName, setExportName] = useState<string>(`Payroll_Export_${monthNames[selectedMonth]}_${selectedYear}`);
  const [exportAll, setExportAll] = useState<boolean>(true);
  const [exportInProgress, setExportInProgress] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [filterCompanies, setFilterCompanies] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [cancelExport, setCancelExport] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open, selectedMonth, selectedYear, monthNames]);

  const resetState = () => {
    setSelectedDocTypes([]);
    setSelectedCategories([]);
    setSelectedObligations([]);
    setExportName(`Payroll_Export_${monthNames[selectedMonth]}_${selectedYear}`);
    setExportAll(true);
    setExportInProgress(false);
    setExportProgress({ current: 0, total: 0 });
    setFilterCompanies(false);
    setSelectedCompanies([]);
    setCompanySearchTerm('');
  };

  // Toggle document type selection
  const toggleDocType = (docType: DocumentType) => {
    console.log("Toggling document type:", docType);
    setSelectedDocTypes(prev => {
      const isSelected = prev.includes(docType);
      const newSelection = isSelected
        ? prev.filter(type => type !== docType)
        : [...prev, docType];
      console.log("New document type selection:", newSelection);
      return newSelection;
    });
  };

  // Toggle category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(cat => cat !== category)
        : [...prev, category]
    );
  };

  // Toggle obligation status selection
  const toggleObligation = (obligation: string) => {
    setSelectedObligations(prev =>
      prev.includes(obligation)
        ? prev.filter(obl => obl !== obligation)
        : [...prev, obligation]
    );
  };

  // Select all document types
  const selectAllDocTypes = () => {
    if (selectedDocTypes.length === DOCUMENT_TYPES.length) {
      setSelectedDocTypes([]);
    } else {
      setSelectedDocTypes(DOCUMENT_TYPES.map(doc => doc.id));
    }
  };

  // Select all categories
  const selectAllCategories = () => {
    if (selectedCategories.length === COMPANY_CATEGORIES.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(COMPANY_CATEGORIES.map(cat => cat.id));
    }
  };

  // Select all obligation statuses
  const selectAllObligations = () => {
    if (selectedObligations.length === OBLIGATION_STATUSES.length) {
      setSelectedObligations([]);
    } else {
      setSelectedObligations(OBLIGATION_STATUSES.map(obl => obl.id));
    }
  };

  // Toggle exportAll option
  const toggleExportAll = () => {
    const newExportAll = !exportAll;
    setExportAll(newExportAll);

    // If turning on exportAll, clear selected document types
    // If turning off exportAll, select all document types by default
    if (newExportAll) {
      setSelectedDocTypes([]);
    } else {
      // When disabling "Export All", pre-select all document types for better UX
      setSelectedDocTypes(DOCUMENT_TYPES.map(doc => doc.id));
    }
  };

  // Check if date is in range
  const isDateInRange = (date: Date, from?: string | null, to?: string | null): boolean => {
    if (!from || !to) return false;
    try {
      const fromDate = new Date(from.split('/').reverse().join('-'));
      const toDate = new Date(to.split('/').reverse().join('-'));
      return date >= fromDate && date <= toDate;
    } catch (error) {
      console.error('Error parsing dates:', error);
      return false;
    }
  };

  // Filter records based on selected criteria
  const filteredRecords = useMemo(() => {
    if (exportAll) return payrollRecords;

    return payrollRecords.filter(record => {
      // Skip if record or company doesn't exist
      if (!record || !record.company) return false;

      // Check category filters
      let matchesCategory = true;
      if (selectedCategories.length > 0) {
        matchesCategory = selectedCategories.some(category => {
          const currentDate = new Date();
          switch (category) {
            case 'acc':
              return isDateInRange(currentDate, record.company.acc_client_effective_from, record.company.acc_client_effective_to);
            case 'audit_tax':
              return isDateInRange(currentDate, record.company.audit_tax_client_effective_from, record.company.audit_tax_client_effective_to);
            case 'cps_sheria':
              return isDateInRange(currentDate, record.company.cps_sheria_client_effective_from, record.company.cps_sheria_client_effective_to);
            case 'imm':
              return isDateInRange(currentDate, record.company.imm_client_effective_from, record.company.imm_client_effective_to);
            default:
              return false;
          }
        });
      }

      // Check obligation filters
      let matchesObligation = true;
      if (selectedObligations.length > 0) {
        const obligationStatus = record.pin_details?.paye_status?.toLowerCase();
        const effectiveFrom = record.pin_details?.paye_effective_from;

        // Determine specific status types
        const isCancelled = obligationStatus === 'cancelled';
        const isDormant = obligationStatus === 'dormant';
        const isNoObligation = effectiveFrom?.toLowerCase() === 'no obligation';
        const isMissing = !effectiveFrom || effectiveFrom === 'Missing';

        // Explicitly check if it has an active date (not any of the special cases)
        const hasActiveDate = effectiveFrom &&
          !isNoObligation &&
          !isCancelled &&
          !isDormant &&
          !isMissing;

        // Match against selected filters
        matchesObligation = (
          (selectedObligations.includes('active') && hasActiveDate) ||
          (selectedObligations.includes('cancelled') && isCancelled) ||
          (selectedObligations.includes('dormant') && isDormant) ||
          (selectedObligations.includes('no_obligation') && isNoObligation) ||
          (selectedObligations.includes('missing') && isMissing)
        );
      }

      // Check company filters
      let matchesCompany = true;
      if (filterCompanies) {
        matchesCompany = selectedCompanies.includes(record.company.id);
      }

      return matchesCategory && matchesObligation && matchesCompany;
    });
  }, [payrollRecords, selectedCategories, selectedObligations, exportAll, filterCompanies, selectedCompanies]);

  // Count documents that will be exported
  const documentCount = useMemo(() => {
    let count = 0;

    filteredRecords.forEach(record => {
      if (selectedDocTypes.length === 0) return;

      selectedDocTypes.forEach(docType => {
        if (record.documents[docType]) {
          count++;
        }
      });
    });

    return count;
  }, [filteredRecords, selectedDocTypes]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (exportProgress.total === 0) return 0;
    return Math.round((exportProgress.current / exportProgress.total) * 100);
  }, [exportProgress]);

  // Handle export action
  const handleExport = async () => {
    if (selectedDocTypes.length === 0 && !exportAll) {
      toast({
        title: "No document types selected",
        description: "Please select at least one document type to export",
        variant: "destructive",
      });
      return;
    }

    if (documentCount === 0) {
      toast({
        title: "No documents to export",
        description: "No documents match your selected criteria",
        variant: "destructive",
      });
      return;
    }

    setExportInProgress(true);
    setCancelExport(false);
    setExportProgress({ current: 0, total: documentCount });

    // Only use the selected document types if exportAll is false
    const docTypesToExport = exportAll
      ? DOCUMENT_TYPES.map(doc => doc.id)
      : [...selectedDocTypes]; // Create a copy to avoid reference issues

    console.log("Export all:", exportAll);
    console.log("Selected document types:", selectedDocTypes);
    console.log("Exporting document types:", docTypesToExport);

    try {
      await exportDocuments({
        name: exportName,
        documentTypes: docTypesToExport,
        records: filteredRecords,
        onProgress: (current, total) => {
          if (cancelExport) return;
          setExportProgress({ current, total });
        },
        onSuccess: (count) => {
          if (cancelExport) return;
          toast({
            title: "Export successful",
            description: `${count} documents have been exported`,
          });
          onOpenChange(false);
        },
        onError: (error) => {
          if (error.message === "Export cancelled by user") {
            toast({
              title: "Export cancelled",
              description: "The export process has been cancelled",
            });
          } else {
            toast({
              title: "Export failed",
              description: error.message || "There was an error exporting the documents",
              variant: "destructive",
            });
          }
        },
        shouldCancel: () => cancelExport
      });
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setExportInProgress(false);
    }
  };

  // Handle cancel export
  const handleCancelExport = () => {
    setCancelExport(true);
    toast({
      title: "Export cancelled",
      description: "The export process has been cancelled",
    });
  };

  const getFilteredCompanies = () => {
    if (filterCompanies) {
      return payrollRecords.filter(record => selectedCompanies.includes(record.company.id));
    }
    return payrollRecords;
  };

  const searchResults = useMemo(() => {
    if (!companySearchTerm) return payrollRecords;
    return payrollRecords.filter(record => record.company.company_name.toLowerCase().includes(companySearchTerm.toLowerCase()));
  }, [companySearchTerm, payrollRecords]);

  const toggleCompany = (companyId: string, checked: boolean) => {
    if (checked) {
      setSelectedCompanies(prev => [...prev, companyId]);
    } else {
      setSelectedCompanies(prev => prev.filter(id => id !== companyId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!exportInProgress) {
        onOpenChange(isOpen);
      }
    }}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-lg">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center justify-between text-blue-800">
            <span>Export Documents</span>
          </DialogTitle>

          {/* Period Display - Made more prominent */}
          <div className="bg-blue-100 p-3 mt-2 rounded-md flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-blue-700 mr-2" />
              <span className="text-lg font-medium text-blue-800">Export Period:</span>
            </div>
            <span className="text-lg font-bold text-blue-900">{monthNames[selectedMonth]} {selectedYear}</span>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-5">
          {/* Export Name */}
          <div className="space-y-2">
            <Label htmlFor="export-name" className="text-sm font-medium text-gray-700">
              Export Name
            </Label>
            <Input
              id="export-name"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={exportInProgress}
            />
          </div>

          {/* Company Filtering */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Company Selection</h3>
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="export-all-companies"
                  checked={!filterCompanies}
                  onCheckedChange={(checked) => setFilterCompanies(checked !== true)}
                  className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  disabled={exportInProgress}
                />
                <Label htmlFor="export-all-companies" className="font-medium text-blue-800">
                  Include all companies ({payrollRecords.length})
                </Label>
              </div>

              {filterCompanies && (
                <div className="mt-3 p-3 bg-white rounded border border-blue-100">
                  <Input
                    placeholder="Search companies..."
                    value={companySearchTerm}
                    onChange={(e) => setCompanySearchTerm(e.target.value)}
                    className="mb-2"
                    disabled={exportInProgress}
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {filteredCompanies.map((record) => (
                      <div key={record.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`company-${record.id}`}
                          checked={selectedCompanies.includes(record.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCompanies((prev) => [...prev, record.id]);
                            } else {
                              setSelectedCompanies((prev) => prev.filter((id) => id !== record.id));
                            }
                          }}
                          disabled={exportInProgress}
                        />
                        <Label
                          htmlFor={`company-${record.id}`}
                          className="text-sm cursor-pointer truncate"
                        >
                          {record.company?.company_name || "Unknown Company"}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 grid grid-cols-3 gap-4">
            {/* Document Types */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Document Types</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="export-all"
                    checked={exportAll}
                    onCheckedChange={toggleExportAll}
                    disabled={exportInProgress}
                  />
                  <Label htmlFor="export-all" className="text-xs cursor-pointer">
                    Export All Types
                  </Label>
                </div>
              </div>

              {!exportAll && (
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-gray-500">Select types</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={selectAllDocTypes}
                      disabled={exportInProgress}
                    >
                      {selectedDocTypes.length === DOCUMENT_TYPES.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="max-h-40 overflow-y-auto pr-1 space-y-1">
                      {DOCUMENT_TYPES.map((docType) => (
                        <div
                          key={docType.id}
                          className="flex items-center space-x-2 p-1 rounded hover:bg-gray-100"
                        >
                          <Checkbox
                            id={`doc-type-${docType.id}`}
                            checked={selectedDocTypes.includes(docType.id)}
                            onCheckedChange={() => toggleDocType(docType.id)}
                            disabled={exportInProgress}
                          />
                          <Label
                            htmlFor={`doc-type-${docType.id}`}
                            className="flex items-center space-x-2 text-sm cursor-pointer flex-1"
                          >
                            {docType.icon}
                            <span>{docType.label}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Company Categories */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Company Categories</h3>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-200">
                  <Checkbox
                    id="select-all-categories"
                    checked={selectedCategories.length === COMPANY_CATEGORIES.length}
                    onCheckedChange={selectAllCategories}
                    className="h-4 w-4 text-blue-600 rounded"
                    disabled={exportInProgress}
                  />
                  <Label htmlFor="select-all-categories" className="font-medium text-gray-700">
                    Select All
                  </Label>
                </div>
                <div className="space-y-2">
                  {COMPANY_CATEGORIES.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => toggleCategory(category.id)}
                        className="h-4 w-4 text-blue-600 rounded"
                        disabled={exportInProgress}
                      />
                      <Label htmlFor={`cat-${category.id}`} className="font-normal text-gray-700">
                        {category.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Obligation Statuses */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Obligation Status</h3>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-200">
                  <Checkbox
                    id="select-all-obligations"
                    checked={selectedObligations.length === OBLIGATION_STATUSES.length}
                    onCheckedChange={selectAllObligations}
                    className="h-4 w-4 text-blue-600 rounded"
                    disabled={exportInProgress}
                  />
                  <Label htmlFor="select-all-obligations" className="font-medium text-gray-700">
                    Select All
                  </Label>
                </div>
                <div className="space-y-2">
                  {OBLIGATION_STATUSES.map((obligation) => (
                    <div key={obligation.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`obl-${obligation.id}`}
                        checked={selectedObligations.includes(obligation.id)}
                        onCheckedChange={() => toggleObligation(obligation.id)}
                        className="h-4 w-4 text-blue-600 rounded"
                        disabled={exportInProgress}
                      />
                      <Label htmlFor={`obl-${obligation.id}`} className="font-normal text-gray-700">
                        {obligation.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
          {/* Export Summary */}
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">Export Summary</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <div className="flex justify-between">
                <span>Companies:</span>
                <span className="font-medium">{getFilteredCompanies().length}</span>
              </div>
              <div className="flex justify-between">
                <span>Documents:</span>
                <span className="font-medium">{documentCount}</span>
              </div>
            </div>
          </div>

          {/* Export Progress */}
          {exportInProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Exporting documents...</span>
                <span>{exportProgress.current} of {exportProgress.total}</span>
              </div>
              <Progress value={progressPercentage} className="h-2 bg-gray-200" />
              <div className="flex justify-end mt-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancelExport}
                  className="text-sm"
                  size="sm"
                >
                  Cancel Export
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
            disabled={exportInProgress}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={`flex items-center gap-2 ${exportInProgress ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={handleExport}
            disabled={exportInProgress || documentCount === 0}
          >
            {exportInProgress ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Documents
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}