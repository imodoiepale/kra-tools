// @ts-nocheck
// app/payroll/bank-statements/utils/exportUtils.ts
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase } from '@/lib/supabase';

interface ExportStatement {
  id: string;
  bank_id: number;
  statement_month: number;
  statement_year: number;
  statement_type: 'monthly' | 'range';
  statement_document: {
    statement_pdf: string | null;
    statement_excel: string | null;
    password: string | null;
  };
  statement_extractions?: {
    statement_period?: string;
    monthly_balances?: any[];
  };
}

interface Bank {
  id: number;
  bank_name: string;
  account_number: string;
  bank_currency: string;
  company_id: number;
  acc_password?: string;
}

interface Company {
  id: number;
  company_name: string;
}

// Helper function to get month abbreviation
const getMonthAbbr = (month: number): string => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return months[month] || 'UNK';
};

// Helper function to parse statement period for range detection
const parseStatementPeriod = (period: string) => {
  if (!period) return null;
  
  // Common patterns for date ranges
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{1,2})-(\d{1,2})-(\d{4})\s*[-–—]\s*(\d{1,2})-(\d{1,2})-(\d{4})/,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{4})\s*[-–—]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{4})/i,
  ];
  
  for (const pattern of patterns) {
    const match = period.match(pattern);
    if (match) {
      try {
        if (match.length === 7) { // DD/MM/YYYY format
          return {
            startMonth: parseInt(match[2]) - 1, // Convert to 0-indexed
            startYear: parseInt(match[3]),
            endMonth: parseInt(match[5]) - 1,
            endYear: parseInt(match[6])
          };
        } else if (match.length === 5) { // Month name format
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                             'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const startMonth = monthNames.indexOf(match[1].toLowerCase().substring(0, 3));
          const endMonth = monthNames.indexOf(match[3].toLowerCase().substring(0, 3));
          
          if (startMonth !== -1 && endMonth !== -1) {
            return {
              startMonth,
              startYear: parseInt(match[2]),
              endMonth,
              endYear: parseInt(match[4])
            };
          }
        }
      } catch (error) {
        console.warn('Error parsing period:', error);
      }
    }
  }
  
  return null;
};

// Function to deduplicate statements based on file paths
const deduplicateStatements = (statements: ExportStatement[]): ExportStatement[] => {
  const seen = new Set<string>();
  const deduplicated: ExportStatement[] = [];
  
  for (const statement of statements) {
    // Create a unique key based on the file paths
    const pdfPath = statement.statement_document.statement_pdf;
    const excelPath = statement.statement_document.statement_excel;
    const uniqueKey = `${pdfPath || 'no-pdf'}_${excelPath || 'no-excel'}`;
    
    // If we haven't seen this file combination before, add it
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      deduplicated.push(statement);
      
      console.log(`✅ Added statement: ${statement.statement_type} for ${statement.statement_month + 1}/${statement.statement_year}`);
    } else {
      console.log(`⚠️  Skipped duplicate: ${statement.statement_type} for ${statement.statement_month + 1}/${statement.statement_year} (same files as previous)`);
    }
  }
  
  console.log(`Deduplication summary: ${statements.length} selected → ${deduplicated.length} unique files`);
  return deduplicated;
};

export const generateFileName = (
  statement: ExportStatement,
  company: Company,
  bank: Bank,
  options: {
    includePassword: boolean;
  }
): string => {
  const companyPart = company.company_name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bankPart = bank.bank_name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const accountPart = bank.account_number.replace(/[^0-9]/g, '');
  const currencyPart = bank.bank_currency.toUpperCase();
  
  let periodPart: string;
  
  if (statement.statement_type === 'range') {
    // Try to parse the actual range from statement_period
    const parsedPeriod = parseStatementPeriod(statement.statement_extractions?.statement_period || '');
    
    if (parsedPeriod) {
      const startMonth = getMonthAbbr(parsedPeriod.startMonth);
      const endMonth = getMonthAbbr(parsedPeriod.endMonth);
      
      if (parsedPeriod.startYear === parsedPeriod.endYear) {
        // Same year: JUL-FEB.2024 (handles cross-year ranges within same calendar year)
        periodPart = `${startMonth}-${endMonth}.${parsedPeriod.startYear}`;
      } else {
        // Different years: JUL.2024-FEB.2025
        periodPart = `${startMonth}.${parsedPeriod.startYear}-${endMonth}.${parsedPeriod.endYear}`;
      }
    } else {
      // Fallback if we can't parse the period
      const monthAbbr = getMonthAbbr(statement.statement_month);
      periodPart = `${monthAbbr}.${statement.statement_year}-RANGE`;
    }
  } else {
    // Monthly statement: JAN.2024
    const monthAbbr = getMonthAbbr(statement.statement_month);
    periodPart = `${monthAbbr}.${statement.statement_year}`;
  }
  
  const passwordPart = options.includePassword && (statement.statement_document.password || bank.acc_password)
    ? `-PW${(statement.statement_document.password || bank.acc_password)?.toUpperCase()}`
    : '';

  return `${companyPart}-${bankPart}-${accountPart}-${currencyPart}-${periodPart}${passwordPart}`;
};

