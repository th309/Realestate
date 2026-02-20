import { redirect } from 'next/navigation';

export default function BillingRedirect() {
  redirect('/account?tab=subscription');
}
