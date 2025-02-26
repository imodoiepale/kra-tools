// lib/metaWhatsAppAPI.js
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export class MetaWhatsAppAPI {
  constructor(config) {
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    this.version = config.version || 'v17.0';
    this.baseUrl = `https://graph.facebook.com/${this.version}/${this.phoneNumberId}`;
  }

  // Send a text message
  async sendTextMessage(to, text) {
    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/messages`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            body: text
          }
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error sending text message:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send a document message
  async sendDocument(to, documentUrl, caption, filename) {
    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/messages`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'document',
          document: {
            link: documentUrl,
            caption: caption || '',
            filename: filename || 'document'
          }
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error sending document:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send messages to multiple recipients
  async broadcastDocument(recipients, documentUrl, caption, filename) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendDocument(recipient, documentUrl, caption, filename);
        results.push({
          recipient,
          success: true,
          messageId: result.messages?.[0]?.id
        });
      } catch (error) {
        results.push({
          recipient,
          success: false,
          error: error.response?.data?.error?.message || error.message
        });
      }
    }
    
    return results;
  }

  // Upload media to Facebook servers (if you need to upload files directly)
  async uploadMedia(filePath, type) {
    try {
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('file', fs.createReadStream(filePath));
      formData.append('type', type);
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/media`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          ...formData.getHeaders()
        },
        data: formData
      });
      
      return response.data;
    } catch (error) {
      console.error('Error uploading media:', error.response?.data || error.message);
      throw error;
    }
  }
}