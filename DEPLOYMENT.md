# Deploying the Quiz Generator Edge Function

This guide explains how to deploy the Quiz Generator Edge Function to your Supabase project.

## Prerequisites

1. Install Supabase CLI:

   ```bash
   # Using npm
   npm install -g supabase

   # Using Homebrew (macOS)
   brew install supabase/tap/supabase
   ```

2. Log in to Supabase CLI:

   ```bash
   supabase login
   ```

3. Link your project:

   ```bash
   # Run this from your project root
   supabase link --project-ref your-project-ref
   ```

   You can find your project reference ID in the URL of your Supabase dashboard: `https://supabase.com/dashboard/project/your-project-ref`.

## Setting Up Environment Variables

Before deploying, you need to configure environment variables for the Edge Function:

```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-...

# Supabase service role key and URL should be automatically available
# but you can set them explicitly if needed
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
```

## Deploying the Edge Function

Deploy the function using the Supabase CLI:

```bash
# Navigate to your project directory
cd finlearn

# Deploy the function
supabase functions deploy generate-quiz-questions
```

## Configure CORS Settings (Important)

After deploying the function, you need to configure CORS to allow requests from your app:

```bash
# Allow all origins (for development)
supabase functions config update --function-name generate-quiz-questions --cors-allowed-origins '*'

# OR for production, specify your app's domain
supabase functions config update --function-name generate-quiz-questions --cors-allowed-origins 'https://your-app-domain.com'
```

This step is crucial - without proper CORS configuration, the browser will block requests to your Edge Function.

## Verifying Deployment

After deployment, you can verify that your function is working:

1. Check the function in the Supabase Dashboard under "Edge Functions"
2. Test the function directly from the admin interface in your app
3. Check the browser console for any error messages

## Updating the Function

To update the function after making changes:

```bash
supabase functions deploy generate-quiz-questions
```

## Troubleshooting

### Common Issues

1. **"Failed to send a request to the Edge Function"**:
   - Check if the function is deployed
   - Verify CORS is configured correctly
   - Make sure your Supabase URL is correct in your environment variables
   - Try using the direct fetch approach as a fallback

2. **Authentication Issues**:
   - Ensure the user has admin role in the profiles table
   - Check if the JWT token is being passed correctly

3. **OpenAI API Issues**:
   - Verify your OpenAI API key is set correctly in Supabase secrets
   - Check if you have billing set up for the OpenAI API

### Checking Logs

The best way to debug Edge Function issues is to check the logs:

```bash
supabase functions logs generate-quiz-questions
```

### Testing Locally

You can test the Edge Function locally before deployment:

```bash
supabase start
supabase functions serve generate-quiz-questions --env-file .env.local
```

Make sure your .env.local file has the necessary environment variables.

## Security Considerations

- The Edge Function authenticates users and verifies they have the admin role
- The OpenAI API key is stored securely as an environment variable
- Always use HTTPS for production deployments
- Consider limiting CORS to specific domains in production 