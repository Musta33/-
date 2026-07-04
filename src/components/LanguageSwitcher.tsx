import React from 'react';

export const LanguageSwitcher = () => {
  const changeLang = (lang: string) => {
    localStorage.setItem('lang', lang);
    window.location.reload(); // Simplest way to ensure all components reflect the change
  };

  return (
    <div className="flex gap-2 p-4">
      <button 
        onClick={() => changeLang('ar')}
        className={`px-3 py-1 rounded text-sm font-bold ${localStorage.getItem('lang') === 'ar' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
      >
        العربية
      </button>
      <button 
        onClick={() => changeLang('en')}
        className={`px-3 py-1 rounded text-sm font-bold ${localStorage.getItem('lang') === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
      >
        English
      </button>
    </div>
  );
};
