// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from '@/components/Spinner';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { supabase } from '@/lib/supabase';

import { usePathname } from 'next/navigation'
import { formatDateTime, getStatusColorClass } from '../lib/format.utils';

interface StartProps {
  activeTab?: string;
  setStatus: (status: string) => void;
  isChecking: boolean;
  setIsChecking: (isChecking: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export default function Start({
  activeTab = 'kra',
  setStatus,
  isChecking = false,
  setIsChecking,
  setActiveTab
}: StartProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [runOption, setRunOption] = useState('all');
  const [selectedChecker, setSelectedChecker] = useState('kra');
  const [automationProgress, setAutomationProgress] = useState(null);
  const [companies, setCompanies] = useState([]);
  const pathname = usePathname();

  const checkerOptions = [
    { value: 'kra', label: 'KRA' },
    { value: 'nssf', label: 'NSSF' },
    { value: 'nhif', label: 'NHIF' },
    { value: 'kebs', label: 'KEBS' },
    { value: 'quickbooks', label: 'QuickBooks' },
    { value: 'all', label: 'All Checkers' }
  ];

  const getColumnsForChecker = (checker: string) => {
    const commonColumns = [
      { key: 'select', label: 'Select', width: '50px' },
      { key: 'index', label: '#', width: '50px' },
      { key: 'company_name', label: 'Company Name', width: '200px' }
    ];

    const checkerColumns = {
      kra: [
        { key: 'kra_pin', label: 'KRA PIN', width: '120px' },
        { key: 'kra_password', label: 'KRA Password', width: '120px' },
        { key: 'kra_status', label: 'Status', width: '100px' }
      ],
      nssf: [
        { key: 'nssf_id', label: 'NSSF ID', width: '120px' },
        { key: 'nssf_code', label: 'NSSF Code', width: '120px' },
        { key: 'nssf_password', label: 'NSSF Password', width: '120px' },
        { key: 'nssf_status', label: 'Status', width: '100px' }
      ],
      nhif: [
        { key: 'nhif_id', label: 'NHIF ID', width: '120px' },
        { key: 'nhif_code', label: 'NHIF Code', width: '120px' },
        { key: 'nhif_password', label: 'NHIF Password', width: '120px' },
        { key: 'nhif_status', label: 'Status', width: '100px' }
      ],
      kebs: [
        { key: 'kebs_id', label: 'KEBS ID', width: '120px' },
        { key: 'kebs_password', label: 'KEBS Password', width: '120px' },
        { key: 'kebs_status', label: 'Status', width: '100px' }
      ],
      quickbooks: [
        { key: 'quickbooks_id', label: 'QuickBooks ID', width: '120px' },
        { key: 'quickbooks_password', label: 'QuickBooks Password', width: '120px' },
        { key: 'quickbooks_status', label: 'Status', width: '100px' }
      ],
      all: [
        { 
          key: 'kra',
          label: 'KRA',
          width: '100px',
          fields: ['kra_pin', 'kra_password', 'kra_status', 'kra_last_checked']
        },
        { 
          key: 'nssf',
          label: 'NSSF',
          width: '100px',
          fields: ['nssf_id', 'nssf_code', 'nssf_password', 'nssf_status', 'nssf_last_checked']
        },
        { 
          key: 'nhif',
          label: 'NHIF',
          width: '100px',
          fields: ['nhif_id', 'nhif_code', 'nhif_password', 'nhif_status', 'nhif_last_checked']
        },
        { 
          key: 'kebs',
          label: 'KEBS',
          width: '100px',
          fields: ['kebs_id', 'kebs_password', 'kebs_status', 'kebs_last_checked']
        },
        { 
          key: 'quickbooks',
          label: 'QB',
          width: '100px',
          fields: ['quickbooks_id', 'quickbooks_password', 'quickbooks_status', 'quickbooks_last_checked']
        }
      ]
    };

    return [...commonColumns, ...(checkerColumns[checker] || [])];
  };

  const fetchAutomationProgress = useCallback(async () => {
    if (!activeTab) return;

    try {
      const { data, error } = await supabase
        .from('PasswordChecker_AutomationProgress')
        .select('*')
        .eq('tab', activeTab)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching automation progress:', error);
        // Create initial record if none exists
        const { error: insertError } = await supabase
          .from('PasswordChecker_AutomationProgress')
          .upsert({
            progress: 0,
            status: 'Initial',
            logs: [],
            tab: activeTab,
            last_updated: new Date().toISOString()
          });

        if (!insertError) {
          setAutomationProgress({ status: 'Initial' });
          if (typeof setIsChecking === 'function') setIsChecking(false);
          if (typeof setStatus === 'function') setStatus('Initial');
        }
        return;
      }

      setAutomationProgress(data || { status: 'Initial' });
      if (data) {
        switch (data.status) {
          case 'Running':
            if (typeof setIsChecking === 'function') setIsChecking(true);
            if (typeof setStatus === 'function') setStatus('Running');
            break;
          case 'Stopped':
            if (typeof setIsChecking === 'function') setIsChecking(false);
            if (typeof setStatus === 'function') setStatus('Stopped');
            break;
          case 'Completed':
            if (typeof setIsChecking === 'function') setIsChecking(false);
            if (typeof setStatus === 'function') setStatus('Completed');
            break;
          default:
            if (typeof setIsChecking === 'function') setIsChecking(false);
            if (typeof setStatus === 'function') setStatus('Initial');
        }
      }
    } catch (error) {
      console.error('Error in fetchAutomationProgress:', error);
    }
  }, [activeTab, setIsChecking, setStatus]);

  const fetchCompanies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('acc_portal_company_duplicate')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching companies:', error);
        return;
      }

