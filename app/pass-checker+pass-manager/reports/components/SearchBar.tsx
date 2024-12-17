import React from 'react'
import { Input } from "@/components/ui/input"
import { Search } from 'lucide-react'

interface SearchBarProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
}

export function SearchBar({ searchTerm, setSearchTerm }: SearchBarProps) {
  return (
    <div className="relative w-64">
      <Input
        type="text"
        placeholder="Search companies..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-8"
      />
      <Search className="h-4 w-4 absolute left-2 top-3 text-gray-500" />
    </div>
  )
}
