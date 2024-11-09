// @ts-nocheck
"use client"



import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Share2, AlertCircle, Download, Search, ArrowUpDown, Send } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, addDays } from "date-fns";
import { toast, Toaster } from 'react-hot-toast';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function ClientFileManagement() {
  const [clients, setClients] = useState([]);
  const [checklist, setChecklist] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    dataType: 'all',
    sheetType: 'single',
    includeReminders: false
  });

  const fetchData = async () => {
    try {
      const [clientsResult, checklistResult] = await Promise.all([
        supabase
          .from('PasswordChecker')
          .select('id, company_name, kra_pin')
          .order('id'),
        supabase
          .from('checklist')
          .select('*')
      ]);
  
      if (clientsResult.error) {
        throw new Error(`Error fetching clients: ${clientsResult.error.message}`);
      }
  
      if (checklistResult.error) {
        throw new Error(`Error fetching checklist: ${checklistResult.error.message}`);
      }
  
      setClients(clientsResult.data);
  
      const checklistMap = {};
      checklistResult.data.forEach(item => {
        checklistMap[item.company_name] = {
          ...item,
          file_management: item.file_management || {}
        };
      });
      setChecklist(checklistMap);
  
      toast.success('Data fetched successfully');
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(error.message);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const RefreshButton = () => {
    const handleRefresh = () => {
      fetchClients();
      fetchChecklist();
      toast.success('Data refreshed');
    };

    return (
      <Button size="sm" onClick={handleRefresh}>
        <RefreshCcw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    );
  };

  const sendReminder = async (companyName) => {
    // Implement reminder sending logic here
    console.log(`Sending reminder to ${companyName}`);
    toast.success(`Reminder sent to ${companyName}`);
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();

    const getData = () => {
      if (exportOptions.dataType === 'all') return filteredClients;
      return filteredClients.filter(client => {
        const year = selectedDate.getFullYear();
        const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
        return !checklist[client.company_name]?.[year]?.[month]?.receivedAt;
      });
    };

    const data = getData();

    if (exportOptions.sheetType === 'single') {
      const sheet = workbook.addWorksheet('Clients');
      sheet.addRow(['Company Name', 'KRA PIN', 'Files Received', 'Files Delivered', 'Reminders Sent']);
      data.forEach(client => {
        const year = selectedDate.getFullYear();
        const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
        const clientData = checklist[client.company_name]?.[year]?.[month];
        sheet.addRow([
          client.company_name,
          client.kra_pin,
          clientData?.receivedAt ? 'Yes' : 'No',
          clientData?.filesDelivered ? 'Yes' : 'No',
          exportOptions.includeReminders ? (clientData?.remindersSent || 0) : 'N/A'
        ]);
      });
    } else {
      data.forEach(client => {
        const sheet = workbook.addWorksheet(client.company_name);
        sheet.addRow(['Month', 'Files Received', 'Files Delivered', 'Reminders Sent']);
        const year = selectedDate.getFullYear();
        for (let month = 1; month <= 12; month++) {
          const monthKey = month.toString().padStart(2, '0');
          const clientData = checklist[client.company_name]?.[year]?.[monthKey];
          sheet.addRow([
            monthKey,
            clientData?.receivedAt ? 'Yes' : 'No',
            clientData?.filesDelivered ? 'Yes' : 'No',
            exportOptions.includeReminders ? (clientData?.remindersSent || 0) : 'N/A'
          ]);
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'client_data.xlsx');
    setExportDialogOpen(false);
    toast.success('Excel file exported successfully');
  };

  const ExportDialog = () => (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={() => setExportDialogOpen(true)}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Data to Export</label>
            <Select
              value={exportOptions.dataType}
              onValueChange={(value) => setExportOptions(prev => ({ ...prev, dataType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="missing">Clients with Missing Files</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Sheet Type</label>
            <Select
              value={exportOptions.sheetType}
              onValueChange={(value) => setExportOptions(prev => ({ ...prev, sheetType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sheet type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Sheet</SelectItem>
                <SelectItem value="multiple">Separate Sheets per Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeReminders"
              checked={exportOptions.includeReminders}
              onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeReminders: checked }))}
            />
            <label htmlFor="includeReminders" className="text-sm font-medium text-gray-700">
              Include Reminder Messages
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={exportToExcel}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedClients = [...clients].sort((a, b) => {
    if (sortColumn) {
      const aValue = a[sortColumn].toLowerCase();
      const bValue = b[sortColumn].toLowerCase();
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    return 0;
  });

  const filteredClients = sortedClients.filter(client =>
    client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.kra_pin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ConfirmDocumentDialog = ({ companyName, year, month, kraPin, onConfirm }) => {
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState('');

    const handleConfirm = () => {
      onConfirm({ receivedAt: `${date.toISOString().split('T')[0]} ${time}` }, kraPin);
    };

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <XCircle className="h-4 w-4 text-red-500" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Document Receipt - {companyName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <DatePicker date={date} setDate={setDate} />
            <TimePicker value={time} onChange={setTime} />
            <Button onClick={handleConfirm}>Confirm Receipt</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const updateClientStatus = async (companyName, year, month, status, kraPin) => {
    const updatedFileManagement = {
      ...checklist[companyName]?.file_management,
      [year]: {
        ...checklist[companyName]?.file_management?.[year],
        [month]: {
          ...checklist[companyName]?.file_management?.[year]?.[month],
          ...status,
          filesDelivered: status.filesDelivered !== undefined ? status.filesDelivered : checklist[companyName]?.file_management?.[year]?.[month]?.filesDelivered
        }
      }
    };
  
    try {
      const { data, error } = await supabase
        .from('checklist')
        .upsert({
          company_name: companyName,
          file_management: updatedFileManagement,
          kra_pin: kraPin
        }, { onConflict: 'company_name' });
  
      if (error) {
        throw new Error(`Error updating client status: ${error.message}`);
      }
  
      setChecklist(prevChecklist => ({
        ...prevChecklist,
        [companyName]: {
          ...prevChecklist[companyName],
          file_management: updatedFileManagement,
          kra_pin: kraPin
        }
      }));
  
      toast.success('Client status updated successfully');
    } catch (error) {
      console.error('Error updating client status:', error);
      toast.error(error.message);
    }
  };


  const MonthlyTable = () => {
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');

    const getStatusCounts = () => {
      const received = filteredClients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.receivedAt).length;
      const delivered = filteredClients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.filesDelivered).length;
      return { received, delivered, pending: filteredClients.length - received, notDelivered: filteredClients.length - delivered };
    };

    const counts = getStatusCounts();

    return (
      <ScrollArea className="h-[600px]">
        {/* <Table>
          <TableHeader>
            <TableRow className='bg-gray-600 font-bold'>
              <TableHead className="font-bold text-white">Index</TableHead>
              <TableHead className="cursor-pointer font-bold text-white" onClick={() => handleSort('company_name')}>
                Company Name {sortColumn === 'company_name' && <ArrowUpDown className="inline h-4 w-4" />}
              </TableHead>
              <TableHead className="cursor-pointer font-bold text-white" onClick={() => handleSort('kra_pin')}>
                KRA PIN {sortColumn === 'kra_pin' && <ArrowUpDown className="inline h-4 w-4" />}
              </TableHead>
              <TableHead className="font-bold text-white text-center ">
                Files Received
                <div className="flex items-center space-x-1 mt-1 justify-center">
                  <span className="bg-green-500 text-white rounded-full px-1 py-0.5 text-xxs w-5 h-5 flex items-center justify-center">{counts.received}</span>
                  <span className="bg-red-500 text-white rounded-full px-1 py-0.5 text-xxs w-5 h-5 flex items-center justify-center">{counts.pending}</span>
                </div>
              </TableHead>
              <TableHead className="font-bold text-white text-center">
                Files Delivered
                <div className="flex items-center space-x-2 mt-1 justify-center">
                  <span className="bg-green-500 text-white rounded-full px-2 py-1 text-xs">{counts.delivered}</span>
                  <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">{counts.notDelivered}</span>
                </div>
              </TableHead>
              <TableHead className="font-bold text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.map((client, index) => {
              const clientData = checklist[client.company_name]?.file_management?.[year]?.[month];
              return (
                <TableRow key={client.company_name} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{client.company_name}</TableCell>
                  <TableCell>{client.kra_pin}</TableCell>
                  <TableCell className="text-center">
                    {clientData?.receivedAt ? (
                      <div className="text-xs text-gray-500">
                        {new Date(clientData.receivedAt).toLocaleString()}
                        <CheckCircle className="h-3 w-3 text-green-500 ml-2 inline" />
                      </div>
                    ) : (
                      <ConfirmDocumentDialog
                        companyName={client.company_name}
                        year={year}
                        month={month}
                        kraPin={client.kra_pin}
                        onConfirm={(status, kraPin) => updateClientStatus(client.company_name, year, month, status, kraPin)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateClientStatus(
                        client.company_name,
                        year,
                        month,
                        {
                          filesDelivered: !clientData?.filesDelivered,
                          deliveredAt: new Date().toISOString()
                        },
                        client.kra_pin
                      )}
                    >
                      {clientData?.filesDelivered ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => sendReminder(client.company_name)}>
                      <Send className="h-3 w-3 mr-1" />
                      Remind
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table> */}
      </ScrollArea>
    );
  };
  
  const DetailedView = () => {
    const [selectedCompany, setSelectedCompany] = useState(null);
    const year = selectedDate.getFullYear();
    const currentMonth = new Date().getMonth();
    const monthsToShow = 6;
  
    return (
      <div className="flex">
        <div className="w-1/6 pr-4">
          <h2 className="text-xl font-bold mb-4">Companies</h2>
          <ScrollArea className="h-[500px]">
            <ul className="space-y-2">
              {filteredClients.map((client, index) => (
                <li
                  key={client.company_name}
                  className={`cursor-pointer p-2 rounded ${selectedCompany === client.company_name ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                  onClick={() => setSelectedCompany(client.company_name)}
                >
                  {index + 1}. {client.company_name}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
        <div className="w-5/6">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Delivered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCompany && Array.from({ length: monthsToShow }, (_, i) => currentMonth - i).reverse().map((month, index) => {
                  const monthKey = (month + 1).toString().padStart(2, '0');
                  const clientData = checklist[selectedCompany]?.file_management?.[year]?.[monthKey];
                  return (
                    <TableRow key={month}>
                      <TableCell>{index + 1}. {format(new Date(year, month), 'MMMM yyyy')}</TableCell>
                      <TableCell>
                        {clientData?.receivedAt ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        {clientData?.filesDelivered ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>
    );
  };


  useEffect(() => {
    const scrollContainer = document.querySelector('.overflow-x-auto');
    if (scrollContainer) {
      const scrollWidth = scrollContainer.scrollWidth;
      const clientWidth = scrollContainer.clientWidth;
      const scrollTo = scrollWidth - clientWidth;

      scrollContainer.scrollTo({
        left: scrollTo,
        behavior: 'smooth'
      });
    }
  }, []);


  const AllDataView = () => {
    const year = selectedDate.getFullYear();
    const currentMonth = new Date().getMonth();
    const startMonth = 6; // July is the 7th month (0-indexed)
    const monthsToShow = currentMonth - startMonth + 1;

    const getStatusCounts = (clients, year, month) => {
      const received = clients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.receivedAt).length;
      const delivered = clients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.filesDelivered).length;
      return { received, delivered, pending: clients.length - received, notDelivered: clients.length - delivered };
    };

    return (
      <ScrollArea className="h-[600px]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-white">Company</TableHead>
                {Array.from({ length: monthsToShow }, (_, i) => startMonth + i).map(month => (
                  <TableHead key={month} colSpan={2} className="text-center">
                    {format(new Date(year, month), 'MMMM yyyy')}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-white">Status</TableHead>
                {Array.from({ length: monthsToShow }, (_, i) => startMonth + i).map(month => (
                  <React.Fragment key={month}>
                    <TableHead>Received</TableHead>
                    <TableHead>Delivered</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-white">Counts</TableHead>
                {Array.from({ length: monthsToShow }, (_, i) => {
                  const month = (startMonth + i + 1).toString().padStart(2, '0');
                  const counts = getStatusCounts(filteredClients, year, month);
                  return (
                    <React.Fragment key={i}>
                      <TableHead>
                        <div className="flex items-center space-x-2">
                          <span className="bg-green-500 text-white rounded-full px-2 py-1 text-xs">{counts.received}</span>
                          <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">{counts.pending}</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center space-x-2">
                          <span className="bg-green-500 text-white rounded-full px-2 py-1 text-xs">{counts.delivered}</span>
                          <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">{counts.notDelivered}</span>
                        </div>
                      </TableHead>
                    </React.Fragment>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client, index) => (
                <TableRow key={client.company_name}>
                  <TableCell className="sticky left-0 z-10 bg-inherit">{client.company_name}</TableCell>
                  {Array.from({ length: monthsToShow }, (_, i) => startMonth + i).map(month => {
                    const monthKey = (month + 1).toString().padStart(2, '0');
                    const clientData = checklist[client.company_name]?.file_management?.[year]?.[monthKey];
                    return (
                      <React.Fragment key={month}>
                        <TableCell>
                          {clientData?.receivedAt ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {clientData?.filesDelivered ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <Toaster position="top-right" />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Client File Management</h1>
      </div>
      <div className="flex space-x-4 items-end">
        <div className="flex-grow">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Search Clients</label>
          <div className="flex space-x-2">
            <Input
              id="search"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-1/6"
            />
          </div>
        </div>
        <ExportDialog />
      </div>
      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">Monthly View</TabsTrigger>
          <TabsTrigger value="detailed">Detailed View</TabsTrigger>
          <TabsTrigger value="allData">All Data</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly">
          <MonthlyTable />
        </TabsContent>
        <TabsContent value="detailed">
          <DetailedView />
        </TabsContent>
        <TabsContent value="allData">
          <AllDataView />
        </TabsContent>
      </Tabs>
    </div>
  );
}