      if (data && Array.isArray(data)) {
        setCompanies(data);
      } else {
        console.error('No companies data or invalid format:', data);
        setCompanies([]);
      }
    } catch (error) {
      console.error('Error in fetchCompanies:', error);
      setCompanies([]);
    }
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      try {
        await fetchAutomationProgress();
        await fetchCompanies();
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };

    initializeData();
  }, [fetchAutomationProgress, fetchCompanies]);

  const handleCheckboxChange = useCallback((id: number) => {
    setSelectedCompanies(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const startCheck = async () => {
    if (!activeTab) {
      console.error('No active tab selected');
      alert('Please select a tab before starting the check.');
      return;
    }

    if (isChecking) {
      const shouldRestart = window.confirm('An automation is already running. Would you like to stop it and start a new one?');
      if (!shouldRestart) {
        return;
      }

      // Force stop the current automation
      try {
        const response = await fetch('/api/password-checker', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: "stop",
            tab: activeTab
          })
        });

        if (!response.ok) {
          throw new Error('Failed to stop current automation');
        }

        // Wait for the stop to take effect
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error stopping automation:', error);
        alert('Failed to stop current automation. Please try again.');
        return;
      }
    }

    if (runOption === 'selected' && selectedCompanies.length === 0) {
      alert('Please select at least one company to check.');
      return;
    }

    const currentTab = (activeTab || '').toLowerCase();
    let apiEndpoint = '';

    switch (currentTab) {
      case 'nssf':
        apiEndpoint = '/api/nssf-pass-checker';
        break;
      case 'nhif':
        apiEndpoint = '/api/nhif-pass-checker';
        break;
      case 'kra':
        apiEndpoint = '/api/password-checker';
        break;
      case 'ecitizen':
        apiEndpoint = '/api/ecitizen-pass-checker';
        break;
      default:
        console.error('Invalid tab selected:', activeTab);
        alert('Invalid tab selected');
        return;
    }

    try {
      // First, ensure automation is marked as running in Supabase
      const { error: progressError } = await supabase
        .from('PasswordChecker_AutomationProgress')
        .upsert({
          progress: 0,
          status: 'Running',
          logs: [],
          tab: activeTab,
          last_updated: new Date().toISOString()
        });

      if (progressError) {
        throw progressError;
      }

      // Then start the automation
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: "start",
          runOption,
          selectedIds: runOption === 'selected' ? selectedCompanies : [],
          tab: activeTab
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start automation');
      }

      if (typeof setIsChecking === 'function') setIsChecking(true);
      if (typeof setStatus === 'function') setStatus("Running");
      if (typeof setActiveTab === 'function') setActiveTab("running");

      // Fetch latest progress
      await fetchAutomationProgress();
    } catch (error) {
      console.error(`Error starting password check for ${activeTab}:`, error);
      // Reset the automation progress on error
      await supabase
        .from('PasswordChecker_AutomationProgress')
        .upsert({
          progress: 0,
          status: 'Stopped',
          logs: [],
          tab: activeTab,
          last_updated: new Date().toISOString()
        });
      alert('Failed to start password check. Please try again.');
    }
  };

  const resumeCheck = async () => {
    if (!activeTab) {
      console.error('No active tab selected');
      alert('Please select a tab before resuming the check.');
      return;
    }

    const currentTab = (activeTab || '').toLowerCase();
    let apiEndpoint = '';

    switch (currentTab) {
      case 'nssf':
        apiEndpoint = '/api/nssf-pass-checker';
        break;
      case 'nhif':
        apiEndpoint = '/api/nhif-pass-checker';
        break;
      case 'kra':
        apiEndpoint = '/api/password-checker';
        break;
      case 'ecitizen':
        apiEndpoint = '/api/ecitizen-pass-checker';
        break;
      default:
        console.error('Invalid tab selected:', activeTab);
        alert('Invalid tab selected');
        return;
    }

    try {
      // Update automation progress before resuming
      const { error: progressError } = await supabase
        .from('PasswordChecker_AutomationProgress')
        .upsert({
          status: 'Running',
          tab: activeTab,
          last_updated: new Date().toISOString()
        });

      if (progressError) {
        throw progressError;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: "resume",
          runOption,
          selectedIds: runOption === 'selected' ? selectedCompanies : [],
          tab: activeTab
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to resume automation');
      }

      if (typeof setIsChecking === 'function') setIsChecking(true);
      if (typeof setStatus === 'function') setStatus("Running");
      if (typeof setActiveTab === 'function') setActiveTab("running");

      await fetchAutomationProgress();
    } catch (error) {
      console.error('Error resuming automation:', error);
      // Reset automation progress on error
      await supabase
        .from('PasswordChecker_AutomationProgress')
        .upsert({
          status: 'Stopped',
          tab: activeTab,
          last_updated: new Date().toISOString()
        });
      alert('Failed to resume automation. Please try again.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start Password Check</CardTitle>
        <CardDescription>Begin the password validation process for companies.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block mb-2">Run for:</label>
            <Select value={selectedChecker} onValueChange={(value) => setSelectedChecker(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select checker" />
              </SelectTrigger>
              <SelectContent>
                {checkerOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block mb-2">Run option:</label>
            <Select value={runOption} onValueChange={(value) => setRunOption(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select run option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="selected">Selected Companies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {runOption === 'selected' && (
          <div className="flex">
            <motion.div
              className="pr-2"
              initial={{ width: "100%" }}
              animate={{ width: selectedCompanies.length > 0 ? "50%" : "100%" }}
              transition={{ duration: 0.3 }}
            >
              <div className="max-h-[580px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {getColumnsForChecker(selectedChecker).map(column => (
                        <TableHead
                          key={column.key}
                          className={`${column.width ? `w-[${column.width}]` : ''} sticky top-0 bg-white ${column.key === 'company_name' ? 'min-w-[200px]' : ''}`}
                        >
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company, index) => (
                      <TableRow key={company.id}>
                        {getColumnsForChecker(selectedChecker).map(column => {
                          if (column.key === 'select') {
                            return (
                              <TableCell key={column.key} className={`w-[${column.width}]`}>
                                <Checkbox
                                  checked={selectedCompanies.includes(company.id)}
                                  onCheckedChange={() => handleCheckboxChange(company.id)}
                                />
                              </TableCell>
                            );
                          }
                          if (column.key === 'index') {
                            return (
                              <TableCell key={column.key} className={`w-[${column.width}] text-center`}>
                                {index + 1}
                              </TableCell>
                            );
                          }
                          if (column.key === 'company_name') {
                            return (
                              <TableCell key={column.key} className="min-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis">
                                {company[column.key]}
                              </TableCell>
                            );
                          }
                          if (selectedChecker === 'all' && column.fields) {
                            const status = company[`${column.key}_status`]?.toLowerCase();
                            const identifier = company[`${column.key}_pin`] || company[`${column.key}_id`] || 'N/A';
                            const tooltipContent = column.fields.map(field => {
                              let value = company[field] || 'N/A';
                              const label = field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                              
                              // Format status with color
                              if (field.endsWith('_status')) {
                                const status = value.toLowerCase();
                                value = `<span class="${getStatusColorClass(status)}">${value}</span>`;
                              }
                              
                              // Format last checked date
                              if (field.endsWith('_last_checked') && value !== 'N/A') {
                                value = formatDateTime(value);
                              }
                              
                              return `<div class="flex justify-between gap-4"><span class="font-medium">${label}:</span><span>${value}</span></div>`;
                            }).join('');

                            const textColorClass = getStatusColorClass(status);

                            return (
                              <TableCell key={column.key} className={`w-[${column.width}] text-center`}>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className={`${textColorClass} cursor-pointer`}>
                                        {identifier}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-white border border-gray-200 shadow-lg p-3 rounded-lg min-w-[300px]">
                                      <div 
                                        className="text-sm text-gray-700 space-y-2"
                                        dangerouslySetInnerHTML={{ __html: tooltipContent }}
                                      />
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            );
                          } else if (column.key.endsWith('_status')) {
                            const status = company[column.key]?.toLowerCase();
                            const textColorClass = getStatusColorClass(status);
                            
                            return (
                              <TableCell key={column.key} className={`w-[${column.width}] text-center`}>
                                <span className={textColorClass}>
                                  {company[column.key] || 'Pending'}
                                </span>
                              </TableCell>
                            );
                          }
                          const value = company[column.key];
                          return (
                            <TableCell key={column.key} className={`w-[${column.width}] text-center`}>
                              {column.key.endsWith('_last_checked') ? (
                                value ? formatDateTime(value) : <span className="text-red-500 font-medium">Missing</span>
                              ) : column.key.endsWith('_status') ? (
                                <span className={getStatusColorClass(value)}>{value || 'Pending'}</span>
                              ) : (
                                value || <span className="text-red-500 font-medium">Missing</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
            {selectedCompanies.length > 0 && (
              <motion.div
                className="pl-2"
                initial={{ width: "0%", opacity: 0 }}
                animate={{ width: "50%", opacity: 1 }}
                exit={{ width: "0%", opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Selected Companies ({selectedCompanies.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {getColumnsForChecker(selectedChecker)
                              .filter(column => column.key !== 'select')
                              .map(column => (
                                <TableHead 
                                  key={column.key}
                                  className={`${column.width ? `w-[${column.width}]` : ''} sticky top-0 bg-white ${column.key === 'company_name' ? 'min-w-[200px]' : ''}`}
                                >
                                  {column.label}
                                </TableHead>
                              ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companies
                            .filter(company => selectedCompanies.includes(company.id))
                            .map((company, index) => (
                              <TableRow key={company.id} className="hover:bg-blue-50">
                                {getColumnsForChecker(selectedChecker)
                                  .filter(column => column.key !== 'select')
                                  .map(column => {
                                    if (column.key === 'index') {
                                      return (
                                        <TableCell key={column.key} className="w-[50px] text-center">
                                          {index + 1}
                                        </TableCell>
                                      );
                                    }
                                    if (column.key === 'company_name') {
                                      return (
                                        <TableCell key={column.key} className="min-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis">
                                          {company[column.key]}
                                        </TableCell>
                                      );
                                    }
                                    if (selectedChecker === 'all' && column.fields) {
                                      const status = company[`${column.key}_status`]?.toLowerCase();
                                      const identifier = company[`${column.key}_pin`] || company[`${column.key}_id`] || 'N/A';
                                      const tooltipContent = column.fields.map(field => {
                                        let value = company[field] || 'N/A';
                                        const label = field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                        
                                        // Format status with color
                                        if (field.endsWith('_status')) {
                                          value = `<span class="${getStatusColorClass(value)}">${value}</span>`;
                                        }
                                        
                                        // Format last checked date
                                        if (field.endsWith('_last_checked') && value !== 'N/A') {
                                          value = formatDateTime(value);
                                        }
                                        
                                        return `<div class="flex justify-between gap-4"><span class="font-medium">${label}:</span><span>${value}</span></div>`;
                                      }).join('');

                                      const textColorClass = getStatusColorClass(status);

                                      return (
                                        <TableCell key={column.key} className={`w-[${column.width}] text-center`}>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <span className={`${textColorClass} cursor-pointer`}>
                                                  {identifier}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent className="bg-white border border-gray-200 shadow-lg p-3 rounded-lg min-w-[300px]">
                                                <div 
                                                  className="text-sm text-gray-700 space-y-2"
                                                  dangerouslySetInnerHTML={{ __html: tooltipContent }}
                                                />
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </TableCell>
                                      );
                                    } else if (column.key.endsWith('_status')) {
                                      const status = company[column.key]?.toLowerCase();
                                      const textColorClass = getStatusColorClass(status);
                                      
                                      return (
                                        <TableCell key={column.key} className={`w-[${column.width}] text-center`}>
                                          <span className={textColorClass}>
                                            {company[column.key] || 'Pending'}
                                          </span>
                                        </TableCell>
                                      );
                                    }
                                    return (
                                      <TableCell key={column.key} className={`w-[${column.width}] text-center`}>
                                        {column.key.endsWith('_last_checked') && company[column.key] ? (
                                          formatDateTime(company[column.key])
                                        ) : (
                                          company[column.key] || <span className="text-red-500 font-medium">Missing</span>
                                        )}
                                      </TableCell>
                                    );
                                  })}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                      <div className="flex justify-end space-x-2">
                        <Button
                          onClick={automationProgress?.status === 'Stopped' ? resumeCheck : startCheck}
                          disabled={isChecking && automationProgress?.status !== 'Stopped'}
                          className={automationProgress?.status === 'Completed' ? 'bg-green-500 text-white' : ''}
                        >
                          {isChecking ? 'Running...' :
                            automationProgress?.status === 'Stopped' ? 'Resume' :
                            automationProgress?.status === 'Completed' ? 'Start New Check' :
                            'Start Password Check'}
                        </Button>
                        <Button 
                          onClick={() => { setStatus("Stopped"); }} 
                          disabled={!isChecking} 
                          variant="destructive"
                        >
                          Stop Password Check
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
      {runOption === 'all' && (
        <CardFooter className="flex justify-end space-x-2">
          <Button
            onClick={automationProgress?.status === 'Stopped' ? resumeCheck : startCheck}
            disabled={isChecking && automationProgress?.status !== 'Stopped'}
            className={automationProgress?.status === 'Completed' ? 'bg-green-500 text-white' : ''}
          >
            {isChecking ? 'Running...' :
              automationProgress?.status === 'Stopped' ? 'Resume' :
              automationProgress?.status === 'Completed' ? 'Start New Check' :
              'Start Password Check'}
          </Button>
          <Button 
            onClick={() => { setStatus("Stopped"); }} 
            disabled={!isChecking} 
            variant="destructive"
          >
            Stop Password Check
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}