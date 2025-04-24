// components/BankStatements/SharedComponents/FileStatusBadge.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface FileStatusBadgeProps {
    status: string;
}

export default function FileStatusBadge({ status }: FileStatusBadgeProps) {
    switch (status) {
        case 'pending':
            return <Badge variant="outline" className="bg-gray-100 text-gray-800">Pending</Badge>;
        case 'processing':
            return <Badge variant="outline" className="bg-blue-100 text-blue-800">Processing</Badge>;
        case 'matched':
            return <Badge variant="outline" className="bg-green-100 text-green-800">Matched</Badge>;
        case 'unmatched':
            return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Unmatched</Badge>;
        case 'failed':
            return <Badge variant="outline" className="bg-red-100 text-red-800">Failed</Badge>;
        case 'uploaded':
            return <Badge variant="outline" className="bg-green-100 text-green-800">Uploaded</Badge>;
        case 'vouched':
            return <Badge variant="outline" className="bg-purple-100 text-purple-800">Vouched</Badge>;
        default:
            return <Badge variant="outline">Unknown</Badge>;
    }
}