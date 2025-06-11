"use server"

import { getAllVatReturns, getCompanyReturnListings } from "@/lib/data-viewer/data-fetchers"
import type { VatReturnDetails, CompanyVatReturnListings } from "@/lib/data-viewer/supabase"

interface FilterOptions {
    companyId: number
    fromYear: number
    fromMonth: number
    toYear: number
    toMonth: number
}

interface CompanyData {
    vatReturns: VatReturnDetails[]
    listings: CompanyVatReturnListings[]
}

/**
 * Server Action to fetch filtered VAT returns and their corresponding listings for a specific company and date range.
 * This is called from the client component to get data on-demand.
 */
export async function getFilteredCompanyDataAction(options: FilterOptions): Promise<CompanyData> {
    const { companyId, fromYear, fromMonth, toYear, toMonth } = options

    console.log(`Server Action: Fetching data for company ${companyId} from ${fromMonth}/${fromYear} to ${toMonth}/${toYear}`);

    // Fetch all returns for the company and its listings concurrently
    const [allReturnsForCompany, listings] = await Promise.all([
        getAllVatReturns({
            companyIds: [companyId],
            includeNestedFields: true, // Get all the JSONB data
        }),
        getCompanyReturnListings(companyId),
    ])

    // Perform date filtering on the server
    const fromDate = new Date(fromYear, fromMonth - 1)
    // Set to the end of the 'to' month to include all days in that month
    const toDate = new Date(toYear, toMonth, 0)

    const filteredReturns = allReturnsForCompany.filter((vatReturn) => {
        const returnDate = new Date(vatReturn.year, vatReturn.month - 1)
        return returnDate >= fromDate && returnDate <= toDate
    })

    // Sort the results before sending them to the client
    const sortedReturns = filteredReturns.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
    })

    return {
        vatReturns: sortedReturns,
        listings: listings,
    }
}