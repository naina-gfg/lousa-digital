
import React from 'react';
import { Slide } from '../types';

interface SlideViewerProps {
  slides: Slide[];
}

export const SlideViewer: React.FC<SlideViewerProps> = ({ slides }) => {
  if (slides.length === 0) return null;

  return (
    <div className="space-y-12">
      {slides.map((slide, index) => (
        <div 
          key={slide.id} 
          className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col md:flex-row gap-8"
        >
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-6">
              <span className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">
                {index + 1}
              </span>
              <h3 className="text-3xl font-bold text-slate-900">{slide.title}</h3>
            </div>
            
            <div className="space-y-4 mb-8">
              {slide.content.map((item, i) => (
                <div key={i} className="flex gap-3 text-lg text-slate-700">
                  <span className="text-indigo-500 font-bold">•</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Conceito Chave</h4>
              <p className="text-slate-600 leading-relaxed">{slide.summary}</p>
            </div>
          </div>

          {slide.imageUrl && (
            <div className="md:w-1/3">
              <img 
                src={slide.imageUrl} 
                className="w-full h-full object-cover rounded-2xl shadow-inner border border-slate-200"
                alt={slide.title}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
