import React from 'react';

export default function Loader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#111315] text-white font-sans fixed inset-0 z-50">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="64" 
        height="64" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#dc2626" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="animate-pulse"
      >
        <rect width="20" height="14" x="2" y="3" rx="2"></rect>
        <line x1="8" x2="16" y1="21" y2="21"></line>
        <line x1="12" x2="12" y1="17" y2="21"></line>
      </svg>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">CinéPrivé</h1>
      <div className="mt-4 w-10 h-10 border-[3px] border-primary-600/20 border-t-primary-600 rounded-full animate-spin"></div>
    </div>
  );
}
