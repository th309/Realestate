'use client';

// Footer navigation grouped by category
const FOOTER_NAV = {
  'Explore': [
    { label: 'Interactive Map', href: '/map' },
    { label: 'Market Analytics', href: '/graphs' },
    { label: 'Report Builder', href: '/reports' },
  ],
  'Product': [
    { label: 'Features', href: '/#features' },
    { label: 'Scores', href: '/scores' },
    { label: 'Pricing', href: '/pricing' },
  ],
  'Company': [
    { label: 'About', href: '/about' },
  ],
};

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M8 22V10h4v12H8zm6-8v8h4v-8h-4zm6-4v12h4V10h-4z" fill="white" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-outline-variant bg-surface-container-lowest">
      <div className="max-w-6xl mx-auto">
        {/* Main footer grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Logo />
              <span className="font-bold text-on-surface">PropertyIQ</span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              AI-powered real estate market intelligence for smarter property decisions.
            </p>
          </div>

          {/* Navigation columns */}
          {Object.entries(FOOTER_NAV).map(([category, links]) => (
            <nav key={category} aria-label={`${category} navigation`}>
              <h3 className="text-sm font-semibold text-on-surface mb-3">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-on-surface-variant hover:text-on-surface transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-on-surface-variant">
            © {new Date().getFullYear()} PropertyIQ. All rights reserved.
          </p>
          <p className="text-xs text-on-surface-variant">
            Data from US Census, BLS, Zillow, and FRED. Updated regularly.
          </p>
        </div>
      </div>
    </footer>
  );
}
