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

interface WhatsAppModalProps {
  trigger: React.ReactNode;
  companyName: string;
  companyPhone?: string;
  documents: {
    type: string;
    label: string;
    status: "uploaded" | "missing";
    path: string | null;
  }[];
  onMessageSent?: (data: { date: string; recipients: string[] }) => void;
}

export function WhatsAppModal({
  trigger,
  companyName,
  companyPhone: initialCompanyPhone,
  documents = [],
  onMessageSent,
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
      name: string;
      phone: string;
      isSelected: boolean;
    }[]
  >([]);
  const [messageText, setMessageText] = useState("");
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

        const companyDirectors = individualsData
          ?.filter((individual) => {
            const directorships = individual.directorship_history || [];
            return directorships.some(
              (d: any) =>
                d.company_name === companyName && d.position === "Director"
            );
          })
          .map((director, index) => {
            const contactDetails = director.contact_details || {};
            const whatsappNumber = contactDetails.whatsapp || "";

            return {
              id: `director-${index}`,
              name: director.full_name,
              phone: whatsappNumber,
              isSelected: false,
            };
          });

        setDirectorPhones(companyDirectors || []);
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
          message: messageText,
          documentPaths: uploadedDocuments,
          companyName,
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
      <div onClick={() => setIsOpen(true)}>{trigger}</div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[90vw] h-[80vh] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <MessageSquare className="h-6 w-6 text-green-600" />
              Send via WhatsApp
              <span className="text-gray-500 text-lg ml-1">
                • {companyName}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
            {/* Left Column - Recipients */}
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-lg font-semibold">Recipients</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDirectors(!showDirectors)}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  {showDirectors ? "Hide Directors" : "Show Directors"}
                </Button>
              </div>

              {/* Company WhatsApp */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Company WhatsApp</span>
                  </div>
                  <Checkbox
                    checked={companyPhoneData.isSelected}
                    onCheckedChange={(checked) =>
                      setCompanyPhoneData((prev) => ({
                        ...prev,
                        isSelected: !!checked,
                      }))
                    }
                  />
                </div>
                <Input
                  value={companyPhoneData.phone}
                  onChange={(e) =>
                    setCompanyPhoneData((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="+254 XXX XXX XXX"
                  className="border-gray-200"
                />
              </div>

              {/* Directors - Hidden by default */}
              {showDirectors && (
                <div className="space-y-3">
                  <Label className="text-md font-medium">Directors</Label>
                  {directorPhones.map((director) => (
                    <div
                      key={director.id}
                      className="bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 text-green-600" />
                          <span className="font-medium">{director.name}</span>
                        </div>
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
                        />
                      </div>
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
                        placeholder="+254 XXX XXX XXX"
                        className="border-gray-200"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Message & Documents */}
            <div className="overflow-y-auto pr-4 space-y-4">
              {/* Documents Section */}
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-semibold">Documents</Label>
                  <Badge className="bg-green-100 text-green-700">
                    {documents.filter((d) => d.status === "uploaded").length}{" "}
                    Files Ready
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
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
