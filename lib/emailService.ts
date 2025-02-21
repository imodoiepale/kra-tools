export class EmailService {
    private apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    async sendEmail({
        to,
        cc,
        bcc,
        subject,
        message,
        attachments = []
    }: {
        to: string | string[];
        cc?: string | string[];
        bcc?: string | string[];
        subject?: string;
        message: string;
        attachments?: File[];
    }) {
        try {
            const formData = new FormData();

            // Handle multiple recipients
            if (Array.isArray(to)) {
                formData.append('to', to.join(','));
            } else {
                formData.append('to', to);
            }

            // Handle CC recipients
            if (cc) {
                if (Array.isArray(cc)) {
                    formData.append('cc', cc.join(','));
                } else {
                    formData.append('cc', cc);
                }
            }

            // Handle BCC recipients
            if (bcc) {
                if (Array.isArray(bcc)) {
                    formData.append('bcc', bcc.join(','));
                } else {
                    formData.append('bcc', bcc);
                }
            }

            formData.append('subject', subject || 'New Notification');
            formData.append('message', message);

            attachments.forEach(file => {
                formData.append('attachments', file);
            });

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send email');
            }

            return result;

        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }
}
