// @ts-nocheck

'use client'

import { useState, useEffect } from 'react'
import { Viewer } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import { Loader2 } from 'lucide-react'

// Import required styles
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

interface PDFViewerProps {
    url: string
    className?: string
}

export function PDFViewer({ url, className }: PDFViewerProps) {
    const [isLoading, setIsLoading] = useState(true)

    // Create plugin instance with customized sidebar
    const defaultLayoutPluginInstance = defaultLayoutPlugin({
        // Customize which tabs appear and in what order
        sidebarTabs: (defaultTabs) => [
            // Only show thumbnails and bookmarks by default
            defaultTabs[0], // Thumbnails
            defaultTabs[1], // Bookmarks
        ],
        // Set initial tab to thumbnails
        setInitialTab: () => 0,
    })

    useEffect(() => {
        // Dynamically import the worker
        import('pdfjs-dist/build/pdf.worker.entry')
            .then((worker) => {
                window.pdfjsWorker = worker.default
                setIsLoading(false)
            })
            .catch((error) => {
                console.error('Error loading PDF worker:', error)
            })
    }, [])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        )
    }

    return (
        <div className={className}>
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    position: 'relative'
                }}
            >
                <Viewer
                    fileUrl={url}
                    plugins={[defaultLayoutPluginInstance]}
                    defaultScale={1}
                    theme={{
                        theme: 'auto'
                    }}
                />
            </div>
        </div>
    )
}