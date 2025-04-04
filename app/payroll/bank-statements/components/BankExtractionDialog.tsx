// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import {
    Loader2, Save, ChevronLeft, ChevronRight,
    AlertTriangle, CheckCircle, Check, Trash,
    Plus, X, ChevronsUpDown, CalendarIcon, Eye,
    FileCheck, DollarSign, Building, Calendar
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format, parseISO, isValid } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";

// Importing PDF.js functionality
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist';


// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface MonthlyBalance {
    month: number
    year: number
    closing_balance: number
    opening_balance: number
    statement_page: number
    closing_date: string | null
    highlight_coordinates: {
        x1: number
        y1: number
        x2: number
        y2: number
        page: number
    } | null
    is_verified: boolean
    verified_by: string | null
    verified_at: string | null
}

interface BankStatement {
    id: string
    bank_id: number
    statement_month: number
    statement_year: number
    quickbooks_balance: number | null
    statement_document: {
        statement_pdf: string | null
        statement_excel: string | null
        document_size?: number
    }
    statement_extractions: {
        bank_name: string | null
        account_number: string | null
        currency: string | null
        statement_period: string | null
        opening_balance: number | null
        closing_balance: number | null
        monthly_balances: MonthlyBalance[]
    }
    validation_status: {
        is_validated: boolean
        validation_date: string | null
        validated_by: string | null
        mismatches: Array<string>
    }
    has_soft_copy: boolean
    has_hard_copy: boolean
    status: {
        status: string
        assigned_to: string | null
        verification_date: string | null
    }
}

interface BankExtractionDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    statement: BankStatement
    onStatementUpdated: (statement: BankStatement) => void
}

const normalizeCurrencyCode = (code) => {
    if (!code) return 'USD'; // Default fallback

    // Convert to uppercase and trim
    const upperCode = code.toUpperCase().trim();

    // Map of common incorrect currency codes to valid ISO codes
    const currencyMap = {
        'EURO': 'EUR',
        'EUROS': 'EUR',
        'US DOLLAR': 'USD',
        'US DOLLARS': 'USD',
        'USDOLLAR': 'USD',
        'POUND': 'GBP',
        'POUNDS': 'GBP',
        'STERLING': 'GBP',
        'KENYA SHILLING': 'KES',
        'KENYA SHILLINGS': 'KES',
        'KENYAN SHILLING': 'KES',
        'KENYAN SHILLINGS': 'KES',
        'KSH': 'KES',
        'K.SH': 'KES',
        'KSHS': 'KES',
        'K.SHS': 'KES',
        'SH': 'KES',
        'KES': 'KES'
    };

    // Return mapped value or the original if not in the map
    return currencyMap[upperCode] || upperCode;
};

// Parse statement period to get expected months
// Fix the parseStatementPeriod function to handle month indexing consistently
function parseStatementPeriod(periodString) {
    if (!periodString) return null;

    // DD/MM/YYYY - DD/MM/YYYY format
    const dateRangePattern = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})\s*-\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/;
    const matches = periodString.match(dateRangePattern);

    if (matches && matches.length >= 7) {
        // Extract and correct month indexing (subtract 1 to convert to JS 0-based months)
        const startMonth = parseInt(matches[2], 10) - 1; // Convert to 0-based
        const startYear = parseInt(matches[3], 10);
        const endMonth = parseInt(matches[5], 10) - 1; // Convert to 0-based
        const endYear = parseInt(matches[6], 10);

        if (!isNaN(startMonth) && !isNaN(startYear) && !isNaN(endMonth) && !isNaN(endYear)) {
            return { startMonth, startYear, endMonth, endYear };
        }
    }

    // Month name format (e.g., "January - July 2024")
    const monthNamePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\s*-\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i;
    const monthMatches = periodString.match(monthNamePattern);

    if (monthMatches && monthMatches.length >= 5) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

        const startMonthName = monthMatches[1].toLowerCase().substring(0, 3);
        const startYear = parseInt(monthMatches[2], 10);
        const endMonthName = monthMatches[3].toLowerCase().substring(0, 3);
        const endYear = parseInt(monthMatches[4], 10);

        // Convert month names to 0-based index
        const startMonth = monthNames.indexOf(startMonthName); // Already 0-based
        const endMonth = monthNames.indexOf(endMonthName); // Already 0-based

        if (startMonth >= 0 && endMonth >= 0 && !isNaN(startYear) && !isNaN(endYear)) {
            return { startMonth, startYear, endMonth, endYear };
        }
    }

    return null;
}

// Fix the generateMonthRange function to be consistent with 0-based indexing
function generateMonthRange(startMonth, startYear, endMonth, endYear) {
    const months = [];
    let currentYear = startYear;
    let currentMonth = startMonth;

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        months.push({
            month: currentMonth, // Keep as 0-based internally
            year: currentYear
        });

        currentMonth++;
        if (currentMonth > 11) { // Use 11 as the max month index (December)
            currentMonth = 0; // Reset to January (0)
            currentYear++;
        }
    }

    return months;
}

