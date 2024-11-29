// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Download, FileIcon, FolderIcon, Loader2 } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import Papa from 'papaparse';

interface FileViewerProps {
    url: string;
    fileType: 'excel' | 'csv' | 'pdf' | 'zip' | 'xlsx' | 'xls';
    title: string;
    pdfLink?: string;
    dataLink?: string;
}
const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-500 animate-pulse">Loading document...</p>
    </div>
);

const handleDownload = async (url: string, title: string) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = downloadUrl;
        link.download = title;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download file. Please try again.');
    }
};

const ExcelViewer = ({ url }: { url: string }) => {
    const [data, setData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchExcelData = async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const arrayBuffer = await response.arrayBuffer();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(arrayBuffer);
                const worksheet = workbook.getWorksheet(1);
                const rows = worksheet.getRows(1, worksheet.rowCount);
                setData(rows.map(row => row.values.slice(1)));
            } catch (e) {
                console.error("Error processing Excel file:", e);
                setError(`Error loading Excel file: ${e}`);
            }
        };

        fetchExcelData();
    }, [url]);

    if (loading) return <LoadingSpinner />;
    if (error) return <div>Error: {error}</div>;

    return (
        <table className="min-w-full bg-white">
            <thead>
                <tr>
                    {data[0]?.map((header: any, index: number) => (
                        <th key={index} className="px-4 py-2 border">{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.map((cell: any, cellIndex: number) => (
                            <td key={cellIndex} className="px-4 py-2 border">{cell?.toString() || ''}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const ZipViewer = ({ url }: { url: string }) => {
    const [files, setFiles] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchZipContent = async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const arrayBuffer = await response.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                const fileList = Object.keys(zip.files).map(filename => ({
                    name: filename,
                    dir: zip.files[filename].dir,
                    size: zip.files[filename]._data.uncompressedSize
                }));
                setFiles(fileList);
            } catch (e) {
                console.error("Error processing ZIP file:", e);
                setError(`Error loading ZIP file: ${e}`);
            } finally {
                setLoading(false);
            }
        };

        fetchZipContent();
    }, [url]);

    if (loading) return <div>Loading ZIP contents...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">ZIP Contents:</h3>
            <ul className="space-y-2">
                {files.map((file, index) => (
                    <li key={index} className="flex items-center">
                        {file.dir ? (
                            <FolderIcon className="mr-2 h-5 w-5 text-yellow-500" />
                        ) : (
                            <FileIcon className="mr-2 h-5 w-5 text-blue-500" />
                        )}
                        <span>{file.name}</span>
                        {!file.dir && <span className="ml-2 text-sm text-gray-500">({file.size} bytes)</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
};
const CsvViewer = ({ url }: { url: string }) => {
    const [data, setData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCsvData = async () => {
            try {
                const response = await fetch(url);
                const text = await response.text();
                Papa.parse(text, {
                    complete: (results) => {
                        setData(results.data);
                    },
                    header: true,
                    skipEmptyLines: true
                });
            } catch (e) {
                console.error("Error processing CSV file:", e);
                setError(`Error loading CSV file: ${e}`);
            }
        };

        fetchCsvData();
    }, [url]);

    if (error) return <div>Error: {error}</div>;
    if (loading) return <LoadingSpinner />;

    const headers = Object.keys(data[0] || {});

    return (
        <table className="min-w-full bg-white">
            <thead>
                <tr>
                    {headers.map((header, index) => (
                        <th key={index} className="px-4 py-2 border">{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {headers.map((header, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 border">
                                {row[header]?.toString() || ''}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};



const getFileExtension = (url: string): string | null => {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const basename = pathname.split('/').pop();
        if (basename) {
            return basename.split('.').pop()?.toLowerCase() || null;
        }
    } catch (e) {
        console.error("Invalid URL:", url);
    }
    return null;
};

const FileViewer: React.FC<FileViewerProps> = ({ url, title }) => {
    if (!url) {
        return (
            <div className="flex justify-center">
                <span className="text-red-500 text-sm font-bold text-center">Missing</span>
            </div>
        );
    }

    const fileType = getFileExtension(url) as FileViewerProps['fileType'] | null | undefined;
    const [isLoading, setIsLoading] = useState(true);
    const [copySuccess, setCopySuccess] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 1000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    };


    const renderContent = () => {
        if (!fileType) return <div>Unsupported file type</div>;

        switch (fileType) {
            case 'xlsx':
            case 'xls':
                return <ExcelViewer url={url} />;
            case 'zip':
                return <ZipViewer url={url} />;
            case 'csv':
                return <CsvViewer url={url} />;
            case 'pdf':
                return (
                    <iframe
                        src={`${url}#toolbar=1`}
                            className="w-full h-full border-none"
                            title={title}
                            onLoad={() => setIsLoading(false)}
                    />
                );
            default:
                return <div>Unsupported file type: {fileType}</div>;
        }
    };


    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    View
                </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-7xl ">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <p className="text-sm text-blue-500 mt-2 break-words"> 
                        {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">
                                {url}
                            </a>
                        )}
                    </p>
                </DialogHeader>
                <div className="flex-1 w-full h-[calc(90vh-8rem)] overflow-auto relative">
                    {isLoading && <LoadingSpinner />}
                    {/* <div className={isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}> */}
                        {renderContent()}
                    {/* </div> */}
                    {/* {fileType === 'pdf' && (
                        <iframe
                            src={`${url}#toolbar=1`}
                            className="w-full h-full border-none"
                            title={title}
                            onLoad={() => setIsLoading(false)}
                        />
                    )} */}
                </div>

                <DialogFooter>
                    <Button onClick={() => handleDownload(url, title)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FileViewer;
