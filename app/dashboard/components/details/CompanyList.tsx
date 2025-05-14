// app/dashboard/components/details/CompanyList.tsx

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Company } from "../../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getStatusColor, formatStatus, formatDateRelative } from "../../utils/sampleData";

interface CompanyListProps {
    companies: Company[];
    selectedCompanies: Set<string>;
    onSelectionChange: (companyId: string, isSelected: boolean) => void;
}

export function CompanyList({
    companies,
    selectedCompanies,
    onSelectionChange
}: CompanyListProps) {
    if (companies.length === 0) {
        return (
            <div className="text-center py-8 border rounded-lg bg-gray-50">
                <p className="text-gray-500">No companies found</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-60 border rounded-lg">
            <div className="p-4 space-y-2">
                {companies.map((company) => {
                    const statusColors = getStatusColor(company.status);
                    const isSelected = selectedCompanies.has(company.id);

                    return (
                        <div key={company.id} className="flex items-center space-x-2 py-2 border-b last:border-0">
                            <Checkbox
                                id={`company-${company.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => onSelectionChange(company.id, checked === true)}
                            />
                            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                                <label
                                    htmlFor={`company-${company.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                    {company.name}
                                </label>
                                <div className="flex items-center gap-2 mt-1 sm:mt-0">
                                    <span className="text-xs text-gray-500">
                                        {formatDateRelative(company.last_run)}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={`${statusColors.bg} ${statusColors.text} border-0`}
                                    >
                                        {formatStatus(company.status)}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}