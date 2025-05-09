# Generate Quiz Questions Edge Function

This Supabase Edge Function automatically generates multiple-choice quiz questions from existing lesson content using OpenAI's GPT-4 API.

## Features

- Generates quiz questions based on lesson content
- Supports generating questions for specific lessons or an entire exam
- Configurable number of questions per lesson
- Duplicate question detection to avoid creating similar questions
- Admin-only access control

## API Usage

### Request Format

```json
{
  "lessonIds": ["lesson-id-1", "lesson-id-2"],  // Optional: Array of lesson IDs
  "examId": "exam-id",                          // Optional: Exam ID (if lessonIds not provided)
  "questionsPerLesson": 3                       // Optional: Number of questions per lesson (default: 3)
}
```

You must provide either `lessonIds` or `examId`.

### Authentication

The function requires an authentication token with admin role:

```
Authorization: Bearer <user_jwt_token>
```

### Response Format

```json
{
  "success": true,
  "message": "Generated 15 questions (2 skipped) from 5 lessons",
  "totalQuestions": 15,
  "skippedQuestions": 2,
  "processedLessons": 5
}
```

## Environment Variables

The function requires these environment variables:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for database access
- `OPENAI_API_KEY`: OpenAI API key for generating content

## Deployment

Deploy using the Supabase CLI:

```bash
supabase functions deploy generate-quiz-questions --project-ref your-project-ref
```

## Integration

This function can be called from the client using:

```javascript
const { data, error } = await supabase.functions.invoke('generate-quiz-questions', {
  body: { 
    examId: 'exam-id',
    questionsPerLesson: 3
  }
})
``` 