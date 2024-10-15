"use client"

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from '@/components/Navbar';
import { ToastContainer } from 'react-toastify';

export function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="flex h-screen">
            <div className="fixed h-full" style={{ fontSize: '70%' }}>
                <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
            </div>
            <div className={`flex-1 transition-all duration-300 ${isExpanded ? 'ml-[300px]' : 'ml-20'} overflow-hidden`}>
                <div>
                    <Navbar />
                    <div className="overflow-auto">
                        {children}
                        <ToastContainer />
                    </div>
                </div>
            </div>
        </div>
    );
}