// @ts-nocheck
"use client"


import React from 'react';
import { Input } from "@/components/ui/input";

export default function SearchBar({ searchTerm, setSearchTerm }) {
    return (
        <div className="flex-grow">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Search Clients</label>
            <div className="flex space-x-2">
                <Input
                    id="search"
                    placeholder="Search clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-1/6"
                />
            </div>
        </div>
    );
}