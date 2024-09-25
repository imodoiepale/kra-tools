// components/Sidebar.tsx
"use client"

import {
    LayoutDashboard,
    Key,
    Wrench,
    Settings,
    ChevronLeft,
    ChevronRight
} from "lucide-react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { useState } from "react"

const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/password-checker", icon: Key, label: "Password Checker" },
    { href: "/tool2", icon: Wrench, label: "Tool 2" },
    { href: "/tool3", icon: Wrench, label: "Tool 3" },
    { href: "/settings", icon: Settings, label: "Settings" },
]

export function Sidebar() {
    const pathname = usePathname()
    const [isExpanded, setIsExpanded] = useState(true)

    return (
        <div className="flex h-[150vh]">
            <aside className={`bg-gray-800 text-white transition-all duration-300 ease-in-out ${isExpanded ? 'w-[300px]' : 'w-20'} p-4 hidden md:block relative`}>
                <div className={`flex items-center mb-8 ${isExpanded ? '' : 'justify-center'}`}>
                    {isExpanded && <span className="text-xl font-bold">KRA Tools</span>}
                </div>
                <nav className="space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center p-2 rounded ${pathname === item.href
                                    ? "text-blue-400  font-bold bg-gray-700"
                                    : "text-gray-300 hover:bg-gray-700"
                                } ${isExpanded ? '' : 'justify-center'}`}
                        >
                            <item.icon className="w-5 h-5 mr-2" />
                            {isExpanded && item.label}
                        </Link>
                    ))}
                </nav>
                <button
                    className="absolute top-2 right-2 p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
            </aside>
        </div>
    )
}