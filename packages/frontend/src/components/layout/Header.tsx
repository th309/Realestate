'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    MenuIcon, CloseIcon, PersonIcon, SettingsIcon, CreditCardIcon,
    BookIcon, HierarchyIcon, HelpIcon, LogoutIcon, HomeIcon,
    MapIcon, TrendingIcon, ArticleIcon, InfoIcon, MoneyIcon
} from '@/src/components/common/Icons';

const NAV_LINKS = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Maps', href: '/map', icon: MapIcon },
    { name: 'Graphs', href: '/graphs', icon: TrendingIcon },
    { name: 'Reports', href: '/reports', icon: ArticleIcon },
    { name: 'About us', href: '/about', icon: InfoIcon },
    { name: 'Pricing', href: '/pricing', icon: MoneyIcon },
];

export function Header() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    // TODO: Replace with actual auth hook when available
    const [isLoggedIn, setIsLoggedIn] = useState(false);

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
                    ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
                    : 'bg-white border-b border-transparent'
                }`}
        >
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="flex items-center gap-2 group">
                            <span className="text-xl font-bold tracking-tight text-[var(--md-primary)] group-hover:opacity-90 transition-opacity">
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
                                            ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]/30'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    {link.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right Side Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        {isLoggedIn ? (
                            <div className="relative">
                                <button
                                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                                    onBlur={() => setTimeout(() => setIsProfileOpen(false), 200)}
                                    className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[var(--md-primary)] to-[var(--md-secondary)] text-white shadow-md hover:shadow-lg transition-all active:scale-95"
                                >
                                    <PersonIcon className="w-5 h-5" />
                                </button>

                                {/* Profile Dropdown */}
                                <div
                                    className={`absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 transition-all duration-200 origin-top-right overflow-hidden ${isProfileOpen
                                            ? 'transform opacity-100 scale-100 visible'
                                            : 'transform opacity-0 scale-95 invisible'
                                        }`}
                                >
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                        <p className="text-sm font-semibold text-gray-900">John Doe</p>
                                        <p className="text-xs text-gray-500 truncate">john.doe@example.com</p>
                                    </div>
                                    <div className="p-2 space-y-0.5">
                                        <DropdownItem icon={HomeIcon} label="Home" href="/" />
                                        <DropdownItem icon={SettingsIcon} label="Settings" href="/settings" />
                                        <DropdownItem icon={CreditCardIcon} label="Billing" href="/billing" />
                                        <DropdownItem icon={BookIcon} label="Data Glossary" href="/glossary" />
                                        <DropdownItem icon={HierarchyIcon} label="Manage Seats" href="/team" />
                                        <DropdownItem icon={HelpIcon} label="Help" href="/help" />
                                        <div className="my-1 h-px bg-gray-100" />
                                        <button
                                            onClick={() => setIsLoggedIn(false)}
                                            className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                        >
                                            <LogoutIcon className="w-4 h-4 mr-3" />
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Link href="/login">
                                    <span className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-[var(--md-primary)] transition-colors">
                                        Log in
                                    </span>
                                </Link>
                                <button
                                    onClick={() => setIsLoggedIn(true)}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-[var(--md-primary)] rounded-full hover:bg-opacity-90 transition-all shadow-sm hover:shadow-md active:scale-95"
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
                            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            {isMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden border-t border-gray-100 bg-white absolute w-full shadow-lg">
                    <div className="px-4 py-4 space-y-2">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="flex items-center px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-[var(--md-primary)] sidebar-item-transition"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <link.icon className="w-5 h-5 mr-3 text-gray-400" />
                                {link.name}
                            </Link>
                        ))}
                        <div className="h-px bg-gray-100 my-3" />
                        {isLoggedIn ? (
                            <button
                                onClick={() => { setIsLoggedIn(false); setIsMenuOpen(false); }}
                                className="w-full flex items-center px-4 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50"
                            >
                                <LogoutIcon className="w-5 h-5 mr-3" />
                                Sign out
                            </button>
                        ) : (
                            <div className="space-y-3 pt-2">
                                <Link
                                    href="/login"
                                    className="block w-full text-center px-4 py-3 rounded-xl text-base font-medium text-gray-700 border border-gray-200 hover:bg-gray-50"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Log in
                                </Link>
                                <button
                                    onClick={() => { setIsLoggedIn(true); setIsMenuOpen(false); }}
                                    className="block w-full text-center px-4 py-3 rounded-xl text-base font-medium text-white bg-[var(--md-primary)] hover:bg-opacity-90 shadow-md"
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
            className="group flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-[var(--md-primary)] transition-colors"
        >
            <Icon className="w-4 h-4 mr-3 text-gray-400 group-hover:text-[var(--md-primary)] transition-colors" />
            {label}
        </Link>
    );
}
