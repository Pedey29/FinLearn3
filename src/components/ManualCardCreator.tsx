'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export default function ManualCardCreator() {
  const supabase = createClientComponentClient<Database>();
  const [cardType, setCardType] = useState<'lesson' | 'quiz'>('lesson');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Blueprint fields
  const [exam, setExam] = useState('Series 7');
  const [domain, setDomain] = useState('');
  const [section, setSection] = useState('');
  const [learningOutcome, setLearningOutcome] = useState('');
  
  // Lesson card fields
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [bulletPoints, setBulletPoints] = useState<string[]>(['', '', '']);
  
  // Quiz card fields
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState('');

  const handleBulletPointChange = (index: number, value: string) => {
    const newBulletPoints = [...bulletPoints];
    newBulletPoints[index] = value;
    setBulletPoints(newBulletPoints);
  };

  const handleChoiceChange = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const resetForm = () => {
    setDomain('');
    setSection('');
    setLearningOutcome('');
    setLessonTitle('');
    setLessonContent('');
    setBulletPoints(['', '', '']);
    setQuestion('');
    setChoices(['', '', '', '']);
    setCorrectIndex(0);
    setExplanation('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // First create the blueprint
      const { data: blueprintData, error: blueprintError } = await supabase
        .from('blueprints')
        .insert({
          exam,
          domain,
          section,
          learning_outcome: learningOutcome
        })
        .select();

      if (blueprintError) throw new Error(blueprintError.message);
      if (!blueprintData || blueprintData.length === 0) throw new Error('Failed to create blueprint');

      const blueprintId = blueprintData[0].id;

      // Then create the card based on type
      if (cardType === 'lesson') {
        const { error: lessonError } = await supabase
          .from('lessons')
          .insert({
            blueprint_id: blueprintId,
            title: lessonTitle,
            content: lessonContent,
            bullet_points: bulletPoints.filter(bp => bp.trim() !== '')
          });

        if (lessonError) throw new Error(lessonError.message);
      } else {
        const { error: quizError } = await supabase
          .from('quizzes')
          .insert({
            blueprint_id: blueprintId,
            question,
            choices,
            correct_index: correctIndex,
            explanation
          });

        if (quizError) throw new Error(quizError.message);
      }

      // Also create a review record for the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get the ID of the newly created card
        let cardId;
        if (cardType === 'lesson') {
          const { data: lessonData } = await supabase
            .from('lessons')
            .select('id')
            .eq('blueprint_id', blueprintId)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (lessonData && lessonData.length > 0) {
            cardId = lessonData[0].id;
          }
        } else {
          const { data: quizData } = await supabase
            .from('quizzes')
            .select('id')
            .eq('blueprint_id', blueprintId)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (quizData && quizData.length > 0) {
            cardId = quizData[0].id;
          }
        }

        if (cardId) {
          await supabase
            .from('reviews')
            .insert({
              user_id: user.id,
              card_type: cardType,
              card_id: cardId,
              ease_factor: 2.5,
              interval: 0,
              repetitions: 0,
              consecutive_correct_answers: 0,
              next_review: new Date().toISOString()
            });
        }
      }

      setSuccessMessage(`Successfully created ${cardType} card!`);
      resetForm();
    } catch (error: any) {
      setErrorMessage(`Error creating card: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Create Learning Card
      </h2>
      
      {successMessage && (
        <div className="mb-4 p-4 text-green-700 bg-green-100 rounded-lg dark:bg-green-900 dark:text-green-300">
          {successMessage}
        </div>
      )}
      
      {errorMessage && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-300">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                name="cardType"
                value="lesson"
                checked={cardType === 'lesson'}
                onChange={() => setCardType('lesson')}
              />
              <span className="ml-2">Lesson Card</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                name="cardType"
                value="quiz"
                checked={cardType === 'quiz'}
                onChange={() => setCardType('quiz')}
              />
              <span className="ml-2">Quiz Card</span>
            </label>
          </div>
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          Blueprint Information
        </h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Exam
          </label>
          <select
            value={exam}
            onChange={(e) => setExam(e.target.value)}
            required
            className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="Series 7">Series 7</option>
            <option value="Series 63">Series 63</option>
            <option value="Series 65">Series 65</option>
            <option value="Series 66">Series 66</option>
            <option value="CFA Level 1">CFA Level 1</option>
            <option value="CFA Level 2">CFA Level 2</option>
            <option value="CFA Level 3">CFA Level 3</option>
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              placeholder="e.g., Fixed Income"
              className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Section
            </label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              required
              placeholder="e.g., Corporate Bonds"
              className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Learning Outcome
          </label>
          <textarea
            value={learningOutcome}
            onChange={(e) => setLearningOutcome(e.target.value)}
            required
            rows={2}
            placeholder="e.g., Explain the characteristics of corporate bonds and their pricing mechanisms"
            className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          ></textarea>
        </div>
        
        {cardType === 'lesson' ? (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Lesson Card Details
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                required
                placeholder="e.g., Understanding Corporate Bonds"
                className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content (HTML supported)
              </label>
              <textarea
                value={lessonContent}
                onChange={(e) => setLessonContent(e.target.value)}
                required
                rows={6}
                placeholder="<p>Corporate bonds are debt securities issued by corporations...</p>"
                className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
              ></textarea>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Key Takeaways (Bullet Points)
              </label>
              {bulletPoints.map((point, index) => (
                <div key={index} className="mb-2">
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => handleBulletPointChange(index, e.target.value)}
                    placeholder={`Bullet point ${index + 1}`}
                    className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Quiz Card Details
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                rows={3}
                placeholder="e.g., Which of the following best describes the relationship between bond prices and interest rates?"
                className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              ></textarea>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Answer Choices
              </label>
              {choices.map((choice, index) => (
                <div key={index} className="flex items-center mb-2">
                  <div className="mr-2">
                    <input
                      type="radio"
                      checked={correctIndex === index}
                      onChange={() => setCorrectIndex(index)}
                      className="form-radio"
                    />
                  </div>
                  <input
                    type="text"
                    value={choice}
                    onChange={(e) => handleChoiceChange(index, e.target.value)}
                    required
                    placeholder={`Choice ${String.fromCharCode(65 + index)}`}
                    className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              ))}
              <small className="text-gray-500 dark:text-gray-400">
                Select the radio button next to the correct answer.
              </small>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Explanation
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                required
                rows={3}
                placeholder="Explain why the correct answer is right and why the other options are wrong."
                className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              ></textarea>
            </div>
          </>
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Card'}
          </button>
        </div>
      </form>
    </div>
  );
} 