import { useState, useEffect } from "react";
import {
  Mail,
  User,
  Building2,
  AlertCircle,
  FileText,
  Send,
  Loader2,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { EmailService } from "@/lib/emailService";
import { format } from "date-fns";

interface Director {
  fullName: string;
  email: string
  companyName: string;
}

interface ContactModalProps {
  trigger: React.ReactNode;
  companyName: string;
  companyEmail?: string;
  month: string;
  year: string;
  documents: {
    type: string;
    label: string;
    status: "uploaded" | "missing";
    path: string | null;
  }[];
  onEmailSent?: (data: { date: string; recipients: string[]; }) => void;
  emailHistory?: { date: string; recipients: string[] }[];
}

const DOCUMENT_LABELS: Record<string, string> = {
  paye_receipt: "PAYE PAYMENT RECEIPT",
  housing_levy_receipt: "HOUSING PAYMENT LEVY RECEIPT",
  nita_receipt: "NITA PAYMENT RECEIPT",
  shif_receipt: "SHIF PAYMENT RECEIPT",
  nssf_receipt: "NSSF PAYMENT RECEIPT",
  all_csv: "All CSV Files"
};

export function ContactModal({
  trigger,
  companyName,
  companyEmail: initialCompanyEmail,
  month,
  year,
  documents,
  onEmailSent,
  emailHistory = []
}: ContactModalProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [companyEmailData, setCompanyEmailData] = useState({
    email: initialCompanyEmail || "",
    isSelected: false,
  });
  const [directors, setDirectors] = useState<Director[]>([]);
  const [directorEmails, setDirectorEmails] = useState<
    {
      id: string;
      name: string;
      email: string;
      isSelected: boolean;
    }[]
  >([]);
  const [emailData, setEmailData] = useState({
    subject: `Payment Receipts for ${companyName} ${month}, ${year}`,
    message: "",
    cc: "",
    bcc: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  useEffect(() => {
    const fetchCompanyAndDirectors = async () => {
      try {
        // Fetch company email if not provided
        if (!initialCompanyEmail) {
          const { data: companyData, error: companyError } = await supabase
            .from("acc_portal_company_duplicate")
            .select("current_communication_email")
            .eq("company_name", companyName)
            .single();

          if (companyError) throw companyError;
          setCompanyEmailData({
            email: companyData?.current_communication_email || "",
            isSelected: false,
          });
        }

        // Fetch directors
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
          .map((director) => ({
            fullName: director.full_name,
            email: director.contact_details?.email || "",
            companyName: companyName,
          }))
          .filter((director) => director.email);

        setDirectors(companyDirectors);
        
        // Map to director emails format
        setDirectorEmails(
          companyDirectors.map((director, index) => ({
            id: `director-${index}`,
            name: director.fullName,
            email: director.email,
            isSelected: false,
          }))
        );
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
      fetchCompanyAndDirectors();
    }
  }, [isOpen, companyName, toast, initialCompanyEmail]);

  const handleSendEmail = async () => {
    try {
      setIsLoading(true);

      const selectedEmails = [
        ...(companyEmailData.isSelected ? [companyEmailData.email] : []),
        ...directorEmails.filter((d) => d.isSelected).map((d) => d.email),
      ];

      if (selectedEmails.length === 0) {
        throw new Error("Please select at least one recipient");
      }

      const uploadedDocuments = documents.filter(
        (doc) => doc.status === "uploaded"
      );
      if (uploadedDocuments.length === 0) {
        throw new Error("No documents available to send");
      }

      if (uploadedDocuments.length > 5) {
        throw new Error("Cannot send more than 5 documents at once. Please select fewer documents.");
      }

      // Get files from storage
      const attachments: File[] = [];
      let totalSize = 0;
      const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB limit

      for (const doc of uploadedDocuments) {
        if (!doc.path) continue;

        try {
          const { data, error } = await supabase.storage
            .from("Payroll-Cycle")
            .download(doc.path);

          if (error) throw error;

          const filename = doc.path.split("/").pop() || "document";
          const fileSize = data.size;

          // Check if adding this file would exceed the total size limit
          if (totalSize + fileSize > MAX_TOTAL_SIZE) {
            toast({
              title: "Warning",
              description: `Skipping ${doc.label} - Total file size would exceed 10MB limit`,
              variant: "destructive",
            });
            continue;
          }

          const file = new File([data], filename, { type: data.type });
          attachments.push(file);
          totalSize += fileSize;
        } catch (error) {
          console.error(`Failed to download ${doc.label}:`, error);
          toast({
            title: "Warning",
            description: `Failed to attach ${doc.label}`,
            variant: "destructive",
          });
        }
      }

      if (attachments.length === 0) {
        throw new Error("No documents could be prepared for sending. Please try with fewer or smaller files.");
      }

      // Send email using EmailService
      const emailService = new EmailService(
        "https://mail-notifications.onrender.com/api/send-notification"
      );
      await emailService.sendEmail({
        to: selectedEmails,
        cc: emailData.cc ? emailData.cc.split(",").map((e) => e.trim()) : [],
        bcc: emailData.bcc ? emailData.bcc.split(",").map((e) => e.trim()) : [],
        subject: emailData.subject,
        message: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
                        <img src="https://assistant.booksmartportals.com/_next/image?url=%2Fbooksmartlogo.png&w=64&q=75" alt="Booksmart Consultancy Limited" style="max-height: 60px; margin: 20px 0 10px;">
                        <div style="color: #1e40af; margin-bottom: 10px;">Booksmart Consultancy Limited</div>
                        <div style="border-bottom: 1px solid #1e40af; margin: 0 auto 30px;"></div>
                        
                        <p style="color: #374151; margin: 20px 0;">Dear Client,</p>
                        
                        <h1 style="color: #1e40af; font-size: 18px; margin: 20px 0;">Payment Receipts for ${companyName} ${month}, ${year}</h1>
                        
                        ${
                        emailData.message
                            ? `<p style="color: #374151; line-height: 1.6; text-align: left;">${emailData.message}</p>`
                            : ""
                        }
                        
                        <p style="color: #374151; margin: 20px 0 10px; text-align: left;">The following documents are attached:</p>
                        <ul style="color: #374151; margin: 0 0 30px; text-align: left;">
                            ${documents
                            .filter((doc) => doc.status === "uploaded")
                            .map((doc) => `<li style="margin-bottom: 8px;">${DOCUMENT_LABELS[doc.type] || doc.label}</li>`)
                            .join("")}
                        </ul>
                        
                        <div style="background-color: #f3f4f6; padding: 20px; margin-top: 40px; text-align: center;">
                            <p style="color: #4b5563; margin-bottom: 15px;">
                                Booksmart Consultancy Limited<br>
                                Phone: +254 700 298 298<br>
                                Email: <a href="mailto:info@booksmartconsult.com" style="color: #1e40af; text-decoration: none;">info@booksmartconsult.com</a>
                            </p>
                            
                            <div style="margin-top: 15px;">
                                <a href="#" style="color: #1e40af; margin: 0 10px; text-decoration: none;">Website</a>
                                <a href="#" style="color: #1e40af; margin: 0 10px; text-decoration: none;">LinkedIn</a>
                                <a href="#" style="color: #1e40af; margin: 0 10px; text-decoration: none;">Twitter</a>
                                <a href="#" style="color: #1e40af; margin: 0 10px; text-decoration: none;">Facebook</a>
                            </div>
                        </div>
                    </div>
                `,
        attachments,
      });

      try {
        if (onEmailSent) {
          await onEmailSent({
            date: new Date().toISOString(),
            recipients: selectedEmails
          });
        }
      } catch (error) {
        console.error('Error updating email history:', error);
        // Continue with success toast since email was sent successfully
      }

      toast({
        title: "Success",
        description: "Documents sent successfully",
      });

      setIsOpen(false);
    } catch (error) {
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Documents
            </DialogTitle>
            <DialogDescription>
              Send documents to company directors via email.
              {emailHistory && emailHistory.length > 0 && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Last sent:</span>{" "}
                  {format(new Date(emailHistory[emailHistory.length - 1].date), "dd/MM/yyyy HH:mm")} to{" "}
                  {emailHistory[emailHistory.length - 1].recipients.join(", ")}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-4">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Email Section */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-5 bg-white">
                {/* Subject */}
                <div className="mb-4">
                  <Input
                    value={emailData.subject}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        subject: e.target.value,
                      }))
                    }
                    placeholder="Subject"
                    className="text-lg font-medium border-gray-200 focus:border-blue-500"
                  />
                </div>

                {/* Recipients */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700">
                      Recipients
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCcBcc(!showCcBcc)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      {showCcBcc ? "Hide CC/BCC" : "Show CC/BCC"}
                    </Button>
                  </div>

                  {/* Company Email */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Checkbox
                      checked={companyEmailData.isSelected}
                      onCheckedChange={(checked) =>
                        setCompanyEmailData((prev) => ({
                          ...prev,
                          isSelected: !!checked,
                        }))
                      }
                      className="border-gray-300"
                    />
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <Input
                      value={companyEmailData.email}
                      onChange={(e) =>
                        setCompanyEmailData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="Company Email"
                      className="border-0 bg-transparent focus-visible:ring-0"
                    />
                  </div>

                  {/* CC/BCC Fields */}
                  {showCcBcc && (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-500">CC:</Label>
                        <Input
                          value={emailData.cc}
                          onChange={(e) =>
                            setEmailData((prev) => ({
                              ...prev,
                              cc: e.target.value,
                            }))
                          }
                          placeholder="Add CC recipients"
                          className="border-gray-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-500">BCC:</Label>
                        <Input
                          value={emailData.bcc}
                          onChange={(e) =>
                            setEmailData((prev) => ({
                              ...prev,
                              bcc: e.target.value,
                            }))
                          }
                          placeholder="Add BCC recipients"
                          className="border-gray-200"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Directors Section */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-5 bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-blue-600" />
                  <Label className="font-medium text-gray-700">Directors</Label>
                </div>
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                  {directorEmails.length > 0 ? (
                    directorEmails.map((director) => (
                      <div
                        key={director.id}
                        className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={director.isSelected}
                            onCheckedChange={(checked) => {
                              setDirectorEmails((prev) =>
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
                              {director.name}
                            </p>
                            <Input
                              value={director.email}
                              onChange={(e) => {
                                setDirectorEmails((prev) =>
                                  prev.map((d) =>
                                    d.id === director.id
                                      ? { ...d, email: e.target.value }
                                      : d
                                  )
                                );
                              }}
                              className="mt-1 border-0 bg-transparent focus-visible:ring-0"
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

            {/* Right Column */}
            <div className="space-y-5">
              {/* Documents Section */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-5 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <Label className="font-medium text-gray-700">
                      Documents to Send
                    </Label>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                    {documents.filter((d) => d.status === "uploaded").length}/
                    {documents.length} Ready
                  </Badge>
                </div>
                <div className="space-y-2">
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {DOCUMENT_LABELS[doc.type] || doc.label}
                      </span>
                      <Badge
                        variant={
                          doc.status === "uploaded" ? "default" : "secondary"
                        }
                        className={
                          doc.status === "uploaded"
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        }
                      >
                        {doc.status === "uploaded"
                          ? "Ready to Send"
                          : "Missing"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Section */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-5 bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <Label className="font-medium text-gray-700">Preview</Label>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: `
                                          <div style="font-family: Arial, sans-serif; color: #374151;">
                                              <h1 style="color: #1e40af; font-size: 24px; margin-bottom: 20px;">Payment Receipts for ${companyName}</h1>
                                              
                                              ${
                                                emailData.message
                                                  ? `<p style="line-height: 1.6;">${emailData.message}</p>`
                                                  : ""
                                              }
                                              
                                              <p style="margin-top: 20px;">The following documents are attached:</p>
                                              <ul style="margin: 15px 0;">
                                                  ${documents
                                                    .filter(
                                                      (doc) =>
                                                        doc.status ===
                                                        "uploaded"
                                                    )
                                                    .map(
                                                      (doc) =>
                                                        `<li style="margin-bottom: 8px;">${DOCUMENT_LABELS[doc.type] || doc.label}</li>`
                                                    )
                                                    .join("")}
                                              </ul>
                                          </div>
                                      `,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 mt-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={
                isLoading ||
                (!companyEmailData.isSelected &&
                  !directorEmails.some((d) => d.isSelected))
              }
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  {emailHistory && emailHistory.length > 0 ? "Resend Documents" : "Send Documents"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
