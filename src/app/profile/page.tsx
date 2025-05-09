'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Header from '@/components/Header';
import { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';

// List of available exams (can be fetched dynamically later)
const AVAILABLE_EXAMS = ['SIE', 'Series 7', 'Series 63', 'Series 65', 'CFA Level I'];

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [examDate, setExamDate] = useState<string | null>(null);
  const [currentExam, setCurrentExam] = useState<string | null>(null);
  const [dailyGoal, setDailyGoal] = useState<number>(20);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/auth');
        return;
      }
      setUser(currentUser);

      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setMessage({ type: 'error', text: 'Could not load profile.' });
      } else if (userProfile) {
        setProfile(userProfile);
        setFullName(userProfile.full_name || '');
        setAvatarUrl(userProfile.avatar_url || '');
        setExamDate(userProfile.exam_date || null);
        setCurrentExam(userProfile.current_exam || null);
        setDailyGoal(userProfile.daily_goal || 20);
      }
      setLoading(false);
    };

    fetchUserAndProfile();
  }, [router, supabase]);

  const handleProfileUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile || !user) return;
    setMessage(null);
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
        exam_date: examDate,
        current_exam: currentExam,
        daily_goal: dailyGoal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setMessage({ type: 'error', text: 'Error updating profile: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      // Optionally re-fetch profile or update state locally
      const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (updatedProfile) setProfile(updatedProfile);
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password should be at least 6 characters.'});
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage({ type: 'error', text: 'Error updating password: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <p>Loading profile...</p>
        </main>
      </div>
    );
  }

  if (!user || !profile) {
    // This case should ideally be handled by the redirect in useEffect, but as a fallback:
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <p>Could not load user profile. Please try logging in again.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Your Profile</h1>

          {message && (
            <div 
              className={`p-4 mb-6 rounded-md text-sm ${
                message.type === 'success' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Profile Information Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Account Details</h2>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input 
                  type="email" 
                  id="email" 
                  value={user.email || ''} 
                  disabled 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 cursor-not-allowed sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input 
                  type="text" 
                  id="fullName" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="avatarUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Avatar URL</label>
                <input 
                  type="url" 
                  id="avatarUrl" 
                  value={avatarUrl} 
                  onChange={(e) => setAvatarUrl(e.target.value)} 
                  placeholder="https://example.com/avatar.png"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="currentExam" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Exam</label>
                <select
                  id="currentExam"
                  value={currentExam || ''}
                  onChange={(e) => setCurrentExam(e.target.value || null)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm rounded-md"
                >
                  <option value="">-- Select Exam --</option>
                  {AVAILABLE_EXAMS.map((exam) => (
                    <option key={exam} value={exam}>{exam}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="examDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Exam Date</label>
                <input 
                  type="date" 
                  id="examDate" 
                  value={examDate || ''} 
                  onChange={(e) => setExamDate(e.target.value || null)} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="dailyGoal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Daily Study Goal (Cards)</label>
                <input 
                  type="number" 
                  id="dailyGoal" 
                  value={dailyGoal}
                  min="1"
                  max="100" 
                  onChange={(e) => setDailyGoal(parseInt(e.target.value, 10) || 20)} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                />
              </div>
              <div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                <input 
                  type="password" 
                  id="newPassword" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  minLength={6}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                />
              </div>
              <div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Stats Display */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Your Stats</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {profile.xp}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Total XP
                    </div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg text-center">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {profile.streak}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Day Streak
                    </div>
                </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
} 