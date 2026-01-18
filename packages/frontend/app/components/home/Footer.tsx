'use client';

const FOOTER_LINKS = ['Privacy', 'Terms', 'Documentation', 'API', 'Contact'];

export function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-outline-variant">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-6">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors duration-200"
            >
              {link}
            </a>
          ))}
        </div>
        <div className="text-sm text-on-surface-variant">
          © 2025 PropertyIQ. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
