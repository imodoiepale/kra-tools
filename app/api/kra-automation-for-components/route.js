import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { type, stop, kra_pins } = await request.json();

        if (!kra_pins || !Array.isArray(kra_pins)) {
            return NextResponse.json(
                { error: 'Invalid or missing kra_pins array in request' },
                { status: 400 }
            );
        }

        if (stop) {
            return NextResponse.json({ message: 'Operation stopped by user' });
        }

        const requests = kra_pins.map(kra_pin => {
            const url = `https://primary-production-079f.up.railway.app/webhook/manufucturerDetails?kra_pin=${encodeURIComponent(kra_pin)}&type=${encodeURIComponent(type)}`;
            
            return fetch(url)
                .then(res => res.json())
                .then(data => ({ kra_pin, success: true, data }))
                .catch(error => ({ kra_pin, success: false, error: error.message }));
        });

        const results = await Promise.all(requests);
        
        // Count successes and failures
        const summary = results.reduce((acc, result) => {
            if (result.success) {
                acc.successful++;
            } else {
                acc.failed++;
            }
            return acc;
        }, { successful: 0, failed: 0 });

        return NextResponse.json({
            message: 'KRA automation completed',
            summary,
            results
        });
    } catch (error) {
        console.error('Error in KRA automation:', error);
        return NextResponse.json(
            { 
                error: 'Internal server error', 
                details: error.message
            },
            { status: 500 }
        );
    }
}
