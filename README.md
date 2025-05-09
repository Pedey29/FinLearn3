# FinLearn

A modern, interactive learning platform for finance professionals preparing for Series exams and the CFA. FinLearn combines spaced repetition learning with AI-generated content to create an efficient study experience.

## Features

- **PDF → Content Generator**: Upload study materials and automatically extract learning content
- **Blueprint Database**: Structured learning outcomes mapped to study materials
- **Lesson Cards**: Concise HTML summaries with key takeaways
- **Quiz Cards**: Multiple-choice questions with explanations
- **Adaptive Spaced-Repetition**: SM-2 algorithm for optimized review scheduling
- **Gamification**: XP points and streak tracking to motivate consistent study
- **Progress Dashboard**: Track completion across exam domains
- **Mobile-First PWA**: Works offline with service worker caching and IndexedDB for offline data
- **Edge Functions**: Serverless OpenAI processing for PDF content extraction
- **Admin Console**: For content management and generation
- **Role-Based Auth**: Support for learners and admin users

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **PDF Processing**: pdf.js for in-browser text extraction, OpenAI for content generation
- **Offline Support**: Service workers with IndexedDB for offline data persistence
- **Animations**: Framer Motion for card transitions

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account
- OpenAI API key (for AI-powered content generation)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/finlearn.git
cd finlearn
```

2. Install dependencies:

```bash
npm install
```

3. Create a Supabase project and set up the database using the SQL schema in `supabase/schema.sql`.

4. Apply the database function for content generation:

```bash
psql -h your_supabase_db_host -d postgres -U postgres -f supabase/migrations/20250507_create_learning_materials_function.sql
```

5. Create a `.env.local` file in the root directory with your credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

6. Start the development server:

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Project Structure

```
finlearn/
├── public/              # Static assets and service worker
│   ├── manifest.json    # PWA manifest file
│   ├── service-worker.js # Service worker for offline functionality
│   └── offline.html     # Offline fallback page
├── src/
│   ├── app/             # Next.js app router
│   │   ├── api/         # API routes
│   │   ├── admin/       # Admin pages
│   │   ├── auth/        # Authentication pages
│   │   ├── dashboard/   # User dashboard
│   │   ├── study/       # Study session pages
│   │   └── ...
│   ├── components/      # Reusable React components
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
└── supabase/
    ├── schema.sql       # Database schema
    ├── migrations/      # Database migrations
    └── functions/       # Supabase Edge Functions
        └── process-pdf/ # PDF processing Edge Function
```

## Deployment

1. Create a production build:

```bash
npm run build
```

2. Deploy to your preferred hosting platform (Vercel, Netlify, etc.).

3. Set up the environment variables for your production environment.

## Setting Up Supabase Edge Functions

The project includes a Supabase Edge Function for PDF processing:

1. Navigate to the functions directory:

```bash
cd supabase/functions
```

2. Deploy the Edge Functions:

```bash
supabase functions deploy process-pdf
```

3. Set the required secrets for the Edge Function:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_key
supabase secrets set SUPABASE_URL=your_supabase_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

For more detailed instructions, see the README file in the `supabase/functions` directory.

## Offline Functionality

FinLearn is designed to work offline with the following features:

- Study materials are cached for offline use
- Progress data is stored locally when offline and synced when online
- PDF processing requests are queued when offline and processed when online
- Network status indicator shows current connectivity state

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [pdf.js](https://mozilla.github.io/pdf.js/)
- [OpenAI](https://openai.com/)
