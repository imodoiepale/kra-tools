// pages/api/send-whatsapp-meta.js
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { MetaWhatsAppAPI } from '@/lib/metaWhatsAppAPI';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipients, message, documentPaths, companyName } = req.body;

    // Validate required fields
    if (!recipients?.length || !documentPaths?.length) {
      return res.status(400).json({ 
        error: 'Missing required fields: recipients and documentPaths are required' 
      });
    }

    // Initialize Meta WhatsApp API
    const whatsappAPI = new MetaWhatsAppAPI({
      accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID,
    });

    // Format the message text
    const messageText = `
*${companyName} - Documents*

${message}

*Attached Documents:*
${documentPaths.map(doc => `• ${doc.label}`).join("\n")}

_Sent by Booksmart Consultancy_
📱 +254 700 298 298
`;

    // Send initial message to all recipients
    const messageResults = await Promise.all(
      recipients.map(recipient => 
        whatsappAPI.sendTextMessage(recipient, messageText)
      )
    );

    // Create public URLs for each document or use existing ones
    const documentResults = [];
    for (const doc of documentPaths) {
      if (!doc.path) continue;

      // Generate a signed URL for the document
      const { data: urlData, error: urlError } = await supabase.storage
        .from("Payroll-Cycle")
        .createSignedUrl(doc.path, 60 * 60); // 1 hour expiry

      if (urlError) throw urlError;

      // Send document to all recipients
      const results = await whatsappAPI.broadcastDocument(
        recipients,
        urlData.signedUrl,
        doc.label,
        doc.label
      );

      documentResults.push({
        document: doc.label,
        results
      });
    }

    return res.status(200).json({
      success: true,
      messageResults,
      documentResults,
      message: `Successfully sent WhatsApp messages to ${recipients.length} recipients`
    });
  } catch (error) {
    console.error('Meta WhatsApp API error:', error);
    return res.status(500).json({
      error: 'Failed to send WhatsApp message',
      details: error.response?.data?.error?.message || error.message || String(error)
    });
  }
}