import type { Metadata } from 'next';
import { Mail, Building2, MapPin, Globe, Send } from 'lucide-react';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact PropertyIQ',
  description: 'Get in touch with the PropertyIQ team. Questions about AI-powered real estate market analysis, pricing, or partnerships.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'Contact' }]}
          title="Contact Us"
          description="Get in touch with the PropertyIQ team"
          icon={<Mail className="w-5 h-5" />}
        />

        <div className="mt-12 space-y-10">
          {/* Company & Product */}
          <section className="grid sm:grid-cols-2 gap-8">
            <div>
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Company
              </h2>
              <p className="text-on-surface font-medium">Federal Contracting Services LLC</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Product
              </h2>
              <p className="text-on-surface font-medium">PropertyIQ</p>
            </div>
          </section>

          {/* Email & Address */}
          <section className="grid sm:grid-cols-2 gap-8">
            <div>
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Email
              </h2>
              <a
                href="mailto:info@propertyiq.app"
                className="text-primary font-medium hover:text-primary/80 transition-colors"
              >
                info@propertyiq.app
              </a>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Registered Agent & Mailing Address
              </h2>
              <address className="not-italic text-on-surface leading-relaxed">
                <p className="font-medium">Republic Registered Agent LLC</p>
                <p>20 S Charles St, Ste 403</p>
                <p>Baltimore, MD 21201</p>
              </address>
            </div>
          </section>

          {/* Contact Form */}
          <section>
            <h2 className="text-lg font-medium text-on-surface mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Us a Message
            </h2>
            <div className="rounded-xl bg-surface-container-low p-6 shadow-sm">
              <ContactForm />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
