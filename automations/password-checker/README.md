# Password Checker Automation with n8n Integration

This module provides a scalable password checker automation service designed to be deployed on Railway with n8n webhook integration. The system supports running up to 20 parallel containers to significantly speed up the automation process.

## Architecture

- **Webhook API**: Exposes endpoints that n8n can call to trigger automations
- **Worker**: Processes batches of companies to check KRA passwords
- **Callback System**: Reports results back to n8n for workflow orchestration
- **Docker Containers**: Each container runs independently with its own worker ID

## Prerequisites

- Railway account for deployment
- n8n instance for workflow orchestration
- Supabase project with the necessary tables

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
DOWNLOAD_FOLDER=/tmp/downloads
BATCH_SIZE=5
```

## API Endpoints

### 1. Health Check
- **URL**: `/health`
- **Method**: `GET`
- **Description**: Checks if the service is running properly

### 2. Password Checker Webhook
- **URL**: `/webhook/password-checker`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "startIndex": 0,
    "batchSize": 5,
    "totalCompanies": 100,
    "n8nWorkflowId": "workflow-123",
    "callbackUrl": "https://your-n8n-instance.com/webhook/callback"
  }
  ```
- **Description**: Processes a batch of companies starting from the specified index

### 3. Company Count
- **URL**: `/companies/count`
- **Method**: `GET`
- **Description**: Returns the total number of companies in the database

## Railway Deployment

1. Push your code to a GitHub repository
2. Connect your Railway account to GitHub
3. Create a new project in Railway and select your repository
4. Add the required environment variables
5. Configure the service to use the Dockerfile at `automations/password-checker/Dockerfile`
6. Deploy your service
7. Scale to multiple instances (up to 20) in Railway

## n8n Workflow Setup

1. Create a new workflow in n8n
2. Add a trigger (e.g., Schedule or Manual)
3. Add an HTTP Request node to get the total company count:
   - Method: GET
   - URL: https://your-railway-service.up.railway.app/companies/count

4. Add a Loop node to divide the work into batches:
   - Set batch size (e.g., 5)
   - Calculate number of iterations based on total company count

5. For each iteration, add an HTTP Request node:
   - Method: POST
   - URL: https://your-railway-service.up.railway.app/webhook/password-checker
   - Body:
     ```json
     {
       "startIndex": "={{$node['Loop'].iteration * 5}}",
       "batchSize": 5,
       "totalCompanies": "={{$node['Get Count'].json.count}}",
       "n8nWorkflowId": "{{$workflow.id}}",
       "callbackUrl": "https://your-n8n-instance.com/webhook/password-checker-callback"
     }
     ```

6. Add a Webhook node to receive callbacks:
   - Set the webhook path to `/webhook/password-checker-callback`

7. Add logic to track completion and handle errors

## Local Development

To run the service locally:

```bash
cd automations/password-checker
docker-compose up -d
```

This will start a single container. Uncomment additional services in the docker-compose.yml file to test with multiple containers.

## Monitoring

- Check the Railway logs for each container
- Use the n8n workflow execution history to track overall progress
- Generate Excel reports for each batch in the specified download folder
