// @ts-nocheck
import React from 'react';
import { TableRow, TableCell } from "@/components/ui/table";

const TotalsRow = ({ totals }) => (
    <>
        {[
            { label: 'Total', bgColor: 'bg-blue-100', counts: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.total])) },
            { label: 'Registered', bgColor: 'bg-green-100', counts: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.registered])) },
            { label: 'To Be Registered', bgColor: 'bg-yellow-100', counts: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.toBeRegistered || 0])) },
            { label: 'No Obligation', bgColor: 'bg-amber-100', counts: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.missing])) },
            { label: 'Cancelled', bgColor: 'bg-red-100', counts: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.cancelled])) },
            { label: 'Dormant', bgColor: 'bg-blue-100', counts: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.dormant])) }
        ].map(row => (
            <TableRow key={row.label} className={`${row.bgColor} border-b`} style={{ height: '10px' }}>
                <TableCell colSpan={2} className="font-bold uppercase px-1 col-span-2" style={{ height: '10px', fontSize: '10px' }}>{row.label}</TableCell>

                {Object.entries(row.counts).map(([tax, count], index) => (
                    <TableCell key={tax} className={`text-center px-1 ${tax === 'resident_individual' ? 'border-r-2 border-black' : ''}`} style={{ height: '10px', fontSize: '10px' }}>
                        {count}
                    </TableCell>
                ))}
                <TableCell className="font-bold uppercase px-1 col-span-2" style={{ height: '10px', fontSize: '10px' }}>{row.label}</TableCell>
            </TableRow>
        ))}
    </>
);

export default TotalsRow;
