// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export function PINProfileReports() {
    const [reports, setReports] = useState([]);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase
                .from('PINProfilesAndCertificates')
                .select('*')
                .order('company_name', { ascending: true });

            if (error) {
                throw new Error(`Error fetching reports: ${error.message}`);
            }

            // Process the data to extract the latest extraction for each company
            const processedData = data.map(company => {
                const extractions = company.extractions;
                const latestDate = Object.keys(extractions).sort((a, b) => new Date(b) - new Date(a))[0];
                const latestExtraction = extractions[latestDate];

                return {
                    id: company.id,
                    company_name: company.company_name,
                    company_pin: company.company_pin,
                    
                    extraction_date: latestDate
                };
            });

            setReports(processedData);
            if (processedData.length > 0) {
                setSelectedCompany(processedData[0]);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">PIN Profile Reports</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>KRA PIN</TableHead>
                        <TableHead>Extraction Date</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reports.map((report) => (
                        <TableRow key={report.id}>
                            <TableCell>{report.company_name}</TableCell>
                            <TableCell>{report.company_pin}</TableCell>
                            <TableCell>{new Date(report.extraction_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                                <Button
                                    onClick={() => window.open(report.pdf_link, '_blank')}
                                    disabled={!report.pdf_link}
                                >
                                    View PDF
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}