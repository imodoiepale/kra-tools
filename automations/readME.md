# KRA Automation Services with Parallel Processing

## Overview

This system provides scalable automation services for various KRA-related tasks using a unified Docker setup that can be deployed on Railway. The system supports running multiple parallel containers to significantly speed up the automation processes via n8n webhook integration.

## Key Features

- **Unified Docker Image**: Single Docker image that can run any automation type based on environment variables
- **Parallel Processing**: Support for running up to 20 parallel containers per automation type
- **n8n Integration**: Webhook endpoints for n8n to trigger automations and receive callbacks
- **Distributed Workload**: Each container processes a batch of companies independently
- **Health Monitoring**: Health check endpoints for container orchestration

## Available Automations

- **Password Checker**: Validates KRA portal passwords for companies
- **PIN Checker**: Validates KRA PINs for companies
- **Manufacturer Details**: Extracts manufacturer information from KRA portal

## Deployment Instructions for Railway

### Prerequisites

- GitHub repository with your code
- Railway account (https://railway.app)
- n8n instance for workflow orchestration
- Supabase project with required tables

### 1. **Prepare Your Repository**

- Push your code to a GitHub repository
- Ensure the Dockerfile in the automations directory is updated

### 2. **Sign in to Railway**

- Go to https://railway.app
- Sign in or create an account

### 3. **Create a New Project**

- Click "New Project"
- Select "Deploy from GitHub repo"
- Connect your GitHub repository
- Choose the repository containing your automations

### 4. **Configure Your Services**

Create multiple services for parallel processing:

#### Main Server

- Name: `kra-automations-main`
- Root Directory: `automations`
- Start Command: Override with `/app/start.sh`
- Environment Variables:
  - `AUTOMATION_TYPE=main`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `NODE_ENV=production`

#### Password Checker Workers (Create multiple instances)

For each of the 20 instances:

- Name: `password-checker-1` through `password-checker-20`
- Root Directory: `automations`
- Start Command: Override with `/app/start.sh`
- Environment Variables:
  - `AUTOMATION_TYPE=password-checker`
  - `WORKER_ID=worker-X` (replace X with 1-20)
  - `BATCH_SIZE=5`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `NODE_ENV=production`

### 5. **Set Up n8n Integration**

#### Create n8n Workflow for Password Checker

1. **Create a new workflow in n8n**

2. **Add a Schedule Trigger**
   - Configure it to run at your desired intervals
   - Or use Manual Trigger for on-demand execution

3. **Add HTTP Request node to get company count**
   - Method: GET
   - URL: `https://kra-automations-main.up.railway.app/companies/count`

4. **Add a Function node to calculate batches**
   ```javascript
   // Calculate how many batches we need
   const totalCompanies = $input.item.json.count;
   const batchSize = 5;
   const numWorkers = 20;
   const batches = [];
   
   for (let i = 0; i < numWorkers; i++) {
     const startIndex = i * Math.ceil(totalCompanies / numWorkers);
     batches.push({
       startIndex,
       batchSize,
       totalCompanies,
       n8nWorkflowId: $workflow.id,
       callbackUrl: 'https://your-n8n-instance.com/webhook/password-checker-callback'
     });
   }
   
   return { batches };
   ```

5. **Add a SplitInBatches node**
   - Connect it to the Function node
   - Configure it to split the batches array

6. **Add HTTP Request node for each worker**
   - Method: POST
   - URL: `https://password-checker-{{$json["workerNumber"]}}.up.railway.app/webhook/password-checker`
   - Body: `{{$json}}`

7. **Add Webhook node to receive callbacks**
   - Path: `/webhook/password-checker-callback`
   - Method: POST
   - Authentication: None
   - Response Code: 200
   - Response Data: JSON

8. **Add a Function node to track progress**
   ```javascript
   // Process callback data
   const callbackData = $input.item;
   // Save to database or take other actions
   return callbackData;
   ```

### 6. **Testing and Monitoring**

- Monitor the Railway logs for each container
- Use the n8n workflow execution history to track overall progress
- Check the health endpoints of your services

## Local Development

To run the system locally for testing:

```bash
cd automations
docker-compose up -d
```

This will start all the services defined in `docker-compose.yml`. You can modify the file to increase or decrease the number of worker containers.

## API Reference

### Health Check
- **URL**: `/health`
- **Method**: `GET`
- **Description**: Checks if the service is running properly

### Password Checker Webhook
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
- **Description**: Processes a batch of companies for password checking

### Company Count
- **URL**: `/companies/count`
- **Method**: `GET`
- **Description**: Returns the total number of companies in the database
