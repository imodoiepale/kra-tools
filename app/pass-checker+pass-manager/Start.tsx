// StartTab.tsx
// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function StartTab({ companies, handleStopCheck, activeTab }) {
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [runOption, setRunOption] = useState('all');
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState("Not Started");

  const handleCheckboxChange = (id) => {
    setSelectedCompanies(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const startCheck = async () => {
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
    } catch (error) {
      console.error(`Error starting password check for ${activeTab}:`, error);
      alert('Failed to start password check. Please try again.');
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
                      {activeTab === 'kra' && (
                        <>
                          <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                          <TableHead className="sticky top-0 bg-white">KRA Password</TableHead>
                        </>
                        )}
                      {activeTab === 'nssf' && (
                        <>
                         <TableHead className="sticky top-0 bg-white">NSSF ID</TableHead>
                        <TableHead className="sticky top-0 bg-white">NSSF Password</TableHead>
                        </>
                      )}
                      {activeTab === 'nhif' && (
                        <>
                         <TableHead className="sticky top-0 bg-white">NHIF ID</TableHead>
                         <TableHead className="sticky top-0 bg-white">NHIF Password</TableHead>
                        <TableHead className="sticky top-0 bg-white">NHIF Code</TableHead>
                        </>
                      )}
                      {activeTab === 'ecitizen' && (
                        <>
                         <TableHead className="sticky top-0 bg-white">eCitizen ID</TableHead>
                         <TableHead className="sticky top-0 bg-white">eCitizen Password</TableHead>
                        <TableHead className="sticky top-0 bg-white">Director</TableHead>
                        </>
                      )}
                       {activeTab === 'quickbooks' && (
                        <>
                         <TableHead className="sticky top-0 bg-white">ID</TableHead>
                         <TableHead className="sticky top-0 bg-white">Password</TableHead>
                        </>
                      )}
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
                        {activeTab === 'kra' ? (
                          <>
                          <TableCell>{company.company_name}</TableCell>
                            <TableCell>{company.kra_pin || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                            <TableCell>{company.kra_password || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                          </>
                        ) : (
                          <>
                          <TableCell>{company.name}</TableCell>
                            <TableCell>{company.identifier || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                            <TableCell>{company.password || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                          </>
                        )}
                        {(activeTab === 'nhif' || activeTab === 'nssf') && (
                          <TableCell>{company.code || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                        )}
                        {activeTab === 'ecitizen' && (
                          <TableCell>{company.director || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                        )}
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
                          {activeTab === 'kra' && (
                        <>
                          <TableHead>KRA PIN</TableHead>
                          <TableHead>KRA Password</TableHead>
                        </>
                        )}
                      {activeTab === 'nssf' && (
                        <>
                         <TableHead>NSSF ID</TableHead>
                        <TableHead>NSSF Password</TableHead>
                        </>
                      )}
                      {activeTab === 'nhif' && (
                        <>
                         <TableHead>NHIF ID</TableHead>
                         <TableHead>NHIF Password</TableHead>
                        <TableHead>NHIF Code</TableHead>
                        </>
                      )}
                      {activeTab === 'ecitizen' && (
                        <>
                         <TableHead>ID</TableHead>
                         <TableHead>Password</TableHead>
                        <TableHead>Director</TableHead>
                        </>
                      )}
                       {activeTab === 'quickbooks' && (
                        <>
                         <TableHead>ID</TableHead>
                         <TableHead>Password</TableHead>
                        </>
                      )}
                      <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.filter(c => selectedCompanies.includes(c.id)).map((company, index) => (
                        <TableRow key={company.id} className="bg-blue-100">
                          <TableCell className="text-center">{index + 1}</TableCell>
                          {activeTab === 'kra' ? (
                            <>
                            <TableCell>{company.company_name}</TableCell>
                              <TableCell>{company.kra_pin || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                              <TableCell>{company.kra_password || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                            </>
                          ) : (
                            <>
                            <TableCell>{company.name}</TableCell>
                              <TableCell>{company.identifier || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                              <TableCell>{company.password || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                            </>
                          )}
                          {(activeTab === 'nhif' || activeTab === 'nssf') && (
                            <TableCell>{company.code || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                          )}
                          {activeTab === 'ecitizen' && (
                            <TableCell>{company.director || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                          )}
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
                  <Button onClick={startCheck} disabled={isChecking || selectedCompanies.length === 0}>
                    {isChecking ? 'Running...' : 'Start Password Check'}
                  </Button>
                  <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
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
          <Button onClick={startCheck} disabled={isChecking}>
            {isChecking ? 'Running...' : 'Start Password Check'}
          </Button>
          <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
            Stop Password Check
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}