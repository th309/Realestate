'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, TrendingUp, FileText, BarChart3 } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Map', href: '/map', icon: Map },
  { label: 'Markets', href: '/market', icon: BarChart3 },
  { label: 'Graphs', href: '/graphs', icon: TrendingUp },
  { label: 'Reports', href: '/reports', icon: FileText },
];

interface MobileNavProps {
  className?: string;
}

export const MobileNav: React.FC<MobileNavProps> = ({ className = '' }) => {
  const pathname = usePathname();

  return (
    <nav
      className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-surface-container-lowest border-t border-outline-variant
        safe-area-pb
        md:hidden
        ${className}
      `}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-1
                w-16 h-14 rounded-xl
                transition-all duration-200
                ${isActive
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
                }
              `}
            >
              <div
                className={`
                  relative p-1.5 rounded-full
                  transition-all duration-200
                  ${isActive ? 'bg-secondary-container' : ''}
                `}
              >
                <Icon className="w-5 h-5" />
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

// Navigation rail for tablets (side navigation)
export const NavigationRail: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const pathname = usePathname();

  return (
    <nav
      className={`
        hidden md:flex lg:hidden flex-col items-center
        w-20 py-4 bg-surface-container border-r border-outline-variant
        ${className}
      `}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`
              flex flex-col items-center justify-center gap-1
              w-16 h-14 rounded-2xl mb-1
              transition-all duration-200
              ${isActive
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }
            `}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

// Bottom sheet navigation (for complex mobile menus)
interface BottomSheetNavProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const BottomSheetNav: React.FC<BottomSheetNavProps> = ({
  isOpen,
  onClose,
  children,
  title,
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-on-surface/40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="
          absolute bottom-0 left-0 right-0
          bg-surface-container-high rounded-t-3xl
          animate-in slide-in-from-bottom duration-300
          max-h-[85vh] flex flex-col
        "
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-8 h-1 bg-outline-variant rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pb-3 border-b border-outline-variant">
            <h2 className="text-lg font-medium text-on-surface">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
};

// Safe area padding for devices with home indicators
export const SafeAreaSpacer: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return <div className={`h-16 md:h-0 ${className}`} />;
};
