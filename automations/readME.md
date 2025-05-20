### Deployment Instructions for Render

1. **Create a Git Repository**:

   - Push all your code to a Git repository (GitHub, GitLab, etc.)
2. **Sign in to Render**:

   - Go to https://dashboard.render.com/
   - Sign in or create an account
3. **Create a New Web Service**:

   - Click "New" and select "Web Service"
   - Connect your Git repository
   - Choose the branch you want to deploy
4. **Configure Your Service**:

   - Name: `kra-automations`
   - Environment: `Docker`
   - Region: Choose the closest region to your users (e.g., Frankfurt for EU)
   - Instance Type: Choose appropriate instance size (at least 1GB RAM recommended)
   - Set Environment Variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `MAX_CONCURRENT_WORKERS`
5. **Deploy**:

   - Click "Create Web Service"
   - Render will build and deploy your service
   - You can monitor the deployment in the logs
6. **Access Your Service**:

   - Once deployed, your service will be available at `https://kra-automations.onrender.com` (or a similar URL)
   - Test the health endpoint: `https://kra-automations.onrender.com/health`
7. **Update Your Frontend**:

   - Update your front-end application to call the new API endpoints:

   ```javascript
   const apiUrl = 'https://kra-automations.onrender.com/api/automation';

   // Start the PIN Checker automation
   fetch(apiUrl, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       automation: 'pin-checker',
       action: 'start',
       runOption: 'all'
     })
   });

   // Check progress
   fetch(apiUrl, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       automation: 'pin-checker',
       action: 'getProgress'
     })
   });
   ```
