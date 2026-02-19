'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
    MenuIcon, CloseIcon, PersonIcon, SettingsIcon, CreditCardIcon,
    BookIcon, HierarchyIcon, HelpIcon, LogoutIcon, HomeIcon,
    MapIcon, TrendingIcon, ArticleIcon, InfoIcon, MoneyIcon, MarketsIcon, ScoreIcon
} from '@/src/components/common/Icons';

const NAV_LINKS = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Maps', href: '/map', icon: MapIcon },
    { name: 'Markets', href: '/market', icon: MarketsIcon },
    { name: 'Graphs', href: '/graphs', icon: TrendingIcon },
    { name: 'Reports', href: '/reports', icon: ArticleIcon },
    { name: 'Scores', href: '/scores', icon: ScoreIcon },
    { name: 'About us', href: '/about', icon: InfoIcon },
    { name: 'Pricing', href: '/pricing', icon: MoneyIcon },
];

export function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading, signOut } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header
            className={`sticky top-0 z-50 w-full transition-all duration-300 ${scrolled
                    ? 'bg-surface-container-lowest/95 backdrop-blur-md shadow-sm border-b border-outline-variant'
                    : 'bg-surface-container-lowest border-b border-transparent'
                }`}
        >
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="flex items-center gap-2 group">
                            <span className="text-xl font-bold tracking-tight text-primary group-hover:opacity-90 transition-opacity">
                                PropertyIQ
                            </span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1 ml-8">
                        {NAV_LINKS.map((link) => {
                            const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                            return (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isActive
                                            ? 'text-primary bg-primary-container/30'
                                            : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                                        }`}
                                >
                                    {link.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right Side Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        {!!user ? (
                            <div className="relative">
                                <button
                                    data-testid="user-menu"
                                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                                    onBlur={() => setTimeout(() => setIsProfileOpen(false), 200)}
                                    className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-on-primary shadow-md hover:shadow-lg transition-all active:scale-95"
                                >
                                    <PersonIcon className="w-5 h-5" />
                                </button>

                                {/* Profile Dropdown */}
                                <div
                                    className={`absolute right-0 mt-2 w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant transition-all duration-200 origin-top-right overflow-hidden ${isProfileOpen
                                            ? 'transform opacity-100 scale-100 visible'
                                            : 'transform opacity-0 scale-95 invisible'
                                        }`}
                                >
                                    <div className="p-4 border-b border-outline-variant bg-surface-container/50">
                                        <p className="text-sm font-semibold text-on-surface">{user?.user_metadata?.display_name || user?.email}</p>
                                        <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
                                    </div>
                                    <div className="p-2 space-y-0.5">
                                        <DropdownItem icon={HomeIcon} label="Home" href="/" />
                                        <DropdownItem icon={SettingsIcon} label="Settings" href="/account" />
                                        <DropdownItem icon={CreditCardIcon} label="Billing" href="/account?tab=subscription" />
                                        <DropdownItem icon={BookIcon} label="Data Glossary" href="/glossary" />
                                        <DropdownItem icon={HierarchyIcon} label="Manage Seats" href="/team" />
                                        <DropdownItem icon={HelpIcon} label="Help" href="/help" />
                                        <div className="my-1 h-px bg-outline-variant" />
                                        <button
                                            onClick={async () => { await signOut(); router.push('/'); }}
                                            className="w-full flex items-center px-3 py-2 text-sm font-medium text-error rounded-lg hover:bg-error-container/30 transition-colors"
                                        >
                                            <LogoutIcon className="w-4 h-4 mr-3" />
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => router.push('/auth/sign-in')}
                                    className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
                                >
                                    Log in
                                </button>
                                <button
                                    onClick={() => router.push('/auth/sign-up')}
                                    className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary rounded-full hover:bg-primary/90 transition-all shadow-sm hover:shadow-md active:scale-95"
                                >
                                    Get Started
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                            {isMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden border-t border-outline-variant bg-surface-container-lowest absolute w-full shadow-lg">
                    <div className="px-4 py-4 space-y-2">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="flex items-center px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <link.icon className="w-5 h-5 mr-3 text-on-surface-variant" />
                                {link.name}
                            </Link>
                        ))}
                        <div className="h-px bg-outline-variant my-3" />
                        {!!user ? (
                            <button
                                onClick={async () => { await signOut(); setIsMenuOpen(false); router.push('/'); }}
                                className="w-full flex items-center px-4 py-3 rounded-xl text-base font-medium text-error hover:bg-error-container/30"
                            >
                                <LogoutIcon className="w-5 h-5 mr-3" />
                                Sign out
                            </button>
                        ) : (
                            <div className="space-y-3 pt-2">
                                <button
                                    onClick={() => { router.push('/auth/sign-in'); setIsMenuOpen(false); }}
                                    className="block w-full text-center px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant border border-outline-variant hover:bg-surface-container"
                                >
                                    Log in
                                </button>
                                <button
                                    onClick={() => { router.push('/auth/sign-up'); setIsMenuOpen(false); }}
                                    className="block w-full text-center px-4 py-3 rounded-xl text-base font-medium text-on-primary bg-primary hover:bg-primary/90 shadow-md"
                                >
                                    Get Started
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

function DropdownItem({ icon: Icon, label, href }: { icon: any, label: string, href: string }) {
    return (
        <Link
            href={href}
            className="group flex items-center px-3 py-2 text-sm font-medium text-on-surface-variant rounded-lg hover:bg-surface-container hover:text-primary transition-colors"
        >
            <Icon className="w-4 h-4 mr-3 text-on-surface-variant group-hover:text-primary transition-colors" />
            {label}
        </Link>
    );
}
