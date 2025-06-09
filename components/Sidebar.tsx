// @ts-nocheck
// components/Sidebar.tsx

"use client";

import {
  LayoutDashboard,
  Key,
  Lock,
  Settings,
  Factory,
  KeyRound,
  FileCheck,
  FileText,
  ShieldCheck,
  CreditCard,
  FileSignature,
  Users,
  FileSpreadsheet,
  ClipboardCheck,
  UserCheck,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Download,
  ChevronDown,
  Cloud,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const navItems = [
  {
    href: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    category: "Main",
    available: true,
  },
  // {
  //   href: "/password-manager",
  //   icon: Lock,
  //   label: "Password Manager",
  //   category: "Main",
  //   available: true,
  // },
  {
    href: "/pass-checker+pass-manager",
    icon: Lock,
    label: "Password Checker",
    category: "Main",
    available: true,
  },
  {
    href: "/checklist",
    icon: FileCheck,
    label: "Checklist",
    category: "Main",
    available: true,
  },

  // Accounting Cycles
  {
    href: "/checklist",
    icon: BarChart2,
    label: " All Taxes Checklist",
    category: "Accounting Cycles",
    available: true,
  },
  {
    href: "/file-management",
    icon: BarChart2,
    label: "File Management",
    category: "Accounting Cycles",
    available: true,
  },
  {
    href: "/payroll",
    icon: Cloud,
    label: "Payroll Cycle",
    category: "Accounting Cycles",
    available: true,
  },
  {
    href: "/vat",
    icon: CreditCard,
    label: "VAT Cycle",
    category: "Accounting Cycles",
    available: false,
  },
  {
    href: "/filed-vat",
    icon: FileSignature,
    label: "Filed VAT Summary",
    category: "Accounting Cycles",
    available: true,
  },
  {
    href: "/wh-vat",
    icon: FileSignature,
    label: "WH VAT Cycle",
    category: "Accounting Cycles",
    available: false,
  },
  {
    href: "/kebs",
    icon: Download,
    label: "Standard Levy (KEBS) Cycle",
    category: "Accounting Cycles",
    available: false,
  },
  {
    href: "/tot",
    icon: ChevronDown,
    label: "TurnOver Tax (TOT) Cycle",
    category: "Accounting Cycles",
    available: false,
  },
  {
    href: "/payroll/bank-statements",
    icon: FileSpreadsheet,
    label: "Bank Statements",
    category: "Accounting Cycles",
    available: true,
  },
  {
    href: "/payroll/etr",
    icon: FileSpreadsheet,
    label: "ETR Statements",
    category: "Accounting Cycles",
    available: false,
  },
  {
    href: "/suppliers",
    icon: FileSpreadsheet,
    label: "Supplier Statements",
    category: "Accounting Cycles",
    available: false,
  },
  {
    href: "/reports",
    icon: FileSpreadsheet,
    label: "Full Reports",
    category: "Accounting Cycles",
    available: true,
  },

  // One-off Tools
  // {
  //   href: "/password-checker",
  //   icon: Key,
  //   label: "Password Checker",
  //   category: "One-off Tools",
  //   available: true,
  // }, 
  {
    href: "/manufacturers-details",
    icon: Factory,
    label: "Manufacturers Details",
    category: "One-off Tools",
    available: true,
  },
  {
    href: "/pin-checker-details",
    icon: ClipboardCheck,
    label: "PIN Checker Details (Obligations)",
    category: "One-off Tools",
    available: true,
  },
  {
    href: "/wht",
    icon: FileText,
    label: "Withholding VAT Extractor",
    category: "One-off Tools",
    available: true,
  },
  {
    href: "/pin-cert",
    icon: ClipboardCheck,
    label: "PIN Certifiate Extractor",
    category: "One-off Tools",
    available: true,
  },
  {
    href: "/pin-profile",
    icon: ClipboardCheck,
    label: "PIN Profile Extractor",
    category: "One-off Tools",
    available: true,
  },
  {
    href: "/tcc",
    icon: ShieldCheck,
    label: "Tax Compliance Downloader",
    category: "One-off Tools",
    available: true,
  },
  {
    href: "/name-extractor",
    icon: UserCheck,
    label: "Tax Payer Name Extractor",
    category: "One-off Tools",
    available: false,
  },
  {
    href: "/password-changer",
    icon: KeyRound,
    label: "Password Changer",
    category: "One-off Tools",
    available: false,
  },

  // Monthly Tools
  {
    href: "/auto-population",
    icon: Users,
    label: "Auto-Population",
    category: "Monthly Tools",
    available: true,
  },
  {
    href: "/liabilities",
    icon: FileSpreadsheet,
    label: "Liabilities Extractor",
    category: "Monthly Tools",
    available: true,
  },
  {
    href: "/withholding-tax-downloader",
    icon: Download,
    label: "Withholding Tax Downloader",
    category: "Monthly Tools",
    available: false,
  },
  {
    href: "/winguapps",
    icon: Cloud,
    label: "WinguApps Reports",
    category: "Monthly Tools",
    available: true,
  },
  {
    href: "/pentasoft",
    icon: Users,
    label: "Pentasoft Downloader",
    category: "Monthly Tools",
    available: true,
  },
  // { href: "/wht", icon: DollarSign, label: "Withholding VAT Extractor", category: "Monthly Tools", available: false },
  {
    href: "/ledgercopy",
    icon: BarChart2,
    label: "Ledger copy Downloader",
    category: "Monthly Tools",
    available: true,
  },
  {
    href: "/ledger",
    icon: BarChart2,
    label: "Ledger Downloader",
    category: "Monthly Tools",
    available: true,
  },

  // Suggested New Tools
  {
    href: "/pin-registration",
    icon: FileSignature,
    label: "PIN Registration Tool",
    category: "Suggested New Tools",
    available: false,
  },
  {
    href: "/tax-returns-filing",
    icon: FileCheck,
    label: "Tax Returns Filing",
    category: "Suggested New Tools",
    available: false,
  },
  {
    href: "/tax-certificates",
    icon: FileText,
    label: "Tax Compliance Certificates",
    category: "Suggested New Tools",
    available: false,
  },
  {
    href: "/tax-clearance",
    icon: ShieldCheck,
    label: "Tax Clearance Status Checker",
    category: "Suggested New Tools",
    available: false,
  },
  {
    href: "/payment-reminders",
    icon: CreditCard,
    label: "Tax Payment Reminders",
    category: "Suggested New Tools",
    available: false,
  },
  {
    href: "/audit-logs",
    icon: FileText,
    label: "Audit Logs Viewer",
    category: "Suggested New Tools",
    available: false,
  },

  {
    href: "/settings",
    icon: Settings,
    label: "Settings",
    category: "Main",
    available: false,
  },
];

export function Sidebar({
  isExpanded,
  setIsExpanded,
}: {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
}) {
  const pathname = usePathname();
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const categories = Array.from(new Set(navItems.map((item) => item.category)));

  const toggleCategory = (category: string) => {
    if (isExpanded) {
      setOpenCategories((prev) =>
        prev.includes(category)
          ? prev.filter((c) => c !== category)
          : [...prev, category]
      );
    }
  };

  return (
    <div className="flex h-[150vh]">
      <aside
        className={`bg-gray-800 text-white transition-all duration-300 ease-in-out ${
          isExpanded ? "w-[300px]" : "w-20"
        } p-3 hidden md:block relative`}>
        <div
          className={`flex items-center mb-6 ${
            isExpanded ? "" : "justify-center"
          }`}>
          {isExpanded && <span className="text-lg font-bold">BCL Tools</span>}
        </div>
        <nav className="space-y-1">
          {categories.map((category) => (
            <div key={category}>
              {isExpanded ? (
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center justify-between w-full text-[16px] font-semibold text-gray-400 mt-3 mb-1 hover:bg-gray-700 p-1 rounded">
                  <span>{category}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      openCategories.includes(category) ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ) : (
                <div className="text-xs font-semibold text-gray-400 mt-3 mb-1 text-center">
                  {category[0]}
                </div>
              )}
              <AnimatePresence initial={false}>
                {(isExpanded ? openCategories.includes(category) : true) && (
                  <motion.div
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={{
                      open: { opacity: 1, height: "auto" },
                      collapsed: { opacity: 0, height: 0 },
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}>
                    {navItems
                      .filter((item) => item.category === category)
                      .map((item) =>
                        item.available ? (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center p-1.5 rounded text-sm ${
                              pathname === item.href
                                ? "text-blue-400 font-bold bg-gray-700"
                                : "text-gray-300 hover:bg-gray-700"
                            } ${isExpanded ? "" : "justify-center"} relative`}>
                            <item.icon className="w-4 h-4 mr-2" />
                            {isExpanded && item.label}
                          </Link>
                        ) : (
                          <Popover key={item.href}>
                            <PopoverTrigger asChild>
                              <button
                                className={`flex items-center p-1.5 rounded text-sm text-gray-400 hover:bg-gray-700 ${
                                  isExpanded ? "" : "justify-center"
                                } relative w-full text-left`}>
                                <span className="absolute top-0 right-0 w-2 h-2 z-10 bg-red-500 rounded-full"></span>
                                <item.icon className="w-4 h-4 mr-2" />
                                {isExpanded && item.label}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="bg-red-500 text-white mt-2 mr-2 p-1 text-xs rounded w-40 h-8">
                              Coming soon
                            </PopoverContent>
                          </Popover>
                        )
                      )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>
        <button
          className="absolute top-2 right-2 p-1.5 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
          onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? (
            <ChevronLeft className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
      </aside>
    </div>
  );
}
