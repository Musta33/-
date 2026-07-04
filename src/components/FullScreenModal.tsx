import React from 'react';

export function FullScreenModal({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  if (!imageUrl) return null;
  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" 
      onClick={onClose}
    >
      <img src={imageUrl} alt="Full Screen image" className="max-w-full max-h-full rounded-2xl" />
    </div>
  );
}
