import React from 'react';

interface StoryCardProps {
  content: string;
  type: 'narrative' | 'choice';
  image?: string;
  isLatest?: boolean;
}

export const StoryCard: React.FC<StoryCardProps> = ({ content, type, image, isLatest }) => {
  if (type === 'choice') {
    return (
      <div className="my-8 animate-fade-in font-serif text-center relative group">
        <div className="flex items-center justify-center opacity-40 mb-2">
          <div className="h-px bg-stone-400 w-12 sm:w-24"></div>
          <span className="mx-2 text-stone-500 text-xs uppercase tracking-widest font-sans">Decisión</span>
          <div className="h-px bg-stone-400 w-12 sm:w-24"></div>
        </div>
        
        <div className="px-8 py-2 inline-block relative">
           {content.includes('\n') ? (
             <div className="space-y-1">
               {content.split('\n').map((line, idx) => {
                 const [name, action] = line.split(':');
                 if (action) {
                   return (
                     <div key={idx} className="text-xl text-stone-700 italic">
                       <span className="font-bold text-stone-900 not-italic small-caps">{name}:</span> 
                       <span>{action}</span>
                     </div>
                   );
                 }
                 return <div key={idx} className="italic text-xl text-stone-700">{line}</div>;
               })}
             </div>
           ) : (
             <span className="italic font-serif text-xl sm:text-2xl text-stone-800">
               "{content}"
             </span>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-6 ${isLatest ? 'animate-slide-up' : ''}`}>
      {image && (
        <div className="mb-8 p-1 sm:p-2 bg-white shadow-sm border border-stone-200 transform sm:rotate-1 mx-auto max-w-[90%]">
          <img 
            src={`data:image/jpeg;base64,${image}`} 
            alt="Ilustración de la escena" 
            className="w-full h-auto object-cover max-h-[28rem] filter sepia-[0.2] contrast-[1.05]"
            loading="lazy"
          />
        </div>
      )}
      <div className="prose prose-stone prose-xl sm:prose-2xl max-w-none text-stone-900 font-serif leading-loose text-justify">
        {content.split('\n').map((paragraph, idx) => {
          // Drop cap logic for the very first paragraph of the first card, or just style normally
          // Here we just render paragraphs cleanly
          return (
            <p key={idx} className="mb-4 indent-8">
              {paragraph}
            </p>
          );
        })}
      </div>
      
      {isLatest && (
        <div className="flex justify-center mt-12 mb-4 opacity-60">
           <span className="text-3xl text-stone-400">❧</span>
        </div>
      )}
    </div>
  );
};