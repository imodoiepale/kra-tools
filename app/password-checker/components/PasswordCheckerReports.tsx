// components/PasswordCheckerReports.tsx
// @ts-nocheck
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Search, ArrowUpDown, Filter, Eye, EyeOff } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import ExcelJS from "exceljs";
import { ClientCategoryFilter } from "@/components/ClientCategoryFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Company {
  id: number;
  company_name: string;
  kra_pin: string;
  kra_password: string;
  status: string;
  last_checked: string;
  client_category?: string;
}

export function PasswordCheckerReports() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [newCompany, setNewCompany] = useState<Partial<Company>>({
    company_name: "",
    kra_pin: "",
    kra_password: "",
    client_category: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Company;
    direction: "ascending" | "descending";
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [clientCategories, setClientCategories] = useState<string[]>([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<any>({});
  const [showStatsRows, setShowStatsRows] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      const { data, error } = await supabase
        .from("PasswordChecker")
        .select("*")
        .order("id");

      if (error) {
        console.error("Error fetching reports:", error);
      } else {
        setCompanies(data || []);
        setFilteredCompanies(data || []);

        // Extract unique client categories
        const categories = [
          ...new Set(data?.map((item) => item.client_category).filter(Boolean)),
        ];
        setClientCategories(categories);
      }
    };

    fetchReports();
  }, []);

  // Filter and sort companies whenever search term, sort config or categoryFilters changes
  useEffect(() => {
    let result = [...companies];

    // Apply client category/status filter
    if (Object.keys(categoryFilters).length > 0) {
      result = result.filter((company) => {
        // For each category, check if any status is checked
        return Object.entries(categoryFilters).some(([cat, statuses]) => {
          if (!company.client_category) return false;
          if (cat === "all") return Object.values(statuses).some(Boolean); // "All Categories" checked
          if (company.client_category.toLowerCase() !== cat) return false;
          return Object.entries(statuses).some(([status, checked]) => checked);
        });
      });
    }

    // Apply search filter
    if (searchTerm) {
      const lowercasedSearch = searchTerm.toLowerCase();
      result = result.filter(
        (company) =>
          company.company_name?.toLowerCase().includes(lowercasedSearch) ||
          company.kra_pin?.toLowerCase().includes(lowercasedSearch) ||
          company.status?.toLowerCase().includes(lowercasedSearch) ||
          company.client_category?.toLowerCase().includes(lowercasedSearch)
      );
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        if (!a[sortConfig.key] && !b[sortConfig.key]) return 0;
        if (!a[sortConfig.key]) return 1;
        if (!b[sortConfig.key]) return -1;

        const aValue = a[sortConfig.key].toString().toLowerCase();
        const bValue = b[sortConfig.key].toString().toLowerCase();

        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredCompanies(result);
  }, [companies, searchTerm, sortConfig, categoryFilters]);

  const handleSort = (key: keyof Company) => {
    let direction: "ascending" | "descending" = "ascending";

    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }

    setSortConfig({ key, direction });
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
  };

  const handleSave = async (updatedCompany: Company) => {
    const { id, ...updateData } = updatedCompany;
    const { error } = await supabase
      .from("PasswordChecker")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("Error updating company:", error);
    } else {
      setCompanies(
        companies.map((c) => (c.id === updatedCompany.id ? updatedCompany : c))
      );
      setEditingCompany(null);
    }
  };

  const handleAddCompany = async () => {
    const { data, error } = await supabase
      .from("PasswordChecker")
      .insert([newCompany])
      .select();

    if (error) {
      console.error("Error adding company:", error);
    } else {
      setCompanies([...companies, data[0]]);
      setNewCompany({
        company_name: "",
        kra_pin: "",
        kra_password: "",
        client_category: "",
      });
    }
  };

  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Password Check Reports");

    // Add headers starting from B2
    const headers = [
      "Index",
      "Company Name",
      "KRA PIN",
      "KRA Password",
      "Status",
      "Last Checked",
      "Client Category",
    ];

    worksheet.addRow([]); // Create empty first row
    const headerRow = worksheet.getRow(2);
    headers.forEach((header, i) => {
      headerRow.getCell(i + 2).value = header; // Start from column B
    });

    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFF00" },
      };
    });

    // Add data starting from row 3 (B3 onwards)
    filteredCompanies.forEach((company, index) => {
      const row = worksheet.addRow([
        "", // Empty cell in column A
        index + 1, // Index in B
        company.company_name, // Company Name in C
        company.kra_pin, // KRA PIN in D
        company.kra_password, // KRA Password in E
        formatStatusDisplay(company.status), // Status in F (formatted)
        company.last_checked
          ? new Date(company.last_checked).toLocaleString()
          : "Missing", // Last Checked in G
        company.client_category || "N/A", // Client Category in H
      ]);

      // Center-align the index column (column B)
      row.getCell(2).alignment = { horizontal: "center" };

      // Set status cell background color
      const statusCell = row.getCell(6); // Status is in column F (6th column)
      const formattedStatus = formatStatusDisplay(company.status);
      if (formattedStatus === "Valid") {
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF90EE90" }, // Light green for valid
        };
      } else if (formattedStatus === "Invalid Password") {
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF6347" }, // Tomato red for invalid password
        };
      } else {
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFD700" }, // Gold for other statuses (Error)
        };
      }
    });

    // Auto-fit columns based on their content
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? cell.value.toString().length : 10;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      column.width = maxLength + 2; // Add padding for better readability
    });

    // Add borders to all cells, except column A (empty column)
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > 1) {
          // Skip borders for column A
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      });
    });

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = "password_check_reports.xlsx";
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
  };

  const getSortIcon = (key: keyof Company) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortConfig.direction === "ascending" ? (
      <ArrowUpDown className="h-4 w-4 ml-1 text-blue-500" />
    ) : (
      <ArrowUpDown className="h-4 w-4 ml-1 text-blue-500 transform rotate-180" />
    );
  };

  // Function to format status display
  const formatStatusDisplay = (status: string): string => {
    if (!status) return "Error";

    const statusLower = status.toLowerCase();

    if (statusLower === "valid") return "Valid";
    if (statusLower === "invalid password" || statusLower === "invalid")
      return "Invalid Password";

    // If status has more than 3 words, display as "Error"
    const wordCount = status
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    if (wordCount > 3) return "Error";

    return "Error";
  };

  // Calculate statistics for complete and missing entries
  const calculateStats = () => {
    const stats = {
      complete: {},
      missing: {}
    };

    // Define fields to check for completeness
    const fieldsToCheck = [
      'company_name',
      'kra_pin',
      'kra_password',
      'status',
      'last_checked',
      'client_category'
    ];

    // Initialize stats for each field
    fieldsToCheck.forEach(field => {
      stats.complete[field] = 0;
      stats.missing[field] = 0;
    });

    // Calculate stats for each field individually
    filteredCompanies.forEach(company => {
      fieldsToCheck.forEach(field => {
        const value = company[field as keyof Company];
        if (value && value.toString().trim() !== '') {
          stats.complete[field]++;
        } else {
          stats.missing[field]++;
        }
      });
    });

    return stats;
  };

  const stats = calculateStats();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Password Check Reports</h3>
        <div className="flex space-x-2">
          
          {/* Search and filter controls */}
          <div className="relative flex-grow">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setFilterDialogOpen(true)}>
              <Filter className="h-4 w-4 mr-2" />
              Category Filter
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowStatsRows(!showStatsRows)}
            >
              {showStatsRows ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showStatsRows ? 'Hide Stats' : 'Show Stats'}
            </Button>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm">Add New Company</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add New Company</SheetTitle>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={newCompany.company_name}
                    onChange={(e) =>
                      setNewCompany({
                        ...newCompany,
                        company_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="kra_pin">KRA PIN</Label>
                  <Input
                    id="kra_pin"
                    value={newCompany.kra_pin}
                    onChange={(e) =>
                      setNewCompany({ ...newCompany, kra_pin: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="kra_password">KRA Password</Label>
                  <Input
                    id="kra_password"
                    type="password"
                    value={newCompany.kra_password}
                    onChange={(e) =>
                      setNewCompany({
                        ...newCompany,
                        kra_password: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="client_category">Client Category</Label>
                  <Input
                    id="client_category"
                    value={newCompany.client_category}
                    onChange={(e) =>
                      setNewCompany({
                        ...newCompany,
                        client_category: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    id="status"
                    value={newCompany.status}
                    onValueChange={(value) =>
                      setNewCompany({ ...newCompany, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Valid">Valid</SelectItem>
                      <SelectItem value="Invalid Password">
                        Invalid Password
                      </SelectItem>
                      <SelectItem value="Error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SheetClose asChild>
                <Button size="sm" onClick={handleAddCompany}>
                  Add Company
                </Button>
              </SheetClose>
            </SheetContent>
          </Sheet>
          <ClientCategoryFilter
            isOpen={filterDialogOpen}
            onClose={() => setFilterDialogOpen(false)}
            onApplyFilters={(filters) => {
              setCategoryFilters(filters);
              setFilterDialogOpen(false);
            }}
            onClearFilters={() => {
              setCategoryFilters({});
            }}
            selectedFilters={categoryFilters}
          />
        </div>
        <Button size="sm" onClick={handleDownloadExcel}>
          <Download className="h-4 w-4 mr-2" />
          Download Excel
        </Button>
      </div>

      <div className="rounded-md border flex-1 flex flex-col">
        
        <div className="overflow-x-auto">

          <div className="max-h-[calc(100vh-300px)] overflow-y-auto" style={{overflowY: 'auto'}}>


            <Table className="text-xs pb-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center border-r border-gray-300">Index</TableHead>

                  <TableHead className="border-r border-gray-300">

                    <button
                      className="flex items-center font-semibold"

                      onClick={() => handleSort("company_name")}

                    >
                      Company Name {getSortIcon("company_name")}
                    </button>
                  </TableHead>
                  <TableHead className="text-center border-r border-gray-300">
                    <button
                      className="flex items-center font-semibold justify-center"
                      onClick={() => handleSort("kra_pin")}

                    >
                      KRA PIN {getSortIcon("kra_pin")}
                    </button>
                  </TableHead>
                  <TableHead className="text-center border-r border-gray-300">KRA Password</TableHead>
                  <TableHead className="text-center border-r border-gray-300">
                    <button
                      className="flex items-center font-semibold justify-center"
                      onClick={() => handleSort("status")}
                    >
                      Status {getSortIcon("status")}


                    </button>
                  </TableHead>
                  <TableHead className="text-center border-r border-gray-300">
                    <button
                      className="flex items-center font-semibold justify-center"
                      onClick={() => handleSort("last_checked")}
                    >
                      Last Checked {getSortIcon("last_checked")}
                    </button>
                  </TableHead>
                  <TableHead className="text-center border-r border-gray-300">
                    <button
                      className="flex items-center font-semibold justify-center"
                      onClick={() => handleSort("client_category")}
                    >
                      Client Category {getSortIcon("client_category")}
                    </button>
                  </TableHead>



                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
                {showStatsRows && (
                  <>
                    <TableRow className="bg-gray-100">
                      <TableCell className="text-center text-[10px] font-bold border-r border-gray-300">Complete</TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.complete.company_name === filteredCompanies.length ? 'text-green-600 font-bold' : ''}>
                          {stats.complete.company_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.complete.kra_pin === filteredCompanies.length ? 'text-green-600 font-bold' : ''}>
                          {stats.complete.kra_pin}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.complete.kra_password === filteredCompanies.length ? 'text-green-600 font-bold' : ''}>
                          {stats.complete.kra_password}
                        </span>

                      </TableCell>

                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.complete.status === filteredCompanies.length ? 'text-green-600 font-bold' : ''}>
                          {stats.complete.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.complete.last_checked === filteredCompanies.length ? 'text-green-600 font-bold' : ''}>
                          {stats.complete.last_checked}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.complete.client_category === filteredCompanies.length ? 'text-green-600 font-bold' : ''}>
                          {stats.complete.client_category}
                        </span>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  
                    <TableRow className="bg-gray-50">
                      <TableCell className="text-center text-[10px] font-bold border-r border-gray-300">Missing</TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.missing.company_name > 0 ? 'text-red-600 font-bold' : ''}>
                          {stats.missing.company_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.missing.kra_pin > 0 ? 'text-red-600 font-bold' : ''}>
                          {stats.missing.kra_pin}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.missing.kra_password > 0 ? 'text-red-600 font-bold' : ''}>
                          {stats.missing.kra_password}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.missing.status > 0 ? 'text-red-600 font-bold' : ''}>
                          {stats.missing.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.missing.last_checked > 0 ? 'text-red-600 font-bold' : ''}>
                          {stats.missing.last_checked}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] border-r border-gray-300">
                        <span className={stats.missing.client_category > 0 ? 'text-red-600 font-bold' : ''}>
                          {stats.missing.client_category}
                        </span>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company, index) => (
                  <TableRow
                    key={company.id}
                    className={`h-10 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <TableCell className="text-center border-r border-gray-300">{index + 1}</TableCell>
                    <TableCell className="border-r border-gray-300">
                      {company.company_name || (
                        <span className="font-bold text-red-600">Missing</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center border-r border-gray-300">
                      {company.kra_pin || (
                        <span className="font-bold text-red-600">Missing</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center border-r border-gray-300">
                      {company.kra_password || (
                        <span className="font-bold text-red-600">Missing</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center border-r border-gray-300">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          formatStatusDisplay(company.status)
                        )}`}
                      >
                        {formatStatusDisplay(company.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center border-r border-gray-300">
                      {company.last_checked ? (
                        new Date(company.last_checked).toLocaleString()
                      ) : (
                        <span className="font-bold text-red-600">Missing</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center border-r border-gray-300">
                      {company.client_category || (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center border-r border-gray-300">
                      <div className="flex justify-center space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(company)}
                            >
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Company</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="company_name">
                                  Company Name
                                </Label>
                                <Input
                                  id="company_name"
                                  value={editingCompany?.company_name}
                                  onChange={(e) =>
                                    setEditingCompany({
                                      ...editingCompany,
                                      company_name: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="kra_pin">KRA PIN</Label>
                                <Input
                                  id="kra_pin"
                                  value={editingCompany?.kra_pin}
                                  onChange={(e) =>
                                    setEditingCompany({
                                      ...editingCompany,
                                      kra_pin: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="kra_password">
                                  KRA Password
                                </Label>
                                <Input
                                  id="kra_password"
                                  value={editingCompany?.kra_password}
                                  onChange={(e) =>
                                    setEditingCompany({
                                      ...editingCompany,
                                      kra_password: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                  value={formatStatusDisplay(
                                    editingCompany?.status
                                  )}
                                  onValueChange={(value) =>
                                    setEditingCompany({
                                      ...editingCompany,
                                      status: value,
                                    })
                                  }
                                >
                                  <SelectTrigger id="status">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Valid">Valid</SelectItem>
                                    <SelectItem value="Invalid Password">
                                      Invalid Password
                                    </SelectItem>
                                    <SelectItem value="Error">Error</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2 col-span-2">
                                <Label htmlFor="client_category">
                                  Client Category
                                </Label>
                                <Input
                                  id="client_category"
                                  value={editingCompany?.client_category}
                                  onChange={(e) =>
                                    setEditingCompany({
                                      ...editingCompany,
                                      client_category: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <DialogClose asChild>
                              <Button
                                onClick={() => handleSave(editingCompany)}
                              >
                                Save Changes
                              </Button>
                            </DialogClose>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {/* Spacer row to ensure last items are visible */}
              <tr><td className="py-4"></td></tr>
            </Table>
          </div>
        </div>
      </div>
      <style jsx>{`
        .overflow-x-auto {
          overflow-x: auto
        }
        .overflow-y-auto {
          overflow-y: auto
        }
        .max-h-[calc(100vh-300px)] {
          max-height: calc(100vh - 300px)
        }
        thead {
          position: sticky
          top: 0
          z-index: 10
        }
        th {
          background-color: inherit
        }
      `}</style>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Valid":
      return "bg-green-100 text-green-800";
    case "Invalid Password":
      return "bg-red-100 text-red-800";
    case "Error":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
