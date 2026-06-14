/**
 * Beta Tester Feedback Page
 * 
 * Public page accessible via shareable token link.
 * Allows beta testers to submit feedback without registration.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { FeedbackPageClient } from './FeedbackPageClient';

interface PageProps {
  params: Promise<{ token: string }>;
}

async function getTester(token: string) {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('beta_testers')
    .select('id, name, is_active')
    .eq('token', token)
    .single();
  
  if (error || !data || !data.is_active) {
    return null;
  }
  
  return data;
}

async function getTesterFeedback(testerId: string) {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('beta_feedback')
    .select('id, title, category, status, created_at')
    .eq('tester_id', testerId)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('Error fetching feedback:', error);
    return [];
  }
  
  return data || [];
}

export default async function BetaTestFeedbackPage({ params }: PageProps) {
  const { token } = await params;
  
  const tester = await getTester(token);
  
  if (!tester) {
    notFound();
  }
  
  const previousFeedback = await getTesterFeedback(tester.id);
  
  return (
    <FeedbackPageClient 
      tester={tester}
      token={token}
      previousFeedback={previousFeedback}
    />
  );
}

export const dynamic = 'force-dynamic';