// Helper function to get signed URL from Supabase storage
const getSignedUrl = async (path: string): Promise<string> => {
  try {
    // If it's already a full URL, return as is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // If it's a blob URL, return as is
    if (path.startsWith('blob:')) {
      return path;
    }

    // Generate signed URL from Supabase storage
    const { data, error } = await supabase.storage
      .from('Statement-Cycle')
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error);
      throw new Error(`Failed to create signed URL for ${path}: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error(`No signed URL returned for ${path}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error in getSignedUrl:', error);
    throw error;
  }
};

export const downloadFile = async (path: string, filename: string): Promise<Blob> => {
  try {
    // Get the proper URL for downloading
    const url = await getSignedUrl(path);
    
    console.log(`Downloading file: ${filename} from URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.blob();
  } catch (error) {
    console.error(`Error downloading file ${filename}:`, error);
    throw new Error(`Failed to download ${filename}: ${error.message}`);
  }
};

// Enhanced analysis function with deduplication detection
export const analyzeStatementsForExport = (statements: ExportStatement[]) => {
  const monthly = statements.filter(s => s.statement_type === 'monthly');
  const range = statements.filter(s => s.statement_type === 'range');
  
  // Check for duplicates in range statements
  const rangeByFile = new Map<string, ExportStatement[]>();
  range.forEach(stmt => {
    const fileKey = `${stmt.statement_document.statement_pdf || 'no-pdf'}_${stmt.statement_document.statement_excel || 'no-excel'}`;
    if (!rangeByFile.has(fileKey)) {
      rangeByFile.set(fileKey, []);
    }
    rangeByFile.get(fileKey)!.push(stmt);
  });
  
  const duplicateRangeGroups = Array.from(rangeByFile.values()).filter(group => group.length > 1);
  const uniqueFiles = deduplicateStatements(statements).length;
  
  console.log(`Export analysis: ${monthly.length} monthly, ${range.length} range statements`);
  if (duplicateRangeGroups.length > 0) {
    console.log(`Found ${duplicateRangeGroups.length} range statement groups with shared files:`);
    duplicateRangeGroups.forEach((group, index) => {
      const months = group.map(s => `${s.statement_month + 1}/${s.statement_year}`).join(', ');
      const period = group[0].statement_extractions?.statement_period || 'Unknown period';
      console.log(`  Group ${index + 1}: Months ${months} share period "${period}"`);
    });
  }
  
  // Show some example filenames
  const examples = statements.slice(0, 3).map(s => ({
    type: s.statement_type,
    originalMonth: s.statement_month + 1, // Convert to 1-based for display
    originalYear: s.statement_year,
    period: s.statement_extractions?.statement_period
  }));
  
  console.log('Example statements for export:', examples);
  
  return {
    monthly,
    range,
    total: statements.length,
    hasRange: range.length > 0,
    hasMonthly: monthly.length > 0,
    duplicateRangeGroups,
    uniqueFiles,
    examples
  };
};

export const createZipExport = async (
  statements: ExportStatement[],
  company: Company,
  bank: Bank,
  options: {
    autoZip: boolean;
    includePassword: boolean;
    renameFiles: boolean;
  }
): Promise<void> => {
  const zip = new JSZip();
  const downloadPromises: Promise<void>[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Analyze and deduplicate statements
  const analysis = analyzeStatementsForExport(statements);
  const uniqueStatements = deduplicateStatements(statements);
  
  console.log(`Starting ZIP export for ${statements.length} selected statements → ${uniqueStatements.length} unique files`);
  console.log(`Breakdown: ${analysis.monthly.length} monthly, ${analysis.range.length} range (${analysis.duplicateRangeGroups.length} shared range groups)`);

  for (const statement of uniqueStatements) {
    let baseFileName: string;
    
    if (options.renameFiles) {
      // For range statements that cover multiple months, create a descriptive name
      if (statement.statement_type === 'range' && statement.statement_extractions?.statement_period) {
        const parsedPeriod = parseStatementPeriod(statement.statement_extractions.statement_period);
        if (parsedPeriod && (parsedPeriod.startMonth !== parsedPeriod.endMonth || parsedPeriod.startYear !== parsedPeriod.endYear)) {
          // This is a multi-month range, use the parsed period for naming
          baseFileName = generateFileName(statement, company, bank, { 
            includePassword: options.includePassword 
          });
        } else {
          // Single month or couldn't parse, use standard naming
          baseFileName = generateFileName(statement, company, bank, { 
            includePassword: options.includePassword 
          });
        }
      } else {
        baseFileName = generateFileName(statement, company, bank, { 
          includePassword: options.includePassword 
        });
      }
    } else {
      baseFileName = `statement_${statement.id}`;
    }

    console.log(`Processing ${statement.statement_type} statement: ${baseFileName}`);

    // Add PDF if available
    if (statement.statement_document.statement_pdf) {
      downloadPromises.push(
        downloadFile(statement.statement_document.statement_pdf, `${baseFileName}.pdf`)
          .then(blob => {
            zip.file(`${baseFileName}.pdf`, blob);
            successCount++;
            console.log(`✅ Added PDF to ZIP: ${baseFileName}.pdf`);
          })
          .catch(error => {
            errorCount++;
            console.error(`❌ Failed to download PDF for ${statement.id}:`, error);
            // Add error file to ZIP for debugging
            zip.file(`ERROR_${baseFileName}.txt`, `Failed to download PDF: ${error.message}\nStatement Type: ${statement.statement_type}\nOriginal Path: ${statement.statement_document.statement_pdf}`);
          })
      );
    }

    // Add Excel if available
    if (statement.statement_document.statement_excel) {
      downloadPromises.push(
        downloadFile(statement.statement_document.statement_excel, `${baseFileName}.xlsx`)
          .then(blob => {
            zip.file(`${baseFileName}.xlsx`, blob);
            successCount++;
            console.log(`✅ Added Excel to ZIP: ${baseFileName}.xlsx`);
          })
          .catch(error => {
            errorCount++;
            console.error(`❌ Failed to download Excel for ${statement.id}:`, error);
            // Add error file to ZIP for debugging
            zip.file(`ERROR_${baseFileName}_Excel.txt`, `Failed to download Excel: ${error.message}\nStatement Type: ${statement.statement_type}\nOriginal Path: ${statement.statement_document.statement_excel}`);
          })
      );
    }
  }

  // Wait for all downloads to complete
  console.log(`Waiting for ${downloadPromises.length} download promises to complete...`);
  await Promise.allSettled(downloadPromises);

  console.log(`Download summary: ${successCount} successful, ${errorCount} errors`);

  // Generate and download ZIP
  try {
    console.log('Generating ZIP file...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const timestamp = new Date().toISOString().slice(0, 10);
    const zipFileName = `${company.company_name.replace(/[^a-zA-Z0-9]/g, '')}_${bank.bank_name.replace(/[^a-zA-Z0-9]/g, '')}_statements_${timestamp}.zip`;
    
    console.log(`Downloading ZIP file: ${zipFileName}`);
    saveAs(zipBlob, zipFileName);
    
    if (errorCount > 0) {
      console.warn(`ZIP export completed with ${errorCount} errors. Check error files in the ZIP for details.`);
    }
  } catch (error) {
    console.error('Error generating ZIP file:', error);
    throw new Error(`Failed to generate ZIP file: ${error.message}`);
  }
};

export const downloadIndividualFiles = async (
  statements: ExportStatement[],
  company: Company,
  bank: Bank,
  options: {
    includePassword: boolean;
    renameFiles: boolean;
  }
): Promise<void> => {
  let successCount = 0;
  let errorCount = 0;
  
  // Analyze and deduplicate statements
  const analysis = analyzeStatementsForExport(statements);
  const uniqueStatements = deduplicateStatements(statements);
  
  console.log(`Starting individual downloads for ${statements.length} selected statements → ${uniqueStatements.length} unique files`);
  console.log(`Breakdown: ${analysis.monthly.length} monthly, ${analysis.range.length} range (${analysis.duplicateRangeGroups.length} shared range groups)`);

  for (const statement of uniqueStatements) {
    const baseFileName = options.renameFiles 
      ? generateFileName(statement, company, bank, { includePassword: options.includePassword })
      : `statement_${statement.id}`;

    console.log(`Processing ${statement.statement_type} statement: ${baseFileName}`);

    try {
      // Download PDF if available
      if (statement.statement_document.statement_pdf) {
        try {
          console.log(`Downloading PDF: ${baseFileName}.pdf`);
          const pdfBlob = await downloadFile(
            statement.statement_document.statement_pdf, 
            `${baseFileName}.pdf`
          );
          saveAs(pdfBlob, `${baseFileName}.pdf`);
          successCount++;
          console.log(`✅ Downloaded PDF: ${baseFileName}.pdf`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to download PDF for statement ${statement.id} (${statement.statement_type}):`, error);
        }
      }

      // Download Excel if available
      if (statement.statement_document.statement_excel) {
        try {
          console.log(`Downloading Excel: ${baseFileName}.xlsx`);
          const excelBlob = await downloadFile(
            statement.statement_document.statement_excel, 
            `${baseFileName}.xlsx`
          );
          saveAs(excelBlob, `${baseFileName}.xlsx`);
          successCount++;
          console.log(`✅ Downloaded Excel: ${baseFileName}.xlsx`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to download Excel for statement ${statement.id} (${statement.statement_type}):`, error);
        }
      }

      // Add a small delay between downloads to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to download files for statement ${statement.id} (${statement.statement_type}):`, error);
    }
  }

  console.log(`Individual downloads summary: ${successCount} successful, ${errorCount} errors`);
  console.log(`Processed ${uniqueStatements.length} unique files from ${statements.length} selected statements`);
  
  if (errorCount > 0) {
    throw new Error(`Some downloads failed: ${errorCount} errors occurred during download of ${uniqueStatements.length} unique files`);
  }
};