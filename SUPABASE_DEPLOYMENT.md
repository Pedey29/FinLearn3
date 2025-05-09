# Deploying Supabase Changes

This guide provides step-by-step instructions to deploy your Supabase project changes, including database schema, functions, and configurations.

## Prerequisites

1. Docker Desktop: Ensure Docker Desktop is installed and running on your machine
2. Supabase CLI: Install using npm in your project

```bash
# Install as a dev dependency in your project
npm install supabase --save-dev
```

## Setting Up Environment Variables

Create a `.env.local` file in your project root with the following variables:

```
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Other environment variables
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Replace the placeholder values with your actual Supabase project details, which you can find in the Supabase dashboard under Project Settings > API.

## Deploying Database Schema Changes

1. Link your local project to your Supabase project:

```bash
npx supabase link --project-ref your-project-ref
```

2. Generate a migration from your local schema changes:

```bash
npx supabase db diff -f my_migration_name
```

3. Apply the migration to your Supabase project:

```bash
npx supabase db push
```

## Deploying Edge Functions

1. Move to your project directory:

```bash
cd fresh2.0
```

2. Deploy the edge functions:

```bash
npx supabase functions deploy generate-quiz-questions
npx supabase functions deploy process-pdf
```

3. Configure CORS for the functions:

```bash
npx supabase functions config update --function-name generate-quiz-questions --cors-allowed-origins 'https://your-domain.com'
npx supabase functions config update --function-name process-pdf --cors-allowed-origins 'https://your-domain.com'
```

## Setting Secrets for Edge Functions

If your functions require API keys or other secrets:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-api-key
```

## Verifying Deployment

1. Check your database in the Supabase Dashboard
2. Test your edge functions by making requests to them
3. Verify your application works with the deployed changes

## Troubleshooting

If you encounter issues:

1. Check the Supabase logs for errors:

```bash
npx supabase logs
```

2. For edge function errors:

```bash
npx supabase functions logs generate-quiz-questions
```

3. Ensure Docker is running properly on your machine

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions) 