const createStatementCyclesForPeriod = async (statementPeriod) => {
    try {
        const periodDates = parseStatementPeriod(statementPeriod);
        if (!periodDates) return [];

        const { startMonth, startYear, endMonth, endYear } = periodDates;
        const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

        console.log("Processing months:", monthsInRange.map(m => `${m.month + 1}/${m.year}`).join(", "));

        const createdCycles = [];

        for (const { month, year } of monthsInRange) {
            // Format month with leading zero and add 1 to convert from 0-based to 1-based
            const monthStr = (month + 1).toString().padStart(2, '0');
            const cycleMonthYear = `${year}-${monthStr}`;

            try {
                // First, check if the cycle already exists (more reliable than upsert with conflict handling)
                const { data: existingCycle, error: checkError } = await supabase
                    .from('statement_cycles')
                    .select('id, month_year')
                    .eq('month_year', cycleMonthYear)
                    .maybeSingle(); // Use maybeSingle instead of single

                if (checkError && checkError.code !== 'PGRST116') {
                    console.error(`Error checking cycle for ${cycleMonthYear}:`, checkError);
                    continue;
                }

                // If cycle exists, add it to results and continue
                if (existingCycle) {
                    console.log(`Found existing cycle for ${cycleMonthYear}: ${existingCycle.id}`);
                    createdCycles.push(existingCycle);
                    continue;
                }

                // If cycle doesn't exist, create a new one
                const { data: newCycle, error: insertError } = await supabase
                    .from('statement_cycles')
                    .insert({
                        month_year: cycleMonthYear,
                        status: 'active',
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error(`Error creating cycle for ${cycleMonthYear}:`, insertError);
                    continue;
                }

                console.log(`Created new cycle for ${cycleMonthYear}: ${newCycle.id}`);
                createdCycles.push(newCycle);
            } catch (cycleError) {
                console.error(`Error processing cycle for ${cycleMonthYear}:`, cycleError);
            }
        }

        return createdCycles;
    } catch (error) {
        console.error('Statement cycle creation error:', error);
        return [];
    }
};

export function BankExtractionDialog({
    isOpen,
    onClose,
    bank,
    statement,
    onStatementUpdated
}: BankExtractionDialogProps) {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    // Early return if no statement is provided
    if (!statement || !bank) {
        return null;
    }

    const [activeTab, setActiveTab] = useState<string>('overview')
    const [pdfUrl, setPdfUrl] = useState<string>('')
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [totalPages, setTotalPages] = useState<number>(1)
    const [pdfScale, setPdfScale] = useState<number>(1.0) // Scale for PDF view
    const [documentSize, setDocumentSize] = useState<number>(statement.statement_document.document_size || 0)
    const [loading, setLoading] = useState<boolean>(true)
    const [saving, setSaving] = useState<boolean>(false)
    const [deleting, setDeleting] = useState<boolean>(false)
    const [selectedMonth, setSelectedMonth] = useState<number>(statement.statement_month)
    const [selectedYear, setSelectedYear] = useState<number>(statement.statement_year)
    const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
    const [pdfText, setPdfText] = useState<string>('')
    const [selectedText, setSelectedText] = useState<string>('')
    const [allPagesRendered, setAllPagesRendered] = useState<boolean[]>([])
    const [renderedPageCanvases, setRenderedPageCanvases] = useState<HTMLCanvasElement[]>([])

    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    // Detected periods in PDF
    const [detectedPeriods, setDetectedPeriods] = useState<{ month: number, year: number, page: number, lastDate?: string }[]>([])
    const [currentPeriodIndex, setCurrentPeriodIndex] = useState<number>(0)
    const [expectedMonths, setExpectedMonths] = useState<{ month: number, year: number }[]>([])

    // Selection state
    const [selection, setSelection] = useState<{
        value: number,
        text: string,
        position: { x: number, y: number },
        page: number,
        date?: string
    } | null>(null)

    // Editable extraction fields
    const [bankName, setBankName] = useState<string>(statement.statement_extractions.bank_name || '')
    const [accountNumber, setAccountNumber] = useState<string>(statement.statement_extractions.account_number || '')
    const [currency, setCurrency] = useState<string>(statement.statement_extractions.currency || '')
    const [statementPeriod, setStatementPeriod] = useState<string>(statement.statement_extractions.statement_period || '')
    const [monthlyBalances, setMonthlyBalances] = useState<MonthlyBalance[]>(
        statement.statement_extractions.monthly_balances || []
    )

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const pdfContainerRef = useRef<HTMLDivElement>(null)
    const selectionRef = useRef<HTMLDivElement>(null)
    const pagesContainerRef = useRef<HTMLDivElement>(null)

    // Effect to parse statement period and generate expected months
    useEffect(() => {
        const periodDates = parseStatementPeriod(statementPeriod);
        if (periodDates) {
            const { startMonth, startYear, endMonth, endYear } = periodDates;

            // Generate all months in the range
            const allMonths = [];
            let currentYear = startYear;
            let currentMonth = startMonth;

            while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
                allMonths.push({ month: currentMonth, year: currentYear });

                // Move to next month
                currentMonth++;
                if (currentMonth > 12) {
                    currentMonth = 1;
                    currentYear++;
                }
            }

            setExpectedMonths(allMonths);

            // Add missing months to monthly balances
            const updatedBalances = [...monthlyBalances];

            allMonths.forEach(({ month, year }) => {
                const exists = monthlyBalances.some(
                    balance => balance.month === month && balance.year === year
                );

                if (!exists) {
                    updatedBalances.push({
                        month,
                        year,
                        closing_balance: 0,
                        opening_balance: 0,
                        statement_page: 1,
                        closing_date: null,
                        highlight_coordinates: null,
                        is_verified: false,
                        verified_by: null,
                        verified_at: null
                    });
                }
            });

            if (updatedBalances.length !== monthlyBalances.length) {
                setMonthlyBalances(updatedBalances);
            }
        }
    }, [statementPeriod, monthlyBalances]);

    const handleClose = () => {
        if (!isLoading && !saving && !deleting) {
            onClose()
        }
    }

    // Load PDF document
    useEffect(() => {
        const loadPdf = async () => {
            if (!statement.statement_document.statement_pdf) {
                setLoading(false)
                return
            }

            try {
                setLoading(true)

                // Get public URL for the PDF
                const { data, error } = await supabase.storage
                    .from('Statement-Cycle')
                    .createSignedUrl(statement.statement_document.statement_pdf, 3600)

                if (error) throw error

                setPdfUrl(data.signedUrl)

                // Load the PDF document using PDF.js
                const loadingTask = pdfjsLib.getDocument(data.signedUrl);
                const pdf = await loadingTask.promise;
                setPdfDocument(pdf);
                setTotalPages(pdf.numPages);

                // Initialize empty rendered pages array
                setAllPagesRendered(new Array(pdf.numPages).fill(false));
                setRenderedPageCanvases(new Array(pdf.numPages).fill(null));

                // Get document size
                const stats = await supabase.storage
                    .from('Statement-Cycle')
                    .getPublicUrl(statement.statement_document.statement_pdf);

                if (stats) {
                    const response = await fetch(data.signedUrl, { method: 'HEAD' });
                    const size = parseInt(response.headers.get('content-length') || '0');
                    setDocumentSize(size);
                }

                // Load all pages
                await renderAllPages(pdf);

            } catch (error) {
                console.error('Error loading PDF:', error)
                toast({
                    title: 'Error',
                    description: 'Failed to load PDF document',
                    variant: 'destructive'
                })
            } finally {
                setLoading(false)
            }
        }

        if (isOpen) {
            loadPdf()
        }

        return () => {
            // Cleanup
            if (pdfDocument) {
                pdfDocument.destroy();
            }
        };
    }, [isOpen, statement.statement_document.statement_pdf, toast])

    // Function to format date for the current month
    const formatDateForCurrentMonth = () => {
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        return `${lastDay}/${selectedMonth}/${selectedYear}`;
    };

    // Render all pages function
    const renderAllPages = async (pdfDoc = pdfDocument) => {
        if (!pdfDoc || !pagesContainerRef.current) return;

        try {
            // Clear existing content
            while (pagesContainerRef.current.firstChild) {
                pagesContainerRef.current.removeChild(pagesContainerRef.current.firstChild);
            }

            // Create new canvas elements for each page
            const newRenderedCanvases = [];
            const containerWidth = pagesContainerRef.current.clientWidth || 800;

            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);

                const viewport = page.getViewport({ scale: 1 });
                const scale = Math.min(1.0, (containerWidth - 40) / viewport.width);
                const scaledViewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;
                canvas.className = 'mb-4 shadow-md'; // Add spacing and shadow
                canvas.dataset.pageNumber = pageNum.toString();

                // Add click event to each canvas for text selection
                canvas.addEventListener('click', (e) => handleCanvasClick(e, pageNum, canvas));

                pagesContainerRef.current.appendChild(canvas);
                newRenderedCanvases[pageNum - 1] = canvas;

                const context = canvas.getContext('2d');

                // Render PDF page
                const renderContext = {
                    canvasContext: context,
                    viewport: scaledViewport
                };

                await page.render(renderContext).promise;

                // Extract text content for this page
                const textContent = await page.getTextContent();
                const textItems = textContent.items.map(item => item.str).join(' ');

                // Detect dates in this page to associate with periods
                detectDatesInPage(textItems, pageNum);

                // Draw highlights for this page
                drawHighlightsForPage(context, scaledViewport, pageNum);

                // Mark page as rendered
                setAllPagesRendered(prev => {
                    const updated = [...prev];
                    updated[pageNum - 1] = true;
                    return updated;
                });
            }

            setRenderedPageCanvases(newRenderedCanvases);

        } catch (error) {
            console.error('Error rendering all pages:', error);
            toast({
                title: 'Error',
                description: 'Failed to render all PDF pages',
                variant: 'destructive'
            });
        }
    };

    // Draw highlights for a specific page
    const drawHighlightsForPage = (context, viewport, pageNumber) => {
        monthlyBalances.forEach(balance => {
            if (balance.highlight_coordinates && balance.highlight_coordinates.page === pageNumber) {
                const { x1, y1, x2, y2 } = balance.highlight_coordinates;

                // Draw highlight
                context.fillStyle = balance.is_verified ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)';
                context.fillRect(x1, y1, x2 - x1, y2 - y1);

                // Draw border
                context.strokeStyle = balance.is_verified ? 'rgba(34, 197, 94, 0.8)' : 'rgba(251, 191, 36, 0.8)';
                context.lineWidth = 2;
                context.strokeRect(x1, y1, x2 - x1, y2 - y1);

                // Add month label
                context.fillStyle = 'white';
                context.fillRect(x1, y1 - 20, 80, 20);
                context.strokeRect(x1, y1 - 20, 80, 20);

                context.fillStyle = 'black';
                context.font = '12px Arial';
                context.fillText(
                    `${format(new Date(balance.year, balance.month, 1), 'MMM yyyy')}`,
                    x1 + 5,
                    y1 - 5
                );
            }
        });
    };

    // Handle click on a specific canvas
    const handleCanvasClick = async (e, pageNum, canvas) => {
        if (!canvas) return;

        setCurrentPage(pageNum);

        // Get the position relative to the canvas
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Extract text at this position
        await extractTextAtPosition(x, y, pageNum);
    };

    // Detect dates in the page text
    const detectDatesInPage = (text, pageNumber) => {
        // Date pattern: DD/MM/YYYY or DD-MM-YYYY
        const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
        const matches = [...text.matchAll(datePattern)];

        if (matches.length > 0) {
            // Sort matches by date (assuming DD/MM/YYYY format)
            const dates = matches.map(match => {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]);
                const year = parseInt(match[3]);
                return { text: match[0], date: new Date(year, month, day) };
            }).sort((a, b) => b.date - a.date); // Latest date first

            // Get the latest date
            const latestDate = dates[0];

            // Update detected periods if this page has a latest date
            if (latestDate) {
                const month = latestDate.date.getMonth() + 1;
                const year = latestDate.date.getFullYear();

                setDetectedPeriods(prev => {
                    // Check if we already have this period
                    const existingPeriodIndex = prev.findIndex(p => p.month === month && p.year === year);

                    if (existingPeriodIndex >= 0) {
                        // Update existing period
                        const updated = [...prev];
                        updated[existingPeriodIndex] = {
                            ...updated[existingPeriodIndex],
                            lastDate: latestDate.text
                        };
                        return updated;
                    } else {
                        // Add new period
                        return [...prev, {
                            month,
                            year,
                            page: pageNumber,
                            lastDate: latestDate.text
                        }];
                    }
                });
            }
        }
    };

    // Function to extract text at a position
    const extractTextAtPosition = async (x, y, pageNum) => {
        if (!pdfDocument) return;

        try {
            // Get the page
            const page = await pdfDocument.getPage(pageNum);

            // Get the canvas for this page
            const canvas = renderedPageCanvases[pageNum - 1];
            if (!canvas) return;

            // Convert canvas position to PDF position
            const viewport = page.getViewport({ scale: 1 });
            const containerWidth = canvas.width;
            const scale = containerWidth / viewport.width;

            // This would be more complex in a real implementation
            // Here we simulate finding text at the clicked position
            const textContent = await page.getTextContent();

            // Find text items near the clicked position
            const nearbyItems = textContent.items.filter(item => {
                const itemRect = viewport.convertToViewportRectangle([item.transform[4], item.transform[5], item.transform[4] + item.width, item.transform[5] + item.height]);
                const scaledRect = {
                    left: itemRect[0] * scale,
                    top: viewport.height - itemRect[1] * scale, // Flip Y coordinate
                    right: itemRect[2] * scale,
                    bottom: viewport.height - itemRect[3] * scale
                };

                // Check if click is near this text item
                return (
                    Math.abs(x - ((scaledRect.left + scaledRect.right) / 2)) < 50 &&
                    Math.abs(y - ((scaledRect.top + scaledRect.bottom) / 2)) < 50
                );
            });

            // Extract numeric values from nearby text
            const numericPattern = /\$?\s*[\d,]+\.?\d*/g;
            let selectedText = '';
            let value = null;

            if (nearbyItems.length > 0) {
                selectedText = nearbyItems.map(item => item.str).join(' ');
                const matches = selectedText.match(numericPattern);

                if (matches && matches.length > 0) {
                    // Clean and parse the first numeric match
                    const cleanedText = matches[0].replace(/[$,]/g, '');
                    value = parseFloat(cleanedText);
                }
            }

            if (!isNaN(value) && value !== null) {
                // Set the selection with the extracted value
                setSelection({
                    value,
                    text: selectedText,
                    position: { x, y },
                    page: pageNum,
                    // Try to find a nearby date
                    date: findNearbyDate(selectedText, 0) || formatDateForCurrentMonth()
                });
            }

        } catch (error) {
            console.error('Error extracting text:', error);
        }
    };

    // Find a date near the selected text
    const findNearbyDate = (text, position, windowSize = 100) => {
        // Extract a window of text around the position
        const start = Math.max(0, position - windowSize);
        const end = Math.min(text.length, position + windowSize);
        const textWindow = text.substring(start, end);

        // Look for dates in this window
        const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
        const matches = [...textWindow.matchAll(datePattern)];

        return matches.length > 0 ? matches[0][0] : null;
    };

    const handleSave = async () => {
        try {
            setSaving(true)

            // Prepare updated extraction data
            const updatedExtractions = {
                bank_name: bankName || null,
                account_number: accountNumber || null,
                currency: currency || null,
                statement_period: statementPeriod || statement.statement_extractions.statement_period,
                // Set opening/closing balance based on monthly balances for the selected month/year
                opening_balance: getMonthlyOpeningBalance(),
                closing_balance: getMonthlyClosingBalance(),
                monthly_balances: monthlyBalances
            }

            // Validate bank details match expected values
            const hasMismatches = []
            if (bankName && !bankName.toLowerCase().includes(bank.bank_name.toLowerCase())) {
                hasMismatches.push(`Bank name mismatch: Expected "${bank.bank_name}", found "${bankName}"`)
            }
            if (accountNumber && !accountNumber.includes(bank.account_number)) {
                hasMismatches.push(`Account number mismatch: Expected "${bank.account_number}", found "${accountNumber}"`)
            }
            // if (currency && normalizeCurrencyCode(currency) !== normalizeCurrencyCode(bank.bank_currency)) {
            //     hasMismatches.push(`Currency mismatch: Expected "${bank.bank_currency}", found "${currency}"`)
            // }

            // Update validation status
            const validationStatus = {
                is_validated: hasMismatches.length === 0,
                validation_date: new Date().toISOString(),
                validated_by: null, // TODO: Add user info when authentication is implemented
                mismatches: hasMismatches
            }

            // Update statement status
            const statusUpdate = {
                status: hasMismatches.length === 0 ? 'validated' : 'validation_issues',
                verification_date: new Date().toISOString(),
                assigned_to: statement.status.assigned_to
            }

            // Update document size
            const updatedDocumentDetails = {
                ...statement.statement_document,
                document_size: documentSize
            }

            // Update database
            const { data, error } = await supabase
                .from('acc_cycle_bank_statements')
                .update({
                    statement_extractions: updatedExtractions,
                    validation_status: validationStatus,
                    status: statusUpdate,
                    statement_document: updatedDocumentDetails
                })
                .eq('id', statement.id)
                .select('*')
                .single()

            if (error) throw error

            // Notify parent component
            onStatementUpdated(data)

            // Handle statement range data
            await handleStatementRangeData();

            toast({
                title: 'Success',
                description: 'Statement data saved successfully'
            })
        } catch (error) {
            console.error('Save error:', error)
            toast({
                title: 'Save Error',
                description: 'Failed to save statement data',
                variant: 'destructive'
            })
        } finally {
            setSaving(false)
        }
    }

    // In BankExtractionDialog.tsx
    const handleDeleteStatement = () => {
        // Show dialog instead of window.confirm
        setShowDeleteConfirmation(true);
    };

    // 3. Add a new function to handle confirmed deletion:
    const confirmDeleteStatement = async () => {
        try {
            setDeleting(true);

            // Delete files from storage if they exist
            if (statement.statement_document.statement_pdf) {
                await supabase.storage
                    .from('Statement-Cycle')
                    .remove([statement.statement_document.statement_pdf]);
            }

            if (statement.statement_document.statement_excel) {
                await supabase.storage
                    .from('Statement-Cycle')
                    .remove([statement.statement_document.statement_excel]);
            }

            // Delete the statement record
            const { error } = await supabase
                .from('acc_cycle_bank_statements')
                .delete()
                .eq('id', statement.id);

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Bank statement deleted successfully'
            });

            // Close dialog and pass null to update parent
            onClose();
            onStatementUpdated(null);
        } catch (error) {
            console.error('Error deleting statement:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete bank statement',
                variant: 'destructive'
            });
        } finally {
            setDeleting(false);
            setShowDeleteConfirmation(false);
        }
    };

    const formatCurrency = (amount, currencyCode) => {
        if (amount === null || amount === undefined) return '-';

        try {
            // Normalize the currency code
            const normalizedCurrency = normalizeCurrencyCode(currencyCode || bank.bank_currency);

            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: normalizedCurrency,
                minimumFractionDigits: 2
            }).format(amount);
        } catch (error) {
            // Fallback if there's an error with the currency code
            console.warn(`Invalid currency code: ${currencyCode}. Falling back to plain number format.`);
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
    };

    const handleVerifyMonthlyBalance = (index: number) => {
        setMonthlyBalances(prev => {
            const updated = [...prev]
            updated[index] = {
                ...updated[index],
                is_verified: true,
                verified_by: "Current User", // TODO: Replace with actual user info
                verified_at: new Date().toISOString()
            }
            return updated
        })
    }

    const handleAddMonthlyBalance = () => {
        // Create a new balance entry for the current selected month/year
        const newBalance = {
            month: selectedMonth,
            year: selectedYear,
            closing_balance: 0,
            opening_balance: 0,
            statement_page: 1,
            closing_date: null,
            highlight_coordinates: null,
            is_verified: false,
            verified_by: null,
            verified_at: null
        };

        // Check if this month/year already exists
        const existingIndex = monthlyBalances.findIndex(
            b => b.month === selectedMonth && b.year === selectedYear
        );

        if (existingIndex >= 0) {
            toast({
                description: `Balance for ${format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy')} already exists.`,
                variant: 'default'
            });
            return;
        }

        // Add the new balance
        setMonthlyBalances(prev => [...prev, newBalance]);

        toast({
            description: `Added ${format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy')} to monthly balances.`,
            variant: 'default'
        });
    };

    const handleUpdateBalance = (index: number, field: string, value: any) => {
        setMonthlyBalances(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                [field]: value,
                is_verified: false // Reset verification when edited
            };
            return updated;
        });
    };

    const handleRemoveBalance = (index: number) => {
        setMonthlyBalances(prev => {
            const updated = [...prev];
            updated.splice(index, 1);
            return updated;
        });

        toast({
            description: 'Monthly balance removed.',
            variant: 'default'
        });
    };

    // Navigate to a specific period
    const navigateToPeriod = (periodIndex: number) => {
        if (periodIndex < 0 || periodIndex >= detectedPeriods.length) return;

        const period = detectedPeriods[periodIndex];
        setSelectedMonth(period.month);
        setSelectedYear(period.year);
        setCurrentPeriodIndex(periodIndex);

        // Scroll to the page
        const pageElement = document.querySelector(`[data-page-number="${period.page}"]`);
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        toast({
            description: `Navigated to ${format(new Date(period.year, period.month, 1), 'MMMM yyyy')}${period.lastDate ? ` (Last date: ${period.lastDate})` : ''}`,
            variant: 'default'
        });
    };

    // Navigate to next period
    const navigateToNextPeriod = () => {
        if (currentPeriodIndex < detectedPeriods.length - 1) {
            navigateToPeriod(currentPeriodIndex + 1);
        }
    };

    // Navigate to previous period
    const navigateToPreviousPeriod = () => {
        if (currentPeriodIndex > 0) {
            navigateToPeriod(currentPeriodIndex - 1);
        }
    };

    // Apply selected value as closing balance for current period
    const applySelectionAsClosingBalance = () => {
        if (!selection) return;

        // Find the index of the balance for the current month/year
        const balanceIndex = monthlyBalances.findIndex(
            b => b.month === selectedMonth && b.year === selectedYear
        );

        // Create highlight coordinates for the selection
        const highlightCoords = {
            x1: selection.position.x - 20,
            y1: selection.position.y - 10,
            x2: selection.position.x + 150,
            y2: selection.position.y + 10,
            page: selection.page
        };

        if (balanceIndex >= 0) {
            // Update existing balance
            const updatedBalances = [...monthlyBalances];
            updatedBalances[balanceIndex] = {
                ...updatedBalances[balanceIndex],
                closing_balance: selection.value,
                statement_page: selection.page,
                highlight_coordinates: highlightCoords,
                is_verified: false // Reset verification when edited
            };

            // Update closing date if available
            if (selection.date) {
                updatedBalances[balanceIndex].closing_date = selection.date;
            }

            setMonthlyBalances(updatedBalances);
        } else {
            // Add new balance
            setMonthlyBalances(prev => [
                ...prev,
                {
                    month: selectedMonth,
                    year: selectedYear,
                    closing_balance: selection.value,
                    opening_balance: 0, // Default to 0
                    statement_page: selection.page,
                    closing_date: selection.date || null,
                    highlight_coordinates: highlightCoords,
                    is_verified: false,
                    verified_by: null,
                    verified_at: null
                }
            ]);
        }

        // Re-render the page with the highlight
        const canvas = renderedPageCanvases[selection.page - 1];
        if (canvas && pdfDocument) {
            pdfDocument.getPage(selection.page).then(page => {
                const viewport = page.getViewport({ scale: 1 });
                const containerWidth = canvas.width;
                const scale = containerWidth / viewport.width;

                const context = canvas.getContext('2d');

                // Render PDF page
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                page.render(renderContext).promise.then(() => {
                    // Draw highlights
                    drawHighlightsForPage(context, viewport, selection.page);
                });
            });
        }

        // Clear selection and show toast
        setSelection(null);
        toast({
            description: `Set closing balance for ${format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy')}${selection.date ? ` (Date: ${selection.date})` : ''}`,
            variant: 'default'
        });

        // Navigate to next period if available
        setTimeout(() => {
            navigateToNextPeriod();
        }, 500);
    };

    // Get the monthly opening balance for the selected month/year
    const getMonthlyOpeningBalance = () => {
        const balance = monthlyBalances.find(
            b => b.month === selectedMonth && b.year === selectedYear
        );
        return balance?.opening_balance ?? null;
    };

    // Get the monthly closing balance for the selected month/year
    const getMonthlyClosingBalance = () => {
        const balance = monthlyBalances.find(
            b => b.month === selectedMonth && b.year === selectedYear
        );
        return balance?.closing_balance ?? null;
    };

    // Check if period is verified
    const isPeriodVerified = (month: number, year: number) => {
        const balance = monthlyBalances.find(
            b => b.month === month && b.year === year
        );
        return balance?.is_verified ?? false;
    };

    // Function to scroll to a specific page
    const scrollToPage = (pageNumber: number) => {
        if (pageNumber < 1 || pageNumber > totalPages) return;

        const pageElement = document.querySelector(`[data-page-number="${pageNumber}"]`);
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentPage(pageNumber);
        }
    };

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleStatementRangeData = async () => {
        try {
            const periodDates = parseStatementPeriod(statementPeriod);
            if (!periodDates) {
                console.warn("Could not parse statement period:", statementPeriod);
                return;
            }

            const { startMonth, startYear, endMonth, endYear } = periodDates;
            console.log(`Processing statement period: ${startMonth + 1}/${startYear} to ${endMonth + 1}/${endYear}`);

            // Generate all months in the range
            const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);
            console.log("Months to process:", monthsInRange.map(m => `${m.month + 1}/${m.year}`).join(", "));

            // Create cycles for all months in the period
            const createdCycles = await createStatementCyclesForPeriod(statementPeriod);
            if (!createdCycles || createdCycles.length === 0) {
                console.error("Failed to create statement cycles");
                return;
            }

            // Collect all monthly balances from the current statement
            const allMonthlyBalances = [...monthlyBalances];

            // Ensure we have balance entries for ALL months in the range
            for (const { month, year } of monthsInRange) {
                const existingBalanceIndex = allMonthlyBalances.findIndex(
                    b => b.month === month && b.year === year
                );

                if (existingBalanceIndex === -1) {
                    // Create a balance entry if it doesn't exist
                    const newBalance = {
                        month,
                        year,
                        opening_balance: 0,
                        closing_balance: 0,
                        statement_page: 1,
                        highlight_coordinates: null,
                        is_verified: false,
                        verified_by: null,
                        verified_at: null
                    };

                    allMonthlyBalances.push(newBalance);
                    setMonthlyBalances(prev => [...prev, newBalance]);
                }
            }

            // Sort balances by date
            allMonthlyBalances.sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });

            // Create an array of promises for processing each month
            const processingPromises = monthsInRange
                // Skip the current statement's month
                .filter(({ month, year }) => !(month === statement.statement_month && year === statement.statement_year))
                .map(async ({ month, year }) => {
                    // Find the corresponding cycle
                    const monthStr = (month + 1).toString().padStart(2, '0');
                    const cycleMonthYear = `${year}-${monthStr}`;

                    const cycle = createdCycles.find(c => c.month_year === cycleMonthYear);
                    if (!cycle) {
                        console.warn(`No cycle found for ${month + 1}/${year}`);
                        return null;
                    }

                    // Find the balance for this specific month
                    const monthBalance = allMonthlyBalances.find(
                        b => b.month === month && b.year === year
                    );

                    if (!monthBalance) {
                        console.warn(`No balance found for ${month + 1}/${year}, skipping`);
                        return null;
                    }

                    // Check if a statement already exists
                    const { data: existingStatement, error: checkError } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('id')
                        .eq('bank_id', bank.id)
                        .eq('statement_month', month)
                        .eq('statement_year', year)
                        .maybeSingle();

                    if (checkError && checkError.code !== 'PGRST116') {
                        console.error(`Error checking existing statement for ${month + 1}/${year}:`, checkError);
                        return null;
                    }

                    // Create statement data with ALL monthly balances
                    const statementData = {
                        bank_id: bank.id,
                        company_id: bank.company_id,
                        statement_cycle_id: cycle.id,
                        statement_month: month,
                        statement_year: year,
                        statement_document: {
                            statement_pdf: statement.statement_document.statement_pdf,
                            statement_excel: statement.statement_document.statement_excel,
                            document_size: statement.statement_document.document_size
                        },
                        statement_extractions: {
                            bank_name: bankName,
                            account_number: accountNumber,
                            currency: currency,
                            statement_period: statementPeriod, // Same period for all statements
                            opening_balance: monthBalance.opening_balance,
                            closing_balance: monthBalance.closing_balance,
                            monthly_balances: allMonthlyBalances // Include ALL monthly balances
                        },
                        has_soft_copy: true,
                        has_hard_copy: false,
                        validation_status: {
                            is_validated: false,
                            validation_date: null,
                            validated_by: null,
                            mismatches: []
                        },
                        status: {
                            status: 'pending_validation',
                            assigned_to: null,
                            verification_date: null
                        }
                    };

                    if (existingStatement) {
                        // Update existing statement
                        console.log(`Updating existing statement for ${month + 1}/${year}`);
                        const { error: updateError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .update(statementData)
                            .eq('id', existingStatement.id);

                        if (updateError) {
                            console.error(`Error updating statement for ${month + 1}/${year}:`, updateError);
                            return { status: 'error', month, year, error: updateError };
                        } else {
                            console.log(`Updated statement for ${month + 1}/${year}`);
                            return { status: 'updated', month, year };
                        }
                    } else {
                        // Create new statement
                        console.log(`Creating new statement for ${month + 1}/${year}`);
                        const { error: insertError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .insert([statementData]);

                        if (insertError) {
                            console.error(`Error creating statement for ${month + 1}/${year}:`, insertError);
                            return { status: 'error', month, year, error: insertError };
                        } else {
                            console.log(`Created statement for ${month + 1}/${year}`);
                            return { status: 'created', month, year };
                        }
                    }
                });

            // Execute all promises in parallel
            const results = await Promise.all(processingPromises);

            // Count successes and failures
            const successes = results.filter(r => r && (r.status === 'updated' || r.status === 'created')).length;
            const failures = results.filter(r => r && r.status === 'error').length;

            toast({
                title: "Multi-month Processing Complete",
                description: `Successfully processed ${successes} months${failures > 0 ? `, with ${failures} errors` : ''}`,
                variant: failures > 0 ? "warning" : "default"
            });

            return true;
        } catch (error) {
            console.error('Error handling statement range data:', error);
            toast({
                title: "Error",
                description: "Failed to process multi-month statement data",
                variant: "destructive"
            });
            return false;
        }
    };


    // Helper function to format number with commas
