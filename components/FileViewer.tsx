
// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { FileIcon, FolderIcon,Download  } from 'lucide-react';

import Papa from 'papaparse';



const handleDownload = async () => {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = title;
    document.body.appendChild(link);
    link.click();
    link.remove();
};

const ZipViewer = ({ url }) => {
    const [files, setFiles] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchZipContent = async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                const fileList = Object.keys(zip.files).map(filename => ({
                    name: filename,
                    dir: zip.files[filename].dir,
                    size: zip.files[filename]._data.uncompressedSize
                }));
                setFiles(fileList);
            } catch (e) {
                console.error("Error fetching or processing ZIP file:", e);
                setError(`Error loading ZIP file: ${e.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchZipContent();
    }, [url]);

    if (loading) {
        return <div>Loading ZIP contents...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

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

const ExcelViewer = ({ url }) => {
    const [data, setData] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchExcelData = async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(arrayBuffer);
                const worksheet = workbook.getWorksheet(1);
                const rows = worksheet.getRows(1, worksheet.rowCount);
                setData(rows.map(row => row.values.slice(1)));
            } catch (e) {
                console.error("Error fetching or processing Excel file:", e);
                setError(`Error loading Excel file: ${e.message}`);
            }
        };

        fetchExcelData();
    }, [url]);

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (data.length === 0) {
        return <div>Loading...</div>;
    }

    return (
        <table className="min-w-full bg-white">
            <thead>
                <tr>
                    {data[0].map((header, index) => (
                        <th key={index} className="px-4 py-2 border">{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 border">{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};


const CsvViewer = ({ url }) => {
    const [data, setData] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCsvData = async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const workbook = new ExcelJS.Workbook();
                await workbook.csv.load(arrayBuffer);
                const worksheet = workbook.getWorksheet(1);
                const rows = worksheet.getRows(1, worksheet.rowCount);
                setData(rows.map(row => row.values.slice(1)));
            } catch (e) {
                console.error("Error fetching or processing CSV file:", e);
                setError(`Error loading CSV file: ${e.message}`);
            }
        };

        fetchCsvData();
    }, [url]);

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (data.length === 0) {
        return <div>Loading...</div>;
    }

    return (
        <table className="min-w-full bg-white">
            <thead>
                <tr>
                    {data[0].map((header, index) => (
                        <th key={index} className="px-4 py-2 border">{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 border">{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const FileViewer = ({ url, fileType, title }) => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    View
                </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="w-full h-[80vh] overflow-auto">
                    {(fileType === 'excel' || fileType === 'xls' || fileType === 'xlsx') && <ExcelViewer url={url} />}
                    {fileType === 'zip' && <ZipViewer url={url} />}
                    {fileType === 'csv' && <CsvViewer url={url} />}
                </div>
                <DialogFooter>
                    <Button onClick={handleDownload }>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FileViewer;
