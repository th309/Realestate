"use client";

// Footer navigation grouped by category
const FOOTER_NAV = {
  Explore: [
    { label: "Interactive Map", href: "/map" },
    { label: "Market Analytics", href: "/graphs" },
    { label: "Report Builder", href: "/reports" },
  ],
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Scores", href: "/scores" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "Federal Contracting Services LLC", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "info@propertyiq.app", href: "mailto:info@propertyiq.app" },
  ],
  Legal: [{ label: "Terms of Service", href: "/about/terms" }],
};

function Logo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#3949AB" />
      <path
        d="M20 16V48H26V38H34C40.627 38 46 32.627 46 26C46 19.373 40.627 16 34 16H20Z"
        fill="white"
      />
      <circle cx="34" cy="26" r="6" fill="#3949AB" />
      <circle cx="44" cy="44" r="4" fill="#00C853" />
      <circle cx="36" cy="48" r="2.5" fill="#00C853" opacity="0.6" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-outline-variant/30">
      <div className="max-w-6xl mx-auto">
        {/* Main footer grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Logo />
              <span className="font-bold">
                <span className="text-[#1A237E]">Property</span>
                <span className="text-[#3949AB]">IQ</span>
              </span>
            </div>
            <p className="text-sm text-[#3949AB] leading-relaxed">
              AI-powered real estate market intelligence for smarter property
              decisions.
            </p>
          </div>

          {/* Navigation columns */}
          {Object.entries(FOOTER_NAV).map(([category, links]) => (
            <nav key={category} aria-label={`${category} navigation`}>
              <h3 className="text-sm font-semibold text-[#1A237E] mb-3">
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-[#3949AB] hover:text-[#1A237E] transition-colors duration-200"
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
        <div className="pt-8 border-t border-[#3949AB]/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[#3949AB]">
            © {new Date().getFullYear()} PropertyIQ. All rights reserved.
          </p>
          <p className="text-xs text-[#3949AB]/70">
            Data from US Census, BLS, Zillow, and FRED. Updated regularly.
          </p>
        </div>
      </div>
    </footer>
  );
}
