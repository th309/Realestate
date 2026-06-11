import Link from "next/link";
import { Mail } from "lucide-react";

/** Post-signup "check your email" confirmation view (email-confirm flow). */
export function ConfirmationSent({ email }: { email: string }) {
  return (
    <div className="text-center py-4">
      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Mail className="w-6 h-6 text-primary" />
      </div>
      <h2 className="text-lg font-medium text-on-surface mb-2">
        Check your email
      </h2>
      <p className="text-sm text-on-surface-variant mb-6">
        We sent a confirmation link to{" "}
        <span className="font-medium text-on-surface">{email}</span>. Click the
        link in the email to activate your account.
      </p>
      <Link
        href="/auth/sign-in"
        className="text-sm text-primary hover:text-primary/80 font-medium"
      >
        Back to sign in
      </Link>
    </div>
  );
}
