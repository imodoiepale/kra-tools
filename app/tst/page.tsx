"use client"

import React, { useState, useEffect } from 'react';

export default function PayrollPage() {
  // State for date range selection
  const [startDate, setStartDate] = useState('2015-01');
  const [endDate, setEndDate] = useState('2025-12');
  const [searchTerm, setSearchTerm] = useState('');
  const [companies, setCompanies] = useState([
    { id: 1, name: 'Company A' },
    { id: 2, name: 'Company B' },
    { id: 3, name: 'Company C' }
  ]);
  const [filteredCompanies, setFilteredCompanies] = useState(companies);
  
  // Function to generate month range
  const getMonthsInRange = (start: string, end: string) => {
    const startDate = new Date(start + '-01');
    const endDate = new Date(end + '-01');
    const months = [];
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      months.push({
        name: monthNames[month],
        year: year,
        label: `${monthNames[month]} ${year}`
      });
      
      currentDate.setMonth(month + 1);
    }
    
    return months;
  };
  
  const visibleMonths = getMonthsInRange(startDate, endDate);

  // Filter companies based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCompanies(companies);
    } else {
      const filtered = companies.filter(company => 
        company.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    }
  }, [searchTerm, companies]);

  // Apply date range
  const applyDateRange = () => {
    // This would normally fetch new data based on the date range
    console.log(`Fetching data from ${startDate} to ${endDate}`);
  };
  
  // Calculate table width based on months
  const tableWidth = visibleMonths.length * 1000; // 1000px per month as base

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header with title and controls */}
      <div className="bg-white shadow-sm p-4 border-b">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Payroll Management System</h1>
          
          <div className="flex flex-wrap items-center gap-3 justify-between">
            {/* Search bar */}
            <div className="relative flex-grow max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400">🔍</span>
              </div>
              <input
                type="text"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Date range selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">📅</span>
                <label className="text-sm font-medium text-gray-700 mr-2">From:</label>
                <input 
                  type="month" 
                  min="2015-01" 
                  max="2025-12"
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center">
                <label className="text-sm font-medium text-gray-700 mr-2">To:</label>
                <input 
                  type="month" 
                  min="2015-01" 
                  max="2025-12"
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button 
                onClick={applyDateRange}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Apply
              </button>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <span>⚙️</span>
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <span>📥</span>
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <span>🖨️</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Table container with horizontal scrolling */}
      <div className="flex-grow overflow-auto">
        <div style={{ minWidth: `${tableWidth}px`, maxWidth: '100%' }} className="h-full">
          <table className="w-full border-collapse bg-white">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-blue-600 text-white py-3 px-4 border border-gray-300 min-w-[200px] text-left">
                  Company
                </th>
                {visibleMonths.map((month, index) => (
                  <th key={index} colSpan={10} className="bg-blue-600 text-white py-3 px-4 border border-gray-300 text-center">
                    {month.label}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-20 bg-blue-600 text-white py-3 px-4 border border-gray-300"></th>
                {visibleMonths.map((_, monthIndex) => (
                  <React.Fragment key={monthIndex}>
                    <th colSpan={2} className="bg-blue-500 text-white py-2 px-3 border border-gray-300 text-center">PAYE</th>
                    <th colSpan={2} className="bg-blue-500 text-white py-2 px-3 border border-gray-300 text-center">Housing Levy</th>
                    <th colSpan={2} className="bg-blue-500 text-white py-2 px-3 border border-gray-300 text-center">NITA</th>
                    <th colSpan={2} className="bg-blue-500 text-white py-2 px-3 border border-gray-300 text-center">SIHF</th>
                    <th colSpan={2} className="bg-blue-500 text-white py-2 px-3 border border-gray-300 text-center">NSSF</th>
                  </React.Fragment>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-20 bg-blue-600 text-white py-2 px-4 border border-gray-300"></th>
                {visibleMonths.map((_, monthIndex) => (
                  <React.Fragment key={monthIndex}>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Amount</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Pay Date</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Amount</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Pay Date</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Amount</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Pay Date</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Amount</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Pay Date</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Amount</th>
                    <th className="bg-blue-400 text-white py-2 px-3 border border-gray-300 text-sm font-medium">Pay Date</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Display filtered companies */}
              {filteredCompanies.map((company, companyIndex) => (
                <tr key={company.id} className={companyIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="sticky left-0 z-10 py-3 px-4 border border-gray-300 bg-blue-100 font-medium">
                    {company.name}
                  </td>
                  
                  {/* Generate cells for all months */}
                  {visibleMonths.map((month, monthIndex) => {
                    // Determine if we have data for this company/month - for demo we'll just use the index
                    const hasData = companyIndex === 0 || (companyIndex === 1 && monthIndex % 3 === 0);
                    
                    return (
                      <React.Fragment key={monthIndex}>
                        <td className="py-3 px-3 border border-gray-300 text-right">{hasData ? '10,547.00' : '0.00'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-center">{hasData ? `${month.name.slice(0, 3)} 08, ${month.year}` : '—'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-right">{hasData ? '3,027.00' : '0.00'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-center">{hasData ? `${month.name.slice(0, 3)} 08, ${month.year}` : '—'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-right">{hasData ? '150.00' : '0.00'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-center">{hasData ? `${month.name.slice(0, 3)} 08, ${month.year}` : '—'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-right">{hasData ? '2,775.00' : '0.00'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-center">{hasData ? `${month.name.slice(0, 3)} 08, ${month.year}` : '—'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-right">{hasData ? '0.00' : '0.00'}</td>
                        <td className="py-3 px-3 border border-gray-300 text-center">—</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
              
              {/* Empty Rows - add enough to fill the viewport */}
              {[...Array(10)].map((_, i) => (
                <tr key={`empty-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="sticky left-0 z-10 py-3 px-4 border border-gray-300 bg-gray-100"></td>
                  {visibleMonths.map((_, monthIndex) => (
                    <React.Fragment key={monthIndex}>
                      {[...Array(10)].map((_, j) => (
                        <td key={j} className="py-3 px-3 border border-gray-300"></td>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer */}
      <div className="bg-white shadow-sm p-3 border-t flex justify-between items-center text-sm text-gray-600">
        <div>
          <span className="font-medium">{filteredCompanies.length}</span> companies • Displaying <span className="font-medium">{visibleMonths.length}</span> months
        </div>
        <div>
          {visibleMonths.length > 0 && (
            <>Range: <span className="font-medium">{visibleMonths[0]?.label}</span> to <span className="font-medium">{visibleMonths[visibleMonths.length - 1]?.label}</span></>
          )}
        </div>
      </div>
    </div>
  );
}