const formatNumberWithCommas = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    
    // Convert to string if it's a number
    const stringValue = typeof value === 'number' ? value.toString() : value;
    
    // Handle decimal numbers
    const parts = stringValue.split('.');
    const wholePart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
    
    // Add commas to the whole part
    const formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return formattedWholePart + decimalPart;
};

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="w-[95vw] max-w-[1600px] max-h-[95vh] h-[95vh] p-6 flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-xl flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{bank.company_name}</span>
                            <div className="flex items-center gap-3 pr-16">
                                <div className="text-sm text-muted-foreground">
                                    Document Size : {documentSize > 0 ? formatFileSize(documentSize) : ''}
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteStatement}
                                    disabled={deleting}
                                    className="gap-1"
                                >
                                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                                    Delete Statement
                                </Button>
                            </div>
                        </div>
                        <div className="text-base">
                            Bank Statement - {bank.bank_name} {bank.account_number} | {format(new Date(statement.statement_year, statement.statement_month), 'MMMM yyyy')}
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">Statement Overview</TabsTrigger>
                        <TabsTrigger value="validation">Validation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex flex-col h-full space-y-2 overflow-hidden">
                            {/* Period navigation */}
                            {/* <div className="flex items-center justify-between bg-muted p-2 rounded-md shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={navigateToPreviousPeriod}
                                        disabled={currentPeriodIndex <= 0}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous Period
                                    </Button>

                                    <div className="flex flex-col items-center">
                                        <span className="text-sm font-medium">Statement Period</span>
                                        <div className="flex gap-1 items-center">
                                            <Select
                                                value={detectedPeriods.length > 0 ? `${detectedPeriods[currentPeriodIndex]?.month}-${detectedPeriods[currentPeriodIndex]?.year}` : ''}
                                                onValueChange={(value) => {
                                                    const [month, year] = value.split('-').map(Number);
                                                    const periodIndex = detectedPeriods.findIndex(
                                                        p => p.month === month && p.year === year
                                                    );
                                                    if (periodIndex >= 0) {
                                                        navigateToPeriod(periodIndex);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-[300px]">
                                                    <SelectValue placeholder={statementPeriod || "Select period"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {detectedPeriods.map((period, index) => (
                                                        <SelectItem key={index} value={`${period.month}-${period.year}`}>
                                                            {format(new Date(period.year, period.month, 1), 'MMMM yyyy')}
                                                            {period.lastDate && ` (${period.lastDate})`}
                                                            {isPeriodVerified(period.month, period.year) && ' ✓'}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Badge variant={isPeriodVerified(selectedMonth, selectedYear) ? "default" : "outline"}>
                                                {isPeriodVerified(selectedMonth, selectedYear) ? "Verified" : "Unverified"}
                                            </Badge>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={navigateToNextPeriod}
                                        disabled={currentPeriodIndex >= detectedPeriods.length - 1}
                                    >
                                        Next Period
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div> */}

                            {/* Main content area */}
                            <div className="grid grid-cols-5 gap-4 h-full overflow-hidden pt-2">
                                {/* PDF Viewer - 3 columns with scrollable container for all pages*/}
                                <div className="col-span-3 flex flex-col h-full overflow-hidden">
                                    <div
                                        ref={pdfContainerRef}
                                        className="border rounded bg-muted relative flex-1 overflow-hidden"
                                    >
                                        {loading ? (
                                            <div className="flex items-center justify-center h-full">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        ) : (
                                            <div className="h-full">
                                                <iframe
                                                    src={pdfUrl}
                                                    className="w-full h-full"
                                                    title="Bank Statement PDF"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right panel - Account details and monthly balances */}
                                <div className="col-span-2 flex flex-col h-full gap-4 overflow-hidden">
                                    {/* Account details card */}
                                    <Card className="shrink-0">
                                        <CardHeader className="py-2">
                                            <CardTitle className="text-base">Account Details</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="space-y-1">
                                                <Label htmlFor="bank-name">Bank Name</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id="bank-name"
                                                        value={bankName}
                                                        onChange={(e) => setBankName(e.target.value)}
                                                        placeholder="Enter bank name"
                                                        className={
                                                            bankName && !bankName.toLowerCase().includes(bank.bank_name.toLowerCase())
                                                                ? "border-yellow-500 focus-visible:ring-yellow-500"
                                                                : ""
                                                        }
                                                    />
                                                    {bankName && (
                                                        bankName.toLowerCase().includes(bank.bank_name.toLowerCase()) ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                                <Check className="h-3 w-3 mr-1" />
                                                                Match
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                                Mismatch
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <Label htmlFor="account-number">Account Number</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id="account-number"
                                                        value={accountNumber}
                                                        onChange={(e) => setAccountNumber(e.target.value)}
                                                        placeholder="Enter account number"
                                                        className={
                                                            accountNumber && !accountNumber.includes(bank.account_number)
                                                                ? "border-yellow-500 focus-visible:ring-yellow-500"
                                                                : ""
                                                        }
                                                    />
                                                    {accountNumber && (
                                                        accountNumber.includes(bank.account_number) ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                                <Check className="h-3 w-3 mr-1" />
                                                                Match
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                                Mismatch
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <Label htmlFor="currency">Currency</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id="currency"
                                                        value={currency}
                                                        onChange={(e) => setCurrency(e.target.value)}
                                                        placeholder="Enter currency"
                                                        className={
                                                            currency && normalizeCurrencyCode(currency) !== normalizeCurrencyCode(bank.bank_currency)
                                                                ? "border-yellow-500 focus-visible:ring-yellow-500"
                                                                : ""
                                                        }
                                                    />
                                                    {currency && (
                                                        normalizeCurrencyCode(currency) === normalizeCurrencyCode(bank.bank_currency) ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                                <Check className="h-3 w-3 mr-1" />
                                                                Match
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                                Mismatch
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <Label htmlFor="statement-period">Statement Period</Label>
                                                <Input
                                                    id="statement-period"
                                                    value={statementPeriod}
                                                    onChange={(e) => setStatementPeriod(e.target.value)}
                                                    placeholder="E.g., 01/01/2024 - 31/01/2024"
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Monthly balances section - Expanded to take the full space */}
                                    <Card className="flex-1 flex flex-col overflow-hidden min-h-[300px]">
                                        <CardHeader className="py-2 flex flex-row items-center justify-between shrink-0">
                                            <CardTitle className="text-base">Monthly Balances</CardTitle>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAddMonthlyBalance}
                                            >
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add Month
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="p-0 flex-1 overflow-auto">
                                            {monthlyBalances.length === 0 ? (
                                                <div className="flex items-center justify-center h-full text-center px-4">
                                                    <p className="text-muted-foreground">
                                                        No monthly balances added yet. Select text in the document to add balances
                                                        or click "Add Month" to add manually.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="h-full">
                                                    <Table>
                                                        <TableHeader className="sticky top-0 bg-white z-10">
                                                            <TableRow>
                                                                <TableHead className="w-[30%]">Period</TableHead>
                                                                <TableHead className="w-[45%]">Closing Balance</TableHead>
                                                                <TableHead className="w-[25%]">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {monthlyBalances.sort((a, b) => {
                                                                if (a.year !== b.year) return a.year - b.year;
                                                                return a.month - b.month;
                                                            }).map((balance, index) => {
                                                                const isCurrentPeriod = balance.month === selectedMonth && balance.year === selectedYear;

                                                                return (
                                                                    <TableRow
                                                                        key={`${balance.month}-${balance.year}`}
                                                                        className={isCurrentPeriod ? "bg-blue-50" : ""}
                                                                    >
                                                                        <TableCell className="font-medium whitespace-nowrap">
                                                                            {format(new Date(balance.year, balance.month, 1), 'MMM yyyy')}
                                                                            {balance.is_verified && (
                                                                                <CheckCircle className="h-3 w-3 inline ml-1 text-green-500" />
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Input
                                                                                type="text" // Changed from "number" to "text" to allow for formatting
                                                                                value={formatNumberWithCommas(balance.closing_balance || '')}
                                                                                onChange={(e) => {
                                                                                    // Parse value by removing commas before storing
                                                                                    const rawValue = e.target.value.replace(/,/g, '');
                                                                                    const numericValue = parseFloat(rawValue) || 0;
                                                                                    handleUpdateBalance(index, 'closing_balance', numericValue);
                                                                                }}
                                                                                className="w-full"
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="flex gap-1">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8"
                                                                                    onClick={() => {
                                                                                        // Navigate to the page
                                                                                        if (balance.statement_page) {
                                                                                            scrollToPage(balance.statement_page);
                                                                                        }
                                                                                        // Also set the selected month/year
                                                                                        setSelectedMonth(balance.month);
                                                                                        setSelectedYear(balance.year);
                                                                                    }}
                                                                                >
                                                                                    <Eye className="h-4 w-4" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8"
                                                                                    onClick={() => {
                                                                                        handleVerifyMonthlyBalance(index);
                                                                                    }}
                                                                                >
                                                                                    <CheckCircle className="h-4 w-4" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-red-500"
                                                                                    onClick={() => handleRemoveBalance(index)}
                                                                                >
                                                                                    <X className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Display QuickBooks reconciliation info when available */}
                                    {statement.quickbooks_balance !== null && getMonthlyClosingBalance() !== null && (
                                        <Card className="shrink-0">
                                            <CardHeader className="py-2 bg-gradient-to-r from-blue-50 to-blue-100">
                                                <CardTitle className="text-base flex items-center">
                                                    <Calculator className="h-4 w-4 mr-2 text-blue-600" />
                                                    QuickBooks Reconciliation
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3 p-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-3 bg-blue-50/50 rounded-md border border-blue-100">
                                                        <p className="text-sm text-blue-700 mb-1">Bank Statement</p>
                                                        <p className="font-medium text-lg">
                                                            {formatCurrency(getMonthlyClosingBalance(), bank.bank_currency)}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-green-50/50 rounded-md border border-green-100">
                                                        <p className="text-sm text-green-700 mb-1">QuickBooks</p>
                                                        <p className="font-medium text-lg">
                                                            {formatCurrency(statement.quickbooks_balance, bank.bank_currency)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className={`p-4 rounded-md border ${Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) <= 0.01
                                                        ? "bg-green-50/70 border-green-200"
                                                        : "bg-red-50/70 border-red-200"
                                                    }`}>
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center">
                                                            {Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) <= 0.01 ? (
                                                                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                                                            ) : (
                                                                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                                                            )}
                                                            <p className={`font-medium ${Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) <= 0.01
                                                                    ? "text-green-700"
                                                                    : "text-red-700"
                                                                }`}>
                                                                {Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) <= 0.01
                                                                    ? "Reconciled"
                                                                    : "Difference"}
                                                            </p>
                                                        </div>
                                                        <p className={`font-bold text-lg ${Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) <= 0.01
                                                                ? "text-green-700"
                                                                : "text-red-700"
                                                            }`}>
                                                            {formatCurrency(getMonthlyClosingBalance() - statement.quickbooks_balance, bank.bank_currency)}
                                                        </p>
                                                    </div>

                                                    {Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) > 0.01 && (
                                                        <p className="text-sm text-red-600 mt-2">
                                                            The bank statement balance doesn't match the QuickBooks balance.
                                                            Please reconcile the difference.
                                                        </p>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="validation" className="pt-0">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col h-full space-y-2 overflow-hidden">
                                <div className="px-4 rounded-md border bg-card">
                                    <h3 className="text-lg font-semibold flex items-center mb-4">
                                        <FileCheck className="h-5 w-5 text-primary mr-2" />
                                        Validation Status
                                    </h3>

                                    <div className="flex items-center mb-2">
                                        {statement.validation_status.is_validated ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-sm px-3 py-1">
                                                <Check className="h-3 w-3 mr-1" />
                                                Validated
                                            </Badge>
                                        ) : statement.validation_status.mismatches.length > 0 ? (
                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-sm px-3 py-1">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                Validation Issues
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 text-sm px-3 py-1">
                                                Not Validated
                                            </Badge>
                                        )}

                                        {statement.validation_status.validation_date && (
                                            <span className="text-sm text-muted-foreground ml-3">
                                                Last checked: {format(new Date(statement.validation_status.validation_date), 'PP')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="p-3 bg-gray-50 rounded-md">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-medium">Statement</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {statement.statement_month}/{statement.statement_year}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm">Period</span>
                                                <span className="text-sm font-medium">
                                                    {statement.statement_extractions.statement_period ||
                                                        format(new Date(statement.statement_year, statement.statement_month, 1), 'MMMM yyyy')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-md">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-medium">Document</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {statement.has_soft_copy ? 'Has Soft Copy' : 'No Soft Copy'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm">PDF Pages</span>
                                                <span className="text-sm font-medium">{totalPages || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {statement.validation_status.mismatches.length > 0 && (
                                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Validation Issues Found</AlertTitle>
                                        <AlertDescription>
                                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                                {statement.validation_status.mismatches.map((mismatch, index) => (
                                                    <li key={index}>{mismatch}</li>
                                                ))}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="border rounded-md overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-blue-50">
                                                <TableHead className="w-[200px]">Field</TableHead>
                                                <TableHead>Expected Value</TableHead>
                                                <TableHead>Extracted Value</TableHead>
                                                <TableHead className="w-[100px]">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell className="font-medium">Bank Name</TableCell>
                                                <TableCell>{bank.bank_name}</TableCell>
                                                <TableCell>{bankName || 'Not detected'}</TableCell>
                                                <TableCell>
                                                    <span className={
                                                        bankName &&
                                                            bankName.toLowerCase().includes(bank.bank_name.toLowerCase())
                                                            ? "text-green-500 font-medium"
                                                            : "text-red-500 font-medium"
                                                    }>
                                                        {bankName &&
                                                            bankName.toLowerCase().includes(bank.bank_name.toLowerCase())
                                                            ? "Match"
                                                            : "Mismatch"}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-medium">Account Number</TableCell>
                                                <TableCell>{bank.account_number}</TableCell>
                                                <TableCell>{accountNumber || 'Not detected'}</TableCell>
                                                <TableCell>
                                                    <span className={
                                                        accountNumber &&
                                                            accountNumber.includes(bank.account_number)
                                                            ? "text-green-500 font-medium"
                                                            : "text-red-500 font-medium"
                                                    }>
                                                        {accountNumber &&
                                                            accountNumber.includes(bank.account_number)
                                                            ? "Match"
                                                            : "Mismatch"}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-medium">Currency</TableCell>
                                                <TableCell>{bank.bank_currency}</TableCell>
                                                <TableCell>{currency || 'Not detected'}</TableCell>
                                                <TableCell>
                                                    <span className={
                                                        currency &&
                                                            normalizeCurrencyCode(currency) === normalizeCurrencyCode(bank.bank_currency)
                                                            ? "text-green-500 font-medium"
                                                            : "text-red-500 font-medium"
                                                    }>
                                                        {currency &&
                                                            normalizeCurrencyCode(currency) === normalizeCurrencyCode(bank.bank_currency)
                                                            ? "Match"
                                                            : "Mismatch"}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Card>
                                    <CardHeader className="py-3 bg-blue-50">
                                        <CardTitle className="text-base">Monthly Balances Summary</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader className="bg-gray-50">
                                                <TableRow>
                                                    <TableHead>Period</TableHead>
                                                    <TableHead>Closing Balance</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {monthlyBalances.length > 0 ? (
                                                    monthlyBalances.sort((a, b) => {
                                                        if (a.year !== b.year) return a.year - b.year;
                                                        return a.month - b.month;
                                                    }).map((balance, index) => (
                                                        <TableRow key={index} className={balance.month === statement.statement_month && balance.year === statement.statement_year ? "bg-blue-50" : ""}>
                                                            <TableCell>
                                                                {format(new Date(balance.year, balance.month, 1), 'MMMM yyyy')}
                                                                {balance.month === statement.statement_month && balance.year === statement.statement_year && (
                                                                    <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-500 border-blue-200">
                                                                        Current
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {formatCurrency(balance.closing_balance, currency || bank.bank_currency)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {balance.is_verified ? (
                                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                                        <Check className="h-3 w-3 mr-1" />
                                                                        Verified
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                                        Not Verified
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                                            No monthly balances added yet
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>

                                {/* QuickBooks reconciliation card */}
                                <Card>
                                    <CardHeader className="py-3 bg-blue-50">
                                        <CardTitle className="text-base">QuickBooks Reconciliation</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-4">
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-3 bg-gray-50 rounded-md">
                                                    <p className="text-sm text-muted-foreground mb-1">Bank Statement</p>
                                                    <p className="font-medium">
                                                        {getMonthlyClosingBalance() !== null
                                                            ? formatCurrency(getMonthlyClosingBalance(), bank.bank_currency)
                                                            : '-'}
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-gray-50 rounded-md">
                                                    <p className="text-sm text-muted-foreground mb-1">QuickBooks</p>
                                                    <p className="font-medium">
                                                        {statement.quickbooks_balance !== null
                                                            ? formatCurrency(statement.quickbooks_balance, bank.bank_currency)
                                                            : '-'}
                                                    </p>
                                                </div>
                                            </div>

                                            {statement.quickbooks_balance !== null && getMonthlyClosingBalance() !== null && (
                                                <div className="p-4 rounded-md border bg-white">
                                                    <p className="text-sm text-muted-foreground mb-1">Difference</p>
                                                    <p className={`font-bold ${Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) > 0.01
                                                        ? "text-red-500"
                                                        : "text-green-500"
                                                        }`}>
                                                        {formatCurrency(getMonthlyClosingBalance() - statement.quickbooks_balance, bank.bank_currency)}
                                                    </p>
                                                    {Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) > 0.01 ? (
                                                        <p className="text-sm text-red-500 mt-2">
                                                            Bank statement balance does not match QuickBooks. Reconciliation needed.
                                                        </p>
                                                    ) : (
                                                        <p className="text-sm text-green-500 mt-2">
                                                            Bank statement reconciled with QuickBooks successfully.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Statement</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this statement? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDeleteStatement}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={saving || deleting}
                        className="mr-auto"
                    >
                        Close
                    </Button>

                    <Button
                        variant="default"
                        onClick={handleSave}
                        disabled={saving || deleting}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}