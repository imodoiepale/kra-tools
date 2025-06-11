// components/data-viewer/data-viewer-client.tsx
"use client"

import { useState, useEffect } from "react"
import { DataViewerContent } from "./data-viewer-content"
import { getCompanies, getAllVatReturns } from "@/lib/data-viewer/data-fetchers"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, AlertCircle, RefreshCw, Database, CheckCircle } from "lucide-react"
import type { Company, VatReturnDetails } from "@/lib/data-viewer/supabase"

export function DataViewerClient() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [allVatReturns, setAllVatReturns] = useState<VatReturnDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAccountingOnly, setShowAccountingOnly] = useState(true)
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking')

    // Progress tracking
    const [loadingStage, setLoadingStage] = useState<'companies' | 'vat_returns' | 'complete'>('companies')
    const [progress, setProgress] = useState(0)
    const [totalRecords, setTotalRecords] = useState(0)
    const [loadedRecords, setLoadedRecords] = useState(0)

    const loadData = async () => {
        try {
            setLoading(true)
            setError(null)
            setConnectionStatus('checking')
            setProgress(0)
            setLoadedRecords(0)
            setTotalRecords(0)

            console.log('Starting full data load...')

            // Stage 1: Load all companies
            setLoadingStage('companies')
            const companiesData = await getCompanies(showAccountingOnly)
            console.log(`Loaded ${companiesData.length} companies`)

            if (companiesData.length === 0) {
                setConnectionStatus('failed')
                setError('No companies found. Database might be empty or connection failed.')
                return
            }

            setCompanies(companiesData)
            setConnectionStatus('connected')

            // Stage 2: Load ALL VAT returns for these companies
            setLoadingStage('vat_returns')
            const companyIds = companiesData.map(c => c.id)

            const vatData = await getAllVatReturns({
                companyIds,
                includeNestedFields: false,
                onProgress: (loaded, total) => {
                    setLoadedRecords(loaded)
                    setTotalRecords(total)
                    setProgress(Math.round((loaded / total) * 100))
                }
            })

            console.log(`Loaded ${vatData.length} VAT returns`)
            setAllVatReturns(vatData)
            setLoadingStage('complete')

        } catch (error) {
            console.error("Error loading data:", error)
            setConnectionStatus('failed')
            setError(`Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [showAccountingOnly])

    if (loading) {
        return (
            <div className="flex items-center justify-center w-full min-h-[500px]">
                <div className="text-center space-y-6 max-w-md w-full">
                    <div className="space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                        <h3 className="text-lg font-medium">Loading All VAT Data</h3>
                    </div>

                    {/* Loading stages */}
                    <div className="space-y-3">
                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${loadingStage === 'companies' ? 'bg-blue-50 border-blue-200' :
                                companies.length > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                            }`}>
                            {companies.length > 0 ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            )}
                            <div className="text-left">
                                <div className="font-medium text-sm">Loading Companies</div>
                                <div className="text-xs text-gray-600">
                                    {companies.length > 0 ? `✓ ${companies.length} companies loaded` : 'Fetching company data...'}
                                </div>
                            </div>
                        </div>

                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${loadingStage === 'vat_returns' ? 'bg-blue-50 border-blue-200' :
                                loadingStage === 'complete' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                            }`}>
                            {loadingStage === 'complete' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : loadingStage === 'vat_returns' ? (
                                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            ) : (
                                <Database className="h-5 w-5 text-gray-400" />
                            )}
                            <div className="text-left flex-1">
                                <div className="font-medium text-sm">Loading VAT Returns</div>
                                <div className="text-xs text-gray-600">
                                    {loadingStage === 'complete' ? `✓ ${allVatReturns.length} VAT returns loaded` :
                                        loadingStage === 'vat_returns' ? `${loadedRecords}/${totalRecords} records...` :
                                            'Waiting for companies...'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar for VAT returns */}
                    {loadingStage === 'vat_returns' && totalRecords > 0 && (
                        <div className="space-y-2">
                            <Progress value={progress} className="w-full" />
                            <div className="text-sm text-gray-600">
                                {progress}% complete ({loadedRecords.toLocaleString()} / {totalRecords.toLocaleString()} records)
                            </div>
                        </div>
                    )}

                    {/* Connection status */}
                    <div className="text-xs text-gray-500">
                        {connectionStatus === 'checking' && 'Connecting to database...'}
                        {connectionStatus === 'connected' && 'Database connected ✓'}
                        {connectionStatus === 'failed' && 'Connection failed ✗'}
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center w-full min-h-[500px]">
                <div className="text-center space-y-4 max-w-md">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                    <div>
                        <h3 className="text-lg font-semibold text-red-600 mb-2">Data Loading Failed</h3>
                        <p className="text-sm text-gray-600 mb-4">{error}</p>
                        <Button onClick={loadData} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Retry Loading
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Filter Controls */}
            {/* <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showAccountingOnly}
                                onChange={(e) => setShowAccountingOnly(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-sm font-medium">Show only accounting companies</span>
                        </label>

                        <div className="flex gap-2">
                            <Badge variant="outline">
                                {companies.length.toLocaleString()} companies
                            </Badge>
                            <Badge variant="outline">
                                {allVatReturns.length.toLocaleString()} VAT returns
                            </Badge>
                            <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                                {connectionStatus === 'connected' ? 'All Data Loaded' : 'Disconnected'}
                            </Badge>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Reload All Data
                    </Button>
                </div>

                <div className="mt-2 text-xs text-gray-600">
                    {loadingStage === 'complete' && (
                        <span>
                            ✓ Complete dataset loaded: {companies.length.toLocaleString()} companies,
                            {allVatReturns.length.toLocaleString()} VAT returns
                        </span>
                    )}
                </div>
            </div> */}

            <DataViewerContent companies={companies} allVatReturns={allVatReturns} />
        </div>
    )
}