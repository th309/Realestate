'use client';

import Link from 'next/link';

const NAV_LINKS = ['Features', 'Pricing', 'About', 'Docs'];

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M8 22V10h4v12H8zm6-8v8h4v-8h-4zm6-4v12h4V10h-4z" fill="white" />
    </svg>
  );
}

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-surface/90 backdrop-blur-md border-b border-outline-variant">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 font-bold text-lg tracking-tight text-on-surface">
        <Logo />
        <span>PropertyIQ</span>
      </Link>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center gap-8">
        {NAV_LINKS.map((link) => (
          <a
            key={link}
            href={`#${link.toLowerCase()}`}
            className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors duration-200"
          >
            {link}
          </a>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-full text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-200">
          Log in
        </button>
        <button className="px-4 py-2 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors duration-200 elevation-1">
          Get Started
        </button>
      </div>
    </nav>
  );
}
