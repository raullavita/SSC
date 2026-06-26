import React, { useEffect } from 'react';

/** Enables vertical scroll on public marketing routes (landing, privacy, terms). */
export default function MarketingPage({ children, className = '' }) {
  useEffect(() => {
    document.documentElement.classList.add('marketing-site');
    return () => document.documentElement.classList.remove('marketing-site');
  }, []);

  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {children}
    </div>
  );
}