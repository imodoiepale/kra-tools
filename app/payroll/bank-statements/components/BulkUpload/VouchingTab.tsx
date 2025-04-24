// components/BankStatements/BulkUpload/VouchingTab.tsx
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CompanyGroup, BulkUploadItem } from './types';
import CompanyGroupItem from './CompanyGroupItem';

interface VouchingTabProps {
    value: string;
    companyGroups: CompanyGroup[];
    setActiveTab: React.Dispatch<React.SetStateAction<string>>;
    onClose: () => void;
    onUploadsComplete?: () => void;
    toggleCompanyExpansion: (companyId: number) => void;
    markCompanyVouched: (companyId: number, isVouched: boolean) => void;
    vouchingChecked: { [key: string]: boolean };
    setVouchingChecked: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
    vouchingNotes: { [key: string]: string };
    setVouchingNotes: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
    setCurrentProcessingItem: React.Dispatch<React.SetStateAction<BulkUploadItem | null>>;
    setShowExtractionDialog: React.Dispatch<React.SetStateAction<boolean>>;
    pdfUrls: Record<string, string>;
    setUploadItems: React.Dispatch<React.SetStateAction<BulkUploadItem[]>>;
}

export default function VouchingTab({
    value,
    companyGroups,
    setActiveTab,
    onClose,
    onUploadsComplete,
    toggleCompanyExpansion,
    markCompanyVouched,
    vouchingChecked,
    setVouchingChecked,
    vouchingNotes,
    setVouchingNotes,
    setCurrentProcessingItem,
    setShowExtractionDialog,
    pdfUrls,
    setUploadItems
}: VouchingTabProps) {
    return (
        <TabsContent value={value} className="flex-1 flex flex-col overflow-auto p-2">
            <div className="h-full overflow-y-auto">
                {companyGroups.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground">
                        No statements available for vouching
                    </div>
                ) : (
                    <div className="space-y-3">
                        {companyGroups.map((group) => (
                            <CompanyGroupItem
                                key={group.companyId}
                                group={group}
                                toggleCompanyExpansion={toggleCompanyExpansion}
                                markCompanyVouched={markCompanyVouched}
                                vouchingChecked={vouchingChecked}
                                setVouchingChecked={setVouchingChecked}
                                vouchingNotes={vouchingNotes}
                                setVouchingNotes={setVouchingNotes}
                                setCurrentProcessingItem={setCurrentProcessingItem}
                                setShowExtractionDialog={setShowExtractionDialog}
                                pdfUrls={pdfUrls}
                                setUploadItems={setUploadItems}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-between">
                <Button
                    variant="outline"
                    onClick={() => setActiveTab('review')}
                >
                    Back to Review
                </Button>

                <Button
                    variant="default"
                    onClick={() => {
                        onClose();
                        onUploadsComplete?.();
                    }}
                >
                    Complete Vouching
                </Button>
            </div>
        </TabsContent>
    );
}