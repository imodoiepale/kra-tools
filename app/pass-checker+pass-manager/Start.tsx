// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from '@/lib/supabase';

import { usePathname } from 'next/navigation'

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
  const [automationProgress, setAutomationProgress] = useState(null);
  const [companies, setCompanies] = useState([]);
  const pathname = usePathname();

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
        .from('PasswordChecker')
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
        <div className="mb-4">
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
                      <TableHead className="w-[50px] sticky top-0 bg-white">Select</TableHead>
                      <TableHead className="w-[50px] sticky top-0 bg-white">#</TableHead>
                      <TableHead className="min-w-[200px] sticky top-0 bg-white">Company Name</TableHead>
                      <TableHead className="w-[120px] sticky top-0 bg-white">KRA PIN</TableHead>
                      <TableHead className="w-[120px] sticky top-0 bg-white">KRA Password</TableHead>
                      <TableHead className="w-[100px] sticky top-0 bg-white text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company, index) => (
                      <TableRow key={company.id}>
                        <TableCell className="w-[50px]">
                          <Checkbox
                            checked={selectedCompanies.includes(company.id)}
                            onCheckedChange={() => handleCheckboxChange(company.id)}
                          />
                        </TableCell>
                        <TableCell className="w-[50px] text-center">{index + 1}</TableCell>
                        <TableCell className="min-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis">
                          {company.company_name}
                        </TableCell>
                        <TableCell className="w-[120px] font-mono">{company.kra_pin}</TableCell>
                        <TableCell className="w-[120px] font-mono">{company.kra_password}</TableCell>
                        <TableCell className="w-[100px] text-center">
                          <span className={`${company.status?.toLowerCase() === 'valid' ? 'bg-green-500' :
                              company.status?.toLowerCase() === 'invalid' ? 'bg-red-500' :
                                'bg-yellow-500'
                            } text-white px-2 py-1 rounded whitespace-nowrap text-sm`}>
                            {company.status || 'Pending'}
                          </span>
                        </TableCell>
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
                transition={{ duration: 0.3 }}
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">Selected Companies ({selectedCompanies.length})</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead className="min-w-[200px]">Company Name</TableHead>
                        <TableHead className="w-[120px]">KRA PIN</TableHead>
                        <TableHead className="w-[120px]">KRA Password</TableHead>
                        <TableHead className="w-[100px] text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies
                        .filter(company => selectedCompanies.includes(company.id))
                        .map((company, index) => (
                          <TableRow key={company.id} className="bg-blue-100">
                            <TableCell className="w-[50px] text-center">{index + 1}</TableCell>
                            <TableCell className="min-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis">
                              {company.company_name}
                            </TableCell>
                            <TableCell className="w-[120px] font-mono">{company.kra_pin}</TableCell>
                            <TableCell className="w-[120px] font-mono">{company.kra_password}</TableCell>
                            <TableCell className="w-[100px] text-center">
                              <span className={`${company.status?.toLowerCase() === 'valid' ? 'bg-green-500' :
                                  company.status?.toLowerCase() === 'invalid' ? 'bg-red-500' :
                                    'bg-yellow-500'
                                } text-white px-2 py-1 rounded whitespace-nowrap text-sm`}>
                                {company.status || 'Pending'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4">
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

                  <Button onClick={() => { setStatus("Stopped"); }} disabled={!isChecking} variant="destructive" className="ml-2">
                    Stop Password Check
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
      {runOption === 'all' && (
        <CardFooter>
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

          <Button onClick={() => { setStatus("Stopped"); }} disabled={!isChecking} variant="destructive" className="ml-2">
            Stop Password Check
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}