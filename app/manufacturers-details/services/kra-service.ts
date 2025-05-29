//@ts-nocheck
interface KraResponse {
    kra_pin: string;
    success: boolean;
    data: any;
}

interface KraServiceParams {
    kraPins: string[];
    type: string;
}

export const kraService = {
    fetchManufacturerDetails: async ({ kraPins, type }: KraServiceParams): Promise<KraResponse[]> => {
        const requests = kraPins.map(kra_pin => {
            const url = `https://primary-production-079f.up.railway.app/webhook-test/manufucturerDetails?kra_pin=${encodeURIComponent(kra_pin)}&type=${type}`;
            
            return fetch(url)
                .then(res => res.json())
                .then(data => ({ kra_pin, success: true, data }))
                .catch(error => ({ kra_pin, success: false, error }));
        });

        return Promise.all(requests);
    },

    startManufacturerDetailsCheck: async ({
        kraPins,
        type
    }: KraServiceParams): Promise<{ results: KraResponse[], summary: { successful: number; failed: number } }> => {
        try {
            // First fetch manufacturer details for all PINs
            const results = await kraService.fetchManufacturerDetails({ kraPins, type });
            console.log("All Results:", results);

            // Calculate summary from results
            const summary = {
                successful: results.filter(r => 
                    Array.isArray(r.data) && r.data[0]?.timsManBasicRDtlDTO !== undefined
                ).length,
                failed: results.filter(r => !r.success || (
                    Array.isArray(r.data) && (r.data[0]?.errorDto !== undefined || r.data[0]?.isError === "true")
                )).length
            };
            console.log('Manufacturers details check completed:', { results, summary });

            return {
                results,
                summary
            };
        } catch (error) {
            console.error('Error in manufacturer details check:', error);
            throw error;
        }
    }
};
