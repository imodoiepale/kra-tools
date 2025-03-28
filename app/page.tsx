"use client"

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const tools = [
  {
    title: "Password Manager",
    description: "Manage and secure KRA passwords",
    path: "/password-manager",
    icon: "🔐"
  },
  {
    title: "Password Checker",
    description: "Verify and validate KRA credentials",
    path: "/password-checker",
    icon: "✓"
  },
  {
    title: "PIN Checker",
    description: "Verify KRA PIN details",
    path: "/pin-checker-details",
    icon: "🔍"
  },
  {
    title: "PIN Profile",
    description: "Manage KRA PIN profiles",
    path: "/pin-profile",
    icon: "👤"
  },
  {
    title: "PIN Certificate",
    description: "Handle KRA PIN certificates",
    path: "/pin-cert",
    icon: "📜"
  },
  {
    title: "Auto Population",
    description: "Automated data population tools",
    path: "/auto-population",
    icon: "🤖"
  },
  {
    title: "Checklist",
    description: "Track and manage compliance tasks",
    path: "/checklist",
    icon: "✅"
  },
  {
    title: "Ledger",
    description: "Manage financial ledgers",
    path: "/ledger",
    icon: "📒"
  },
  {
    title: "Liabilities",
    description: "Track and manage liabilities",
    path: "/liabilities",
    icon: "💰"
  },
  {
    title: "Manufacturers Details",
    description: "Manage manufacturer information",
    path: "/manufacturers-details",
    icon: "🏭"
  },
  {
    title: "Pentasoft",
    description: "Pentasoft integration tools",
    path: "/pentasoft",
    icon: "🔄"
  },
  {
    title: "TCC",
    description: "Tax Compliance Certificate management",
    path: "/tcc",
    icon: "📋"
  },
  {
    title: "WHT",
    description: "Withholding Tax management",
    path: "/wht",
    icon: "💸"
  },
  {
    title: "Wingu Apps",
    description: "Wingu application integrations",
    path: "/winguapps",
    icon: "📱"
  }
];

export default function Home() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">KRA Tools Portal</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Your comprehensive suite of KRA management tools
        </p>
        <div className="relative w-full max-w-lg mx-auto">
          <Input
            type="search"
            placeholder="Search tools..."
            className="w-full pl-10"
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link href={tool.path} key={tool.path}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{tool.icon}</span>
                  <CardTitle>{tool.title}</CardTitle>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}