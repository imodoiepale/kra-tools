"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Paperclip, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

const formSchema = z.object({
  to: z.string().email("Please enter a valid email"),
  cc: z.string().email("Please enter a valid email").optional(),
  bcc: z.string().email("Please enter a valid email").optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

interface ContactModalProps {
  trigger?: React.ReactNode;
  companyName?: string;
  companyEmail?: string;
  documents?: Array<{
    type: string;
    label: string;
    path: string | null;
  }>;
}

class EmailService {
  private apiUrl: string;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(apiUrl: string, retryAttempts = 3, retryDelay = 1000) {
    this.apiUrl = apiUrl;
    this.retryAttempts = retryAttempts;
    this.retryDelay = retryDelay;
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<Response> {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response;
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await this.delay(this.retryDelay * attempt);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  async sendEmail({
    to,
    cc,
    bcc,
    subject,
    message,
    attachments = []
  }: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    message: string;
    attachments?: File[];
  }) {
    try {
      if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your connection and try again.');
      }

      const formData = new FormData();
      
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('message', message);
      
      if (cc) formData.append('cc', cc);
      if (bcc) formData.append('bcc', bcc);
      
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await this.fetchWithRetry(this.apiUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Error sending email:', error);
      let errorMessage = 'Failed to send email. ';
      
      if (!navigator.onLine) {
        errorMessage += 'Please check your internet connection.';
      } else if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again later.';
      }
      
      throw new Error(errorMessage);
    }
  }
}

const emailService = new EmailService('https://mail-notifications.onrender.com/api/send-notification');

export default function ContactModal({ trigger, companyName, companyEmail, documents = [] }: ContactModalProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      to: companyEmail || "",
      cc: "",
      bcc: "",
      subject: `Documents for ${companyName || 'your company'}`,
      message: "",
    },
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Combine selected files with document attachments
      const attachments = [...selectedFiles];
      
      // Add uploaded documents if they exist
      for (const doc of documents) {
        if (doc.path) {
          try {
            const response = await fetch(doc.path);
            const blob = await response.blob();
            const file = new File([blob], `${doc.label}.pdf`, { type: 'application/pdf' });
            attachments.push(file);
          } catch (error) {
            console.error(`Error loading document ${doc.label}:`, error);
            throw new Error(`Failed to load document: ${doc.label}`);
          }
        }
      }

      await emailService.sendEmail({
        ...data,
        attachments
      });
      
      toast.success("Email sent successfully!");
      setOpen(false);
      form.reset();
      setSelectedFiles([]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline">Send Email</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Send Email to {companyName}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <Input placeholder="recipient@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CC</FormLabel>
                    <FormControl>
                      <Input placeholder="cc@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bcc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BCC</FormLabel>
                    <FormControl>
                      <Input placeholder="bcc@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Type your message here..." 
                      className="min-h-[200px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={!navigator.onLine}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Add Attachments
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={!navigator.onLine}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                  <Badge key={`selected-${index}`} variant="secondary">
                    {file.name}
                  </Badge>
                ))}
                {documents.map((doc, index) => (
                  doc.path && (
                    <Badge key={`doc-${index}`} variant="secondary">
                      {doc.label}
                    </Badge>
                  )
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !navigator.onLine}
              >
                {isSubmitting ? "Sending..." : "Send Email"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
