# Supabase Edge Functions for FinLearn

This directory contains Edge Functions used by the FinLearn application for advanced processing that requires more computational resources or external API access.

## Functions Overview

- **process-pdf**: Analyzes PDF content using OpenAI to generate learning materials (blueprints, lessons, and quizzes)

## Local Development

To develop and test Edge Functions locally:

1. Install the Supabase CLI if you haven't already:
```bash
npm install supabase -g
```

2. Start the local Supabase development server:
```bash
supabase start
```

3. Serve the functions locally:
```bash
supabase functions serve --env-file .env.local
```

4. Test the function with curl:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/process-pdf' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  --header 'Content-Type: application/json' \
  --data '{"pdfData": {...}}'
```

## Environment Variables

The following environment variables need to be set:

- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for database access within the function)

## Deployment

Deploy the Edge Functions to your Supabase project:

```bash
# Deploy all functions
supabase functions deploy

# Deploy a specific function
supabase functions deploy process-pdf
```

Set the required environment variables for the production environment:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_key
supabase secrets set SUPABASE_URL=your_supabase_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Security Considerations

- Edge Functions use JWT verification to ensure the request is coming from an authenticated user
- The database function `create_learning_materials` uses `SECURITY DEFINER` to run with elevated privileges
- Service role keys have full database access, so keep them secure

## Troubleshooting

- Check that your Supabase project has the Edge Functions feature enabled
- Verify that your service role key has the necessary permissions
- Review the logs in the Supabase dashboard under Functions > Logs 