
export interface WhatsAppAttachment {
    file: File;
    type: string;
    name: string;
  }
  
  interface WhatsAppConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  }
  
  interface WhatsAppMessage {
    to: string;
    text: string;
    attachments?: WhatsAppAttachment[];
  }
  
  export class WhatsAppService {
    private config: WhatsAppConfig;
  
    constructor(config: WhatsAppConfig) {
      this.config = config;
    }
  
    formatPhoneNumber(phone: string): string {
      const digits = phone.replace(/[^0-9]/g, '');
      if (digits.startsWith('0')) {
        return '254' + digits.substring(1);
      }
      if (!digits.startsWith('254')) {
        return '254' + digits;
      }
      return digits;
    }
  
    async validateAttachment(file: WhatsAppAttachment): Promise<boolean> {
      const MAX_SIZE = 16 * 1024 * 1024; // 16MB
      const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  
      if (file.file.size > MAX_SIZE) {
        throw new Error(`File ${file.name} exceeds WhatsApp's 16MB limit`);
      }
  
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`File type ${file.type} not supported by WhatsApp`);
      }
  
      return true;
    }
  
    async sendMessage(message: WhatsAppMessage): Promise<any> {
      try {
        const formData = new FormData();
        formData.append('To', `whatsapp:+${this.formatPhoneNumber(message.to)}`);
        formData.append('From', `whatsapp:+${this.config.fromNumber}`);
        formData.append('Body', message.text);
  
        if (message.attachments) {
          for (const attachment of message.attachments) {
            await this.validateAttachment(attachment);
            formData.append('MediaUrl', URL.createObjectURL(attachment.file));
          }
        }
  
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${this.config.accountSid}:${this.config.authToken}`)
          },
          body: formData
        });
  
        if (!response.ok) {
          throw new Error(`WhatsApp API error: ${response.statusText}`);
        }
  
        return await response.json();
      } catch (error) {
        console.error('WhatsApp sending error:', error);
        throw error;
      }
    }
  }