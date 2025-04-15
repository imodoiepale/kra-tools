// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import {
  Phone,
  User,
  Building2,
  AlertCircle,
  FileText,
  Send,
  MessageSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppService, WhatsAppAttachment } from "@/lib/WhatsAppService";
import { format } from "date-fns";

interface WhatsAppModalProps {
  trigger: React.ReactNode;
  companyName: string;
  companyPhone?: string;
  month?: string;
  year?: string;
  documents: {
    type: string;
    label: string;
    status: "uploaded" | "missing";
    path: string | null;
  }[];
  onMessageSent?: (data: { date: string; recipients: string[] }) => void;
  messageHistory?: { date: string; recipients: string[] }[];
}

const DOCUMENT_LABELS: Record<string, string> = {
  paye_receipt: "PAYE PAYMENT RECEIPT",
  housing_levy_receipt: "HOUSING PAYMENT LEVY RECEIPT",
  nita_receipt: "NITA PAYMENT RECEIPT",
  shif_receipt: "SHIF PAYMENT RECEIPT",
  nssf_receipt: "NSSF PAYMENT RECEIPT",
  all_csv: "All CSV Files"
};

export function WhatsAppModal({
  trigger,
  companyName,
  companyPhone: initialCompanyPhone,
  month,
  year,
  documents,
  onMessageSent,
  messageHistory,
}: WhatsAppModalProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [companyPhoneData, setCompanyPhoneData] = useState({
    phone: initialCompanyPhone || "",
    isSelected: false,
  });
  const [directorPhones, setDirectorPhones] = useState<
    {
      id: string;
      fullName: string;
      phone: string;
      isSelected: boolean;
    }[]
  >([]);
  const [messageText, setMessageText] = useState(
    `Dear Client,

We are sending you the following payment receipts for ${month} ${year}:
${documents.filter(doc => doc.status === "uploaded").map(doc => `- ${DOCUMENT_LABELS[doc.type] || doc.label}`).join('\n')}

Please find them attached.

Best regards,
Booksmart Consultancy Limited`
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showDirectors, setShowDirectors] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch company WhatsApp number
        if (!initialCompanyPhone) {
          const { data: companyData, error: companyError } = await supabase
            .from("acc_portal_company_duplicate")
            .select("whatsapp_number")
            .eq("company_name", companyName)
            .single();

          if (companyError) throw companyError;
          setCompanyPhoneData({
            phone: companyData?.whatsapp_number || "",
            isSelected: false,
          });
        }

        // Fetch directors with WhatsApp numbers
        const { data: individualsData, error: directorsError } = await supabase
          .from("registry_individuals")
          .select("full_name, contact_details, directorship_history");

        if (directorsError) throw directorsError;

        // Filter and map directors in one step
        const companyDirectors = (individualsData || [])
          .filter((individual) => {
            const directorships = individual.directorship_history || [];
            return directorships.some(
              (d: any) =>
                d.company_name === companyName && d.position === "Director"
            );
          })
          .map((director, index) => ({
            id: `director-${index}`,
            fullName: director.full_name,
            phone: director.contact_details?.whatsapp || "",
            isSelected: false
          }))
          .filter((director) => director.phone);

        setDirectorPhones(companyDirectors);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to fetch company details",
          variant: "destructive",
        });
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, companyName, initialCompanyPhone, toast]);

  const handleSendWhatsApp = async () => {
    try {
      setIsLoading(true);

      const selectedPhones = [
        ...(companyPhoneData.isSelected ? [companyPhoneData.phone] : []),
        ...directorPhones.filter((d) => d.isSelected).map((d) => d.phone),
      ];

      if (selectedPhones.length === 0) {
        throw new Error("Please select at least one recipient");
      }

      const uploadedDocuments = documents.filter(
        (doc) => doc.status === "uploaded"
      );

      if (uploadedDocuments.length === 0) {
        throw new Error("No documents available to send");
      }

      // Use the Meta WhatsApp API endpoint
      const response = await fetch("/api/send-whatsapp-meta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: selectedPhones,
          message: `${messageText}\n\nPeriod: ${month} ${year}`,
          documentPaths: uploadedDocuments.map(doc => ({
            path: doc.path,
            label: DOCUMENT_LABELS[doc.type] || doc.label
          })),
          companyName,
          month,
          year
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send WhatsApp message");
      }

      if (onMessageSent) {
        onMessageSent({
          date: new Date().toISOString(),
          recipients: selectedPhones,
        });
      }

      toast({
        title: "Success",
        description: `Documents sent via WhatsApp to ${selectedPhones.length} recipients`,
      });

      setIsOpen(false);
    } catch (error) {
      console.error("WhatsApp send error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send documents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare className="h-4 w-4" />
        {messageHistory?.length > 0 && (
          <div className="absolute -top-2 -right-2">
            <Badge
              className="h-5 w-5 rounded-full bg-green-500 text-white"
              variant="secondary"
            >
              {messageHistory.length}
            </Badge>
          </div>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[90vw] h-[80vh] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <MessageSquare className="h-6 w-6 text-green-600" />
              Send via WhatsApp
              <span className="text-gray-500 text-lg ml-1">
                • {companyName} • {month} {year}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
            {/* Left Column - Recipients */}
            <div className="space-y-4">
              {/* Recipients Section */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-5 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-600" />
                    <Label className="font-medium text-gray-700">Recipients</Label>
                  </div>
                </div>

                {/* Company WhatsApp */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <Checkbox
                    checked={companyPhoneData.isSelected}
                    onCheckedChange={(checked) =>
                      setCompanyPhoneData((prev) => ({
                        ...prev,
                        isSelected: !!checked,
                      }))
                    }
                    className="border-gray-300"
                  />
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <Input
                    value={companyPhoneData.phone}
                    onChange={(e) =>
                      setCompanyPhoneData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="Company WhatsApp"
                    className="border-0 bg-transparent focus-visible:ring-0"
                  />
                </div>
              </div>

              {/* Directors Section */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-5 bg-white mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-green-600" />
                  <Label className="font-medium text-gray-700">Directors</Label>
                </div>
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                  {directorPhones.length > 0 ? (
                    directorPhones.map((director) => (
                      <div
                        key={director.id}
                        className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={director.isSelected}
                            onCheckedChange={(checked) => {
                              setDirectorPhones((prev) =>
                                prev.map((d) =>
                                  d.id === director.id
                                    ? { ...d, isSelected: !!checked }
                                    : d
                                )
                              );
                            }}
                            className="border-gray-300"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">
                              {director.fullName}
                            </p>
                            <Input
                              value={director.phone}
                              onChange={(e) => {
                                setDirectorPhones((prev) =>
                                  prev.map((d) =>
                                    d.id === director.id
                                      ? { ...d, phone: e.target.value }
                                      : d
                                  )
                                );
                              }}
                              className="mt-1 border-0 bg-transparent focus-visible:ring-0"
                              placeholder="+254 XXX XXX XXX"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Alert className="bg-yellow-50 text-yellow-800 border-yellow-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No directors found for this company
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Message & Documents */}
            <div className="space-y-4">
              {/* Documents Section */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-5 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-600" />
                    <Label className="font-medium text-gray-700">Documents</Label>
                  </div>
                  <Badge className="bg-green-100 text-green-700">
                    {documents.filter((d) => d.status === "uploaded").length} Files Ready
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">{doc.label}</span>
                      </div>
                      <Badge
                        variant={
                          doc.status === "uploaded" ? "success" : "warning"
                        }
                        className={
                          doc.status === "uploaded"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }
                      >
                        {doc.status === "uploaded" ? "Ready" : "Missing"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {messageHistory?.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <Label className="font-medium text-gray-700">Message History</Label>
                  </div>
                  <div className="space-y-2">
                    {messageHistory.map((history, index) => (
                      <div key={index} className="rounded-lg bg-gray-50 p-3">
                        <p className="text-sm font-medium">
                          {format(new Date(history.date), 'dd/MM/yyyy HH:mm')}
                        </p>
                        <p className="text-sm text-gray-500">
                          To: {history.recipients.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t mt-4 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={
                isLoading ||
                (!companyPhoneData.isSelected &&
                  !directorPhones.some((d) => d.isSelected))
              }
              className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send via WhatsApp
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
