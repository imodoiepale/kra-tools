// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

interface DocumentViewerProps {
    url: string;
    isOpen: boolean;
    onClose: () => void;
    title: string;
    companyName: string;
}

export function DocumentViewer({ url, isOpen, onClose, title, companyName }: DocumentViewerProps) {
    const [documentUrl, setDocumentUrl] = useState<string>('')

    useEffect(() => {
        const fetchDocumentUrl = async () => {
            try {
                const { data: { publicUrl }, error } = await supabase.storage
                    .from('Payroll-Cycle')
                    .getPublicUrl(url)

                if (error) {
                    console.error('Error getting public URL:', error)
                    return
                }

                setDocumentUrl(publicUrl)
            } catch (error) {
                console.error('Error in fetchDocumentUrl:', error)
            }
        }

        if (url && isOpen) {
            fetchDocumentUrl()
        }
    }, [url, isOpen])

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[50vw] h-[90vh] p-0 overflow-hidden rounded-lg">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="text-lg font-semibold text-gray-900">{companyName}</DialogTitle>
                    <p className="mt-1 text-sm text-gray-500">{title}</p>
                </DialogHeader>
                <div className="relative w-full h-[calc(90vh-4rem)]">
                    {documentUrl && (
                        <iframe 
                            src={`${documentUrl}#view=FitH`}
                            className="absolute inset-0 w-full h-full border-0"
                            title={title}
                            loading="lazy"
                        />
                    )}
                    {!documentUrl && (
                        <div className="flex items-center justify-center h-full">
                            <p>Loading document...</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
