'use client';

import { useEffect, useState } from 'react';

const TOC_ITEMS = [
  { id: 'introduction', label: '1. Introduction' },
  { id: 'definitions', label: '2. Definitions' },
  { id: 'account', label: '3. Account & Eligibility' },
  { id: 'services', label: '4. Description of Services' },
  { id: 'ai-disclaimer', label: '5. AI Disclaimer' },
  { id: 'ai-role', label: "6. AI's Role vs. Product's Role" },
  { id: 'acceptable-use', label: '7. Acceptable Use Policy' },
  { id: 'ai-content', label: '8. AI-Generated Content' },
  { id: 'ip-rights', label: '9. Intellectual Property' },
  { id: 'data-privacy', label: '10. Data Privacy & Security' },
  { id: 'technology-partners', label: '11. Technology Partners' },
  { id: 'white-label', label: '12. White Label Use' },
  { id: 'subscriptions', label: '13. Subscriptions & Billing' },
  { id: 'refund-dispute', label: '14. Refunds & Disputes' },
  { id: 'cancellation', label: '15. Cancellation Policy' },
  { id: 'return-policy', label: '16. Return Policy' },
  { id: 'promotions', label: '17. Promotions' },
  { id: 'liability', label: '18. Limitation of Liability' },
  { id: 'indemnification', label: '19. Indemnification' },
  { id: 'legal-restrictions', label: '20. Legal & Export Restrictions' },
  { id: 'arbitration', label: '21. Binding Arbitration' },
  { id: 'class-action-waiver', label: '22. Class Action Waiver' },
  { id: 'termination', label: '23. Termination' },
  { id: 'governing-law', label: '24. Governing Law' },
  { id: 'changes', label: '25. Changes to Terms' },
  { id: 'contact', label: '26. Contact Information' },
];

export function TermsSidebar() {
  const [activeId, setActiveId] = useState('introduction');

  useEffect(() => {
    const elements = TOC_ITEMS.map((item) =>
      document.getElementById(item.id),
    ).filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto border-b lg:border-b-0 border-outline-variant pb-5 lg:pb-0 mb-8 lg:mb-0 lg:pr-3 scrollbar-thin">
      <p className="text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-4 pl-3.5">
        On This Page
      </p>
      <nav aria-label="Table of contents">
        {TOC_ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`block py-1.5 px-3.5 text-sm leading-snug border-l-2 transition-all duration-200 ${
              activeId === item.id
                ? 'text-primary border-primary font-semibold'
                : 'text-on-surface-variant border-transparent hover:text-primary hover:border-primary/40'
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
