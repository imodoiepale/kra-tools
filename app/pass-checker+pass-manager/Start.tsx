// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from '@/lib/supabase';

import { usePathname } from 'next/navigation'
export default function Start({ activeTab, setStatus, isChecking, setIsChecking, setActiveTab }) {
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [runOption, setRunOption] = useState('all');
  const [automationProgress, setAutomationProgress] = useState(null);
  const [companies, setCompanies] = useState([]);
  const pathname = usePathname()

  useEffect(() => {
    fetchAutomationProgress();
    fetchCompanies();
  }, []);

  const fetchAutomationProgress = async () => {
    const { data, error } = await supabase
      .from('PasswordChecker_AutomationProgress')
      .select('*')
      .eq('tab', activeTab) // Ensure we fetch progress for the current tab
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching automation progress:', error);
    } else if (data) {
      setAutomationProgress(data);
      if (data.status === 'Running') {
        setIsChecking(true);
        setStatus('Running');
      } else if (data.status === 'Stopped') {
        setIsChecking(false);
        setStatus('Stopped');
      } else if (data.status === 'Completed') {
        setIsChecking(false);
        setStatus('Completed');
      }
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('PasswordChecker')
        .select('id, company_name, status')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching companies:', error);
      } else {
        setCompanies(data || []);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleCheckboxChange = (id) => {
    setSelectedCompanies(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const startCheck = async () => {
    console.log('Current activeTab:', activeTab); // Debugging line
    if (isChecking) {
      alert('An automation is already running. Please wait for it to complete or stop it before starting a new one.');
      return;
    }

    let apiEndpoint = '';
    switch (activeTab) {
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
        alert('Invalid tab selected');
        return;
    }

    try {
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

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      console.log(`Password check started for ${activeTab}:`, data);
      setIsChecking(true);
      setStatus("Running");
      setActiveTab("running"); // Navigate to the running tab

      // Update automation progress
      await supabase
        .from('PasswordChecker_AutomationProgress')
        .upsert({ id: 1, progress: 0, status: 'Running', logs: [], tab: activeTab });

      fetchAutomationProgress();
    } catch (error) {
      console.error(`Error starting password check for ${activeTab}:`, error);
      alert('Failed to start password check. Please try again.');
    }
  };

  const resumeCheck = async () => {
    let apiEndpoint = '';
    switch (activeTab) {
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
        alert('Invalid tab selected');
        return;
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: "resume", tab: activeTab }) // Include tab in the request
      });

      if (!response.ok) {
        const errorData = await response.json(); // Log the error response
        console.error('Error response:', errorData);
        throw new Error('Failed to resume automation');
      }

      setIsChecking(true);
      setStatus("Running");
      setActiveTab("running"); // Navigate to the running tab
      fetchAutomationProgress();
    } catch (error) {
      console.error('Error resuming automation:', error);
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
                      <TableHead className="sticky top-0 bg-white">#</TableHead>
                      <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                      <TableHead className="sticky top-0 bg-white">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company, index) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCompanies.includes(company.id)}
                            onCheckedChange={() => handleCheckboxChange(company.id)}
                          />
                        </TableCell>
                        <TableCell className="text-center">{index + 1}</TableCell>
                        <TableCell>{company.company_name}</TableCell>
                        <TableCell className="">
                          {company.status?.toLowerCase() === 'valid' && <span className="bg-green-500 text-white px-2 py-1 rounded">{company.status}</span>}
                          {company.status?.toLowerCase() === 'invalid' && <span className="bg-red-500 text-white px-2 py-1 rounded">{company.status}</span>}
                          {company.status?.toLowerCase() !== 'valid' && company.status?.toLowerCase() !== 'invalid' && <span className="bg-yellow-500 text-white px-2 py-1 rounded">{company.status}</span>}
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
                  <h3 className="text-lg font-semibold mb-2">Selected Companies</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.filter(c => selectedCompanies.includes(c.id)).map((company, index) => (
                        <TableRow key={company.id} className="bg-blue-100">
                          <TableCell className="text-center">{index + 1}</TableCell>
                          <TableCell>{company.company_name}</TableCell>
                          <TableCell className="">
                            {company.status?.toLowerCase() === 'valid' && <span className="bg-green-500 text-white px-2 py-1 rounded">{company.status}</span>}
                            {company.status?.toLowerCase() === 'invalid' && <span className="bg-red-500 text-white px-2 py-1 rounded">{company.status}</span>}
                            {company.status?.toLowerCase() !== 'valid' && company.status?.toLowerCase() !== 'invalid' && <span className="bg-yellow-500 text-white px-2 py-1 rounded">{company.status}</span>}
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
                    {isChecking ? 'Running...' : automationProgress?.status === 'Stopped' ? 'Resume' : 'Start Password Check'}
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
            {isChecking ? 'Running...' : automationProgress?.status === 'Stopped' ? 'Resume' : 'Start Password Check'}
          </Button>

          <Button onClick={() => { setStatus("Stopped"); }} disabled={!isChecking} variant="destructive" className="ml-2">
            Stop Password Check
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}