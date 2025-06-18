'use client'

import { useState, useMemo } from 'react'
import { Search, Building2, Loader2, CheckCircle, XCircle } from 'lucide-react'

const companies = [
  'LIVEAL LIMITED', 'AGROLT SOLUTIONS PRIVATE LIMITED', 'BEARING & INDUSTRIAL SUPPLIES LIMITED',
  'NAZISH MOTORS LIMITED', 'NELATO TRADING LIMITED', 'NIR DRILLING LIMITED', 'OASIS POWER (A) LIMITED',
  'OPTECH LENS TECHNOLOGIES LTD', 'PATTHAR AFRICA LTD', 'RUTU HARDWARE LIMITED', 'SBNP VENTURES LTD',
  'SHREENATHJI DEVELOPERS COMPANY', 'SIMSTEL CONNECT LTD', 'THE FOOD BAZAAR LTD',
  'UNIVERSAL AUTO EXPERTS LTD', 'UNIVERSAL MOTORS LTD', 'VISHNU BUILDERS & DEVELOPERS LTD',
  'Visionhub Optical Technology Ltd', 'XEROX PROPERTIES LTD', 'XTRA CAB CABLES LIMITED',
  'AKASH DISTRIBUTORS (K) LIMITED', 'AMBE HARDWARE STORES LIMITED', 'ANAMAYA LIMITED',
  'ASHTAVINAYAKA TECHNO PROCESS ENGINEERING PVT LTD', 'BOOKSMART CONSULTANCY LTD - Prior to 27.08.2024',
  'COPPER SYNTECH LIMITED', 'DIGITAL REGENESYS LIMTED', 'FILAMENT TECHNOLOGIES LIMITED',
  'FIVE STAR APARTMENTS MANAGEMENT LIMITED', 'HONEYCOMB STUDIOS LIMITED',
  'INDOSELLA CONSTRUCTION EQUIPMENT MFG. LTD', 'INFOBIT INC LTD', 'KORUWE PRODUCTS LTD',
  'KUSHAL COMPANY LIMITED', 'LEOTECH MOBILITY LIMITED', 'MAHABALVIRA ENTERPRISES LIMITED',
  'MASANI ECO GREEN LIMITED', 'KIFARU HOUSEHOLD LTD - QB FILE', 'SHUKRUPA BUILDERS LIMITED'
]

export default function HomePage() {
  const [loadingCompany, setLoadingCompany] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredCompanies = useMemo(() => {
    if (!searchTerm.trim()) return companies
    return companies.filter(company =>
      company.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm])

  const launchCompany = async (company: string) => {
    setLoadingCompany(company)
    setMessage(null)

    try {
      const res = await fetch('http://localhost:5000/launch-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      })
      const msg = await res.text()
      setMessage(msg)
      setMessageType(res.ok ? 'success' : 'error')
    } catch (err) {
      setMessage('❌ Error launching QuickBooks. Please check your connection.')
      setMessageType('error')
    } finally {
      setLoadingCompany(null)
    }
  }

  const getMessageIcon = () => {
    switch (messageType) {
      case 'success': return <CheckCircle className="w-4 h-4" />
      case 'error': return <XCircle className="w-4 h-4" />
      default: return null
    }
  }

  const getMessageClasses = () => {
    switch (messageType) {
      case 'success': return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'error': return 'bg-red-50 text-red-800 border-red-200'
      default: return 'bg-blue-50 text-blue-800 border-blue-200'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              QuickBooks Launcher
            </h1>
          </div>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Select a company from the list below to launch QuickBooks and automatically log in to your desired workspace.
          </p>
        </header>

        {/* Search Bar */}
        <div className="mb-8 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
          {searchTerm && (
            <p className="text-sm text-slate-500 mt-2 text-center">
              {filteredCompanies.length} of {companies.length} companies found
            </p>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div className={`mb-6 max-w-2xl mx-auto p-4 rounded-xl border shadow-sm ${getMessageClasses()}`}>
            <div className="flex items-center gap-2 justify-center">
              {getMessageIcon()}
              <span className="font-medium">{message}</span>
            </div>
          </div>
        )}

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map((company, index) => {
            const isLoading = loadingCompany === company
            const isDisabled = !!loadingCompany
            
            return (
              <button
                key={index}
                onClick={() => launchCompany(company)}
                disabled={isDisabled}
                className={`group relative p-5 rounded-xl border transition-all duration-200 text-left ${
                  isLoading
                    ? 'bg-slate-100 border-slate-200 cursor-wait'
                    : isDisabled
                    ? 'bg-white/50 border-slate-200 cursor-not-allowed opacity-50'
                    : 'bg-white/80 border-slate-200 hover:bg-white hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
                } backdrop-blur-sm shadow-sm`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight mb-1 group-hover:text-blue-700 transition-colors">
                      {company}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Click to launch QuickBooks
                    </p>
                  </div>
                  
                  <div className="ml-3 flex-shrink-0">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-200 group-hover:bg-blue-500 transition-colors duration-200 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
              </button>
            )
          })}
        </div>

        {/* No Results */}
        {filteredCompanies.length === 0 && searchTerm && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No companies found</h3>
            <p className="text-slate-500">Try adjusting your search terms</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-slate-500">
          <p>Total companies: {companies.length}</p>
        </footer>
      </div>
    </div>
  )
}
