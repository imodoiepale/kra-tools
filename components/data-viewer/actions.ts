// In app/filed-vat/data-viewer/actions.ts
'use server'

import { getVatReturnDetails } from "@/lib/data-viewer/data-fetchers"

// This action's sole purpose is to fetch the entire, massive dataset.
// The client will call this function after it has loaded.
export async function fetchAllVatReturnsAction() {
    try {
        // Calling your existing function to get ALL returns.
        const allVatReturns = await getVatReturnDetails()
        return { success: true, data: allVatReturns }
    } catch (error) {
        console.error("Server action error fetching all VAT returns:", error)
        return { success: false, error: "Failed to fetch VAT returns." }
    }
}