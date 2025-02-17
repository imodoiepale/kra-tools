// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Download, FileIcon, Eye, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as XLSX from 'xlsx'
// import { parseDocx } from 'docx-preview'
import JSZip from 'jszip'
import Papa from 'papaparse'

interface DocumentViewerProps {
    url: string;
    isOpen: boolean;
    onClose: () => void;
    title: string;
    companyName: string;
}

export function DocumentViewer({ url, isOpen, onClose, title, companyName }: DocumentViewerProps) {
    const [documentUrl, setDocumentUrl] = useState<string>('')
    const [fileType, setFileType] = useState<string>('')
    const [fileContent, setFileContent] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const getFileType = (url: string): string => {
        const extension = url.split('.').pop()?.toLowerCase() || '';
        return extension;
    }

    const fetchAndProcessFile = async (url: string) => {
        try {
            setLoading(true)
            const response = await fetch(url)
            const blob = await response.blob()
            const fileType = getFileType(url)

            switch (fileType) {
                case 'xlsx':
                case 'xls': {
                    const arrayBuffer = await blob.arrayBuffer()
                    const workbook = XLSX.read(arrayBuffer)
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
                    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
                    setFileContent(data)
                    break
                }
                case 'csv': {
                    const text = await blob.text()
                    Papa.parse(text, {
                        complete: (result) => {
                            // Ensure we have both headers and data
                            if (result.data && result.data.length > 0) {
                                setFileContent(result.data)
                            }
                        },
                        header: false, // We'll handle headers manually
                        skipEmptyLines: true
                    })
                    break
                }
                // case 'docx': {
                //     const container = document.createElement('div')
                //     await parseDocx(blob, container)
                //     setFileContent(container.innerHTML)
                //     break
                // }
                case 'zip': {
                    const zip = new JSZip()
                    const contents = await zip.loadAsync(blob)
                    const files = Object.keys(contents.files)
                    setFileContent(files)
                    break
                }
                default:
                    setFileContent(null)
            }
        } catch (error) {
            console.error('Error processing file:', error)
            setFileContent(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const fetchDocumentUrl = async () => {
            try {
                const { data: { publicUrl }, error } = await supabase.storage
                    .from('Payroll-Cycle')
                    .getPublicUrl(url)

                if (error) {
                    console.error('Error getting public URL:', error)
                    return
                }

                setDocumentUrl(publicUrl)
                const type = getFileType(url)
                setFileType(type)
                
                if (['xlsx', 'xls', 'csv', 'docx', 'zip'].includes(type)) {
                    await fetchAndProcessFile(publicUrl)
                }
            } catch (error) {
                console.error('Error in fetchDocumentUrl:', error)
            }
        }

        if (url && isOpen) {
            fetchDocumentUrl()
        } else {
            setFileContent(null)
            setDocumentUrl('')
        }
    }, [url, isOpen])

    const renderSpreadsheetData = (data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <p className="text-gray-600">No data to display</p>
                </div>
            )
        }

        // Get headers from first row
        const headers = data[0]
        // Get actual data rows (skip header row)
        const rows = data.slice(1)

        return (
            <div className="overflow-auto max-h-full p-4">
                <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed">
                        <thead className="bg-gray-50">
                            <tr>
                                {headers.map((header: string, index: number) => (
                                    <th 
                                        key={index} 
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                                        style={{ minWidth: '150px' }}
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {rows.map((row: any[], rowIndex: number) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    {row.map((cell: any, cellIndex: number) => (
                                        <td 
                                            key={cellIndex} 
                                            className="px-6 py-4 text-sm text-gray-900 truncate"
                                            title={cell?.toString() || ''}
                                        >
                                            {cell?.toString() || ''}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4">
                    <Button 
                        onClick={() => window.open(documentUrl, '_blank')}
                        className="flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Download Full File
                    </Button>
                </div>
            </div>
        )
    }

    const renderZipContents = (files: string[]) => {
        return (
            <div className="p-4">
                <h3 className="text-lg font-medium mb-4">ZIP Contents:</h3>
                <ul className="space-y-2">
                    {files.map((file, index) => (
                        <li key={index} className="flex items-center gap-2">
                            <File className="w-4 h-4" />
                            <span>{file}</span>
                        </li>
                    ))}
                </ul>
                <Button 
                    onClick={() => window.open(documentUrl, '_blank')}
                    className="mt-4 flex items-center gap-2"
                >
                    <Download className="w-4 h-4" />
                    Download ZIP Archive
                </Button>
            </div>
        )
    }

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="ml-2">Loading document...</p>
                </div>
            )
        }

        switch (fileType) {
            case 'pdf':
                return (
                    <iframe 
                        src={`${documentUrl}#view=FitH`}
                        className="w-full h-full border-0"
                        title={title}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                    
                )
            case 'xlsx':
            case 'xls':
            case 'csv':
                return fileContent ? renderSpreadsheetData(fileContent) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <FileIcon className="w-16 h-16 text-gray-400" />
                        <p className="text-gray-600">Error loading spreadsheet</p>
                        <Button 
                            onClick={() => window.open(documentUrl, '_blank')}
                            className="flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download File
                        </Button>
                    </div>
                )
            case 'docx':
                return fileContent ? (
                    <div 
                        className="p-4 overflow-auto h-full docx-viewer"
                        dangerouslySetInnerHTML={{ __html: fileContent }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <FileIcon className="w-16 h-16 text-gray-400" />
                        <p className="text-gray-600">Error loading document</p>
                        <Button 
                            onClick={() => window.open(documentUrl, '_blank')}
                            className="flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download File
                        </Button>
                    </div>
                )
            case 'zip':
                return fileContent ? renderZipContents(fileContent) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <FileIcon className="w-16 h-16 text-gray-400" />
                        <p className="text-gray-600">ZIP Archive</p>
                        <Button 
                            onClick={() => window.open(documentUrl, '_blank')}
                            className="flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download ZIP Archive
                        </Button>
                    </div>
                )
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <FileIcon className="w-16 h-16 text-gray-400" />
                        <p className="text-gray-600">Unknown file type</p>
                        <Button 
                            onClick={() => window.open(documentUrl, '_blank')}
                            className="flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download File
                        </Button>
                    </div>
                )
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[80vw] h-[90vh] p-0 overflow-hidden rounded-lg">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="text-lg font-semibold text-gray-900">{companyName}</DialogTitle>
                    <p className="mt-1 text-sm text-gray-500">{title}</p>
                </DialogHeader>
                <div className="relative w-full h-[calc(90vh-4rem)]">
                    {renderContent()}
                </div>
            </DialogContent>
        </Dialog>
    )
}
