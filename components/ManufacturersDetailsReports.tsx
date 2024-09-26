// components/ManufacturersDetailsReports.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, RefreshCw } from 'lucide-react'

interface Manufacturer {
  id: number
  company_name: string
  kra_pin: string
  manufacturer_name: string
  mobile_number: string
  main_email_address: string
  business_reg_cert_no: string
  business_reg_date: string
  business_commencement_date: string
  postal_code: string
  po_box: string
  town: string
  desc_addr: string
}

export function ManufacturersDetailsReports() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('ManufacturersDetails')
      .select('*')
      .order('company_name', { ascending: true })

    if (error) {
      console.error('Error fetching reports:', error)
    } else {
      setManufacturers(data || [])
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleEdit = (manufacturer: Manufacturer) => {
    setEditingManufacturer(manufacturer)
  }

  const handleSave = async (updatedManufacturer: Manufacturer) => {
    const { id, ...updateData } = updatedManufacturer
    const { error } = await supabase
      .from('ManufacturersDetails')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating manufacturer:', error)
    } else {
      setManufacturers(manufacturers.map(m => m.id === updatedManufacturer.id ? updatedManufacturer : m))
      setEditingManufacturer(null)
    }
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase
      .from('ManufacturersDetails')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting manufacturer:', error)
    } else {
      setManufacturers(manufacturers.filter(m => m.id !== id))
    }
  }

  const handleDeleteAll = async () => {
    const { error } = await supabase
      .from('ManufacturersDetails')
      .delete()
      .neq('id', 0)  // This will delete all rows

    if (error) {
      console.error('Error deleting all manufacturers:', error)
    } else {
      setManufacturers([])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Manufacturers Details Reports</h3>
        <div className="space-x-2">
          <Button variant="outline" onClick={fetchReports}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="destructive" onClick={handleDeleteAll}>Delete All</Button>
        </div>
      </div>
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table className="text-sm pb-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Index</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead className="text-center">KRA PIN</TableHead>
                  <TableHead className="text-center">Manufacturer Name</TableHead>
                  <TableHead className="text-center">Mobile Number</TableHead>
                  <TableHead className="text-center">Email Address</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manufacturers.map((manufacturer, index) => (
                  <TableRow key={manufacturer.id} className={`h-10 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell>{manufacturer.company_name}</TableCell>
                    <TableCell className="text-center">{manufacturer.kra_pin}</TableCell>
                    <TableCell className="text-center">{manufacturer.manufacturer_name}</TableCell>
                    <TableCell className="text-center">{manufacturer.mobile_number}</TableCell>
                    <TableCell className="text-center">{manufacturer.main_email_address}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(manufacturer)}>Edit</Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Manufacturer Details</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              {Object.entries(editingManufacturer || {}).map(([key, value]) => (
                                <div key={key} className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor={key} className="text-right">
                                    {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                                  </Label>
                                  <Input
                                    id={key}
                                    value={value}
                                    onChange={(e) => setEditingManufacturer({ ...editingManufacturer, [key]: e.target.value })}
                                    className="col-span-3"
                                  />
                                </div>
                              ))}
                            </div>
                            <DialogClose asChild>
                              <Button onClick={() => handleSave(editingManufacturer)}>Save Changes</Button>
                            </DialogClose>
                          </DialogContent>
                        </Dialog>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(manufacturer.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}