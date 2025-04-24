// @ts-nocheck
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, AlertTriangle, Plus, Calendar, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export function StatementCycleConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    statementPeriod,
    existingCycles,
    newCyclesToCreate,
    banks,
    files
}) {
    const [selectedCycles, setSelectedCycles] = useState([]);
    const [selectAll, setSelectAll] = useState(true);

    // Initialize selected cycles with all cycles
    useEffect(() => {
        if (isOpen) {
            const allCycles = [...existingCycles, ...newCyclesToCreate];
            setSelectedCycles(allCycles.map(cycle => cycle.id || cycle.month_year));
            setSelectAll(true);
            
            // Log detected cycles for debugging
            console.log("StatementCycleConfirmationDialog - Existing cycles:", existingCycles);
            console.log("StatementCycleConfirmationDialog - New cycles:", newCyclesToCreate);
            console.log("StatementCycleConfirmationDialog - Files:", files);
        }
    }, [isOpen, existingCycles, newCyclesToCreate]);

    const toggleCycle = (cycleId) => {
        setSelectedCycles(prev => {
            if (prev.includes(cycleId)) {
                return prev.filter(id => id !== cycleId);
            } else {
                return [...prev, cycleId];
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedCycles([]);
        } else {
            const allCycles = [...existingCycles, ...newCyclesToCreate];
            setSelectedCycles(allCycles.map(cycle => cycle.id || cycle.month_year));
        }
        setSelectAll(!selectAll);
    };

    const formatMonthYear = (monthYearStr) => {
        // Parse "YYYY-MM" format
        const [year, month] = monthYearStr.split('-').map(Number);
        return format(new Date(year, month - 1), 'MMMM yyyy');
    };

    const handleConfirm = () => {
        onConfirm(selectedCycles);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Enhanced summary display in the dialog header */}
                <DialogHeader>
                    <DialogTitle className="text-xl">Confirm Statement Cycles</DialogTitle>
                    <DialogDescription className="space-y-2">
                        <p>
                            Based on the statement periods <span className="font-medium">{statementPeriod}</span>, the following statement cycles are detected:
                        </p>
                        <div className="mt-2 space-y-1">
                            <div className="text-sm font-medium">Files being processed:</div>
                            <ul className="text-sm list-disc pl-5">
                                {files.map((file, index) => (
                                    <li key={index}>
                                        {file.name} 
                                        {file.period && <span className="text-muted-foreground ml-1">({file.period})</span>}
                                        {file.matchedBank && <span className="text-blue-600 ml-1">- {file.matchedBank.bank_name}</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto py-4 space-y-4">
                    {/* Summary Information */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-1 text-blue-700">
                                <Calendar className="h-4 w-4" />
                                <span className="font-medium">Total Cycles</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-800">
                                {existingCycles.length + newCyclesToCreate.length}
                            </div>
                            <div className="text-sm text-blue-600 mt-1">
                                For period {statementPeriod}
                            </div>
                        </div>

                        <div className="bg-green-50 border border-green-100 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-1 text-green-700">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="font-medium">Existing Cycles</span>
                            </div>
                            <div className="text-2xl font-bold text-green-800">
                                {existingCycles.length}
                            </div>
                            <div className="text-sm text-green-600 mt-1">
                                {existingCycles.length > 0 ? 'Will use existing cycles' : 'No existing cycles found'}
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-1 text-amber-700">
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">New Cycles</span>
                            </div>
                            <div className="text-2xl font-bold text-amber-800">
                                {newCyclesToCreate.length}
                            </div>
                            <div className="text-sm text-amber-600 mt-1">
                                {newCyclesToCreate.length > 0 ? 'Will be created automatically' : 'No new cycles needed'}
                            </div>
                        </div>
                    </div>

                    {/* Table of statement files */}
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>File Name</TableHead>
                                    <TableHead>Bank</TableHead>
                                    <TableHead>Period</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {files.map((file, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{file.name}</TableCell>
                                        <TableCell>
                                            {file.matchedBank ? file.matchedBank.bank_name : 'Unknown'}
                                        </TableCell>
                                        <TableCell>{statementPeriod}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Alert for new cycles */}
                    {newCyclesToCreate.length > 0 && (
                        <Alert variant="warning" className="bg-amber-50 border-amber-200">
                            <AlertTriangle className="h-4 w-4 text-amber-700" />
                            <AlertTitle className="text-amber-800">New Cycles Will Be Created</AlertTitle>
                            <AlertDescription className="text-amber-700">
                                {newCyclesToCreate.length} new statement cycles will be created automatically based on the detected period range.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Cycles selection table */}
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={selectAll}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Select all cycles"
                                        />
                                    </TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Existing cycles */}
                                {existingCycles.map((cycle) => (
                                    <TableRow key={cycle.id || cycle.month_year}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedCycles.includes(cycle.id || cycle.month_year)}
                                                onCheckedChange={() => toggleCycle(cycle.id || cycle.month_year)}
                                                aria-label={`Select ${cycle.month_year}`}
                                            />
                                        </TableCell>
                                        <TableCell>{formatMonthYear(cycle.month_year)}</TableCell>
                                        <TableCell>
                                            <Badge className="bg-green-100 text-green-800 border-green-200">
                                                Existing
                                            </Badge>
                                        </TableCell>
                                        <TableCell>Will use existing cycle</TableCell>
                                    </TableRow>
                                ))}

                                {/* New cycles to create */}
                                {newCyclesToCreate.map((cycle) => (
                                    <TableRow key={cycle.month_year}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedCycles.includes(cycle.month_year)}
                                                onCheckedChange={() => toggleCycle(cycle.month_year)}
                                                aria-label={`Select ${cycle.month_year}`}
                                            />
                                        </TableCell>
                                        <TableCell>{formatMonthYear(cycle.month_year)}</TableCell>
                                        <TableCell>
                                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                                New
                                            </Badge>
                                        </TableCell>
                                        <TableCell>Will create new cycle</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={selectedCycles.length === 0}>
                        Confirm and Process ({selectedCycles.length} cycles)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}