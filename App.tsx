
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { extractSlidesWithLlama } from './services/groqService';
import { BoardProject, Slide, ImageSize, SlideStyle, TextStyles } from './types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Componente de Slide memorizado para evitar re-renderizações que limpam a seleção
// Adicionando React.forwardRef para que o componente pai possa acessar o elemento DOM para exportação (html2canvas)
const EditableSlide = React.memo(React.forwardRef<HTMLDivElement, {
  slide: Slide,
  idx: number,
  style: SlideStyle,
  activeTextPart: { slideId: string, type: 'body' } | null,
  onActivation: (id: string) => void,
  onEdit: (id: string, value: string, index: number) => void,
  onExport: (id: string) => void,
  onFormat: (command: string, value?: string) => void,
  onStyleUpdate: (part: 'body', style: Partial<TextStyles>) => void,
  onDeactivate: () => void,
  onMove?: (idx: number, direction: 'up' | 'down') => void,
  totalSlides?: number,
  toolbarRef?: React.RefObject<HTMLDivElement>,
  isFormattingRef?: React.MutableRefObject<boolean>,
  savedSelectionRef?: React.MutableRefObject<Range | null>,
  onPreview?: (url: string) => void
}>(({
  slide,
  idx,
  style,
  activeTextPart,
  onActivation,
  onEdit,
  onExport,
  onFormat,
  onStyleUpdate,
  onDeactivate,
  onMove,
  totalSlides,
  toolbarRef,
  isFormattingRef,
  savedSelectionRef,
  onPreview
}, ref) => {
  const getAspectStyle = (ratio: string): React.CSSProperties => {
    switch (ratio) {
      case '9:16': return { aspectRatio: '9 / 16' };
      case '1:1': return { aspectRatio: '1 / 1' };
      case '4:3': return { aspectRatio: '4 / 3' };
      default: return { aspectRatio: '16 / 9' };
    }
  };

  return (
    <div
      ref={ref}
      className={`slide-container bg-white shadow-xl border border-slate-100 transition-all box-border w-full ${style.template === 'blueprint' ? 'bg-indigo-900 text-white' :
        style.template === 'minimalist' ? 'shadow-none border-2' : ''
        }`}
      style={{
        ...getAspectStyle(style.aspectRatio),
        ...(style.template === 'blueprint' ? { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' } : {})
      }}
    >
      <div className="p-8 md:p-16 relative flex flex-col justify-start h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
          {activeTextPart && activeTextPart.slideId === slide.id && (
            <div
              ref={toolbarRef}
              className="mb-4 bg-white/95 backdrop-blur-xl shadow-lg rounded-2xl p-2 flex flex-wrap justify-center items-center gap-y-2 gap-x-3 border border-slate-200 no-print animate-in fade-in zoom-in duration-200 ring-1 ring-slate-900/5 mx-auto w-full md:w-auto md:max-w-none md:flex-nowrap"
            >
              {/* Linha 1 (Mobile) / Grupo Esquerda (Desktop) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false, ''); }}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors font-bold text-slate-700"
                  title="Negrito"
                >
                  <i className="fa-solid fa-bold text-xs"></i>
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false, ''); }}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors italic text-slate-700"
                  title="Itálico"
                >
                  <i className="fa-solid fa-italic text-xs"></i>
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline', false, ''); }}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors underline text-slate-700"
                  title="Sublinhado"
                >
                  <i className="fa-solid fa-underline text-xs"></i>
                </button>

                <div className="w-px h-6 bg-slate-200 mx-1"></div>

                <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1.5" title="Tamanho da Fonte">
                  <i className="fa-solid fa-text-height text-slate-400 text-[10px]"></i>
                  <input
                    type="number"
                    defaultValue={style.bodyStyles.fontSize}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const size = parseInt(e.target.value);
                      if (isNaN(size) || size < 1) return;
                      const range = savedSelectionRef?.current;
                      if (range && !range.collapsed) {
                        // Restaurar a seleção antes de aplicar
                        const container = range.commonAncestorContainer;
                        const editableEl = (container instanceof HTMLElement
                          ? container.closest('[contenteditable="true"]')
                          : container.parentElement?.closest('[contenteditable="true"]')) as HTMLElement | null;
                        if (editableEl) {
                          editableEl.focus();
                          const sel = window.getSelection();
                          if (sel) {
                            sel.removeAllRanges();
                            sel.addRange(range);
                            document.execCommand('fontSize', false, '7');
                            editableEl.querySelectorAll('font[size="7"]').forEach(font => {
                              const span = document.createElement('span');
                              span.style.fontSize = `${size}px`;
                              span.innerHTML = font.innerHTML;
                              font.replaceWith(span);
                            });
                          }
                        }
                      } else {
                        onStyleUpdate('body', { fontSize: size });
                      }
                    }}
                    className="w-14 bg-transparent text-xs font-bold outline-none text-center px-1 appearance-none text-slate-700"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1.5" title="Altura da Linha">
                  <i className="fa-solid fa-arrows-up-down text-slate-400 text-[10px]"></i>
                  <input
                    type="number"
                    step="0.1"
                    value={style.bodyStyles.lineHeight}
                    onChange={(e) => onStyleUpdate('body', { lineHeight: parseFloat(e.target.value) })}
                    className="w-14 bg-transparent text-xs font-bold outline-none text-center px-1 appearance-none text-slate-700"
                  />
                </div>
              </div>

              {/* Linha 2 (Mobile) / Grupo Direita (Desktop) */}
              <div className="flex items-center gap-1 shrink-0">
                {['left', 'center', 'right', 'justify'].map((align) => (
                  <button
                    key={align}
                    onMouseDown={(e) => { e.preventDefault(); onStyleUpdate('body', { textAlign: align as any }); }}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${style.bodyStyles.textAlign === align ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'}`}
                    title={`Alinhar ${align}`}
                  >
                    <i className={`fa-solid fa-align-${align} text-xs`}></i>
                  </button>
                ))}

                <div className="w-px h-6 bg-slate-200 mx-1"></div>

                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#334155'); }}
                    className="w-5 h-5 rounded-full border border-slate-200 bg-slate-700 shadow-sm hover:scale-110 transition-transform"
                    title="Preto/Slate"
                  />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#ef4444'); }}
                    className="w-5 h-5 rounded-full border border-slate-200 bg-red-500 shadow-sm hover:scale-110 transition-transform"
                    title="Vermelho"
                  />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#3b82f6'); }}
                    className="w-5 h-5 rounded-full border border-slate-200 bg-blue-500 shadow-sm hover:scale-110 transition-transform"
                    title="Azul"
                  />
                  <input
                    type="color"
                    onInput={(e) => { document.execCommand('foreColor', false, (e.target as HTMLInputElement).value); }}
                    className="w-6 h-6 rounded-full cursor-pointer border border-slate-200 p-0 bg-white overflow-hidden"
                    title="Outras Cores"
                  />
                </div>

                <button
                  onClick={() => onDeactivate()}
                  className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 shadow-md ml-1"
                  title="Concluir"
                >
                  <i className="fa-solid fa-check text-xs"></i>
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center no-print mb-8" data-html2canvas-ignore>
            <span className="text-xs font-black opacity-30 uppercase tracking-widest">SLIDE {idx + 1}</span>
            <div className="flex gap-2">
              <div className="flex bg-slate-100 rounded-full px-1 py-1 mr-2 no-print">
                <button
                  onClick={() => onMove?.(idx, 'up')}
                  disabled={idx === 0}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${idx === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-indigo-600 hover:text-white text-slate-500'}`}
                  title="Mover para cima"
                >
                  <i className="fa-solid fa-arrow-up text-[10px]"></i>
                </button>
                <button
                  onClick={() => onMove?.(idx, 'down')}
                  disabled={totalSlides !== undefined && idx === totalSlides - 1}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${totalSlides !== undefined && idx === totalSlides - 1 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-indigo-600 hover:text-white text-slate-500'}`}
                  title="Mover para baixo"
                >
                  <i className="fa-solid fa-arrow-down text-[10px]"></i>
                </button>
              </div>
              {onPreview && (
                <button
                  onClick={() => onPreview?.('')}
                  className="text-[10px] bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                >
                  <i className="fa-solid fa-eye mr-1"></i> ORIGINAL
                </button>
              )}
              <button onClick={() => onExport(slide.id)} className="text-[10px] bg-slate-100 px-4 py-1.5 rounded-full font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                <i className="fa-solid fa-image mr-1"></i> PNG
              </button>
            </div>
          </div>

          <div
            className={`group relative outline-none transition-all hover:bg-indigo-50/5 rounded-xl p-3 cursor-text space-y-6 ${activeTextPart?.slideId === slide.id ? 'ring-2 ring-indigo-500/50 bg-indigo-50/10 shadow-inner' : ''}`}
            style={{
              fontSize: `${style.bodyStyles.fontSize}px`,
              lineHeight: style.bodyStyles.lineHeight,
              textAlign: style.bodyStyles.textAlign,
              fontWeight: style.bodyStyles.fontWeight,
              fontStyle: style.bodyStyles.fontStyle
            }}
          >
            {slide.content.map((point, pIdx) => (
              <div key={pIdx} className="flex items-start gap-5">
                <span className="opacity-20 mt-2.5 text-xs text-indigo-500">◆</span>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={() => onActivation(slide.id)}
                  onBlur={(e) => {
                    if (isFormattingRef?.current) return;
                    onEdit(slide.id, e.currentTarget.innerHTML, pIdx);
                  }}
                  className="w-full outline-none whitespace-pre-wrap"
                  style={{ color: style.template === 'blueprint' ? '#e0e7ff' : style.bodyStyles.color }}
                  dangerouslySetInnerHTML={{ __html: point }}
                />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div >
  );
}));

const App: React.FC = () => {
  const [projects, setProjects] = useState<BoardProject[]>([]);
  const [activeProject, setActiveProject] = useState<BoardProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newProjectMeta, setNewProjectMeta] = useState({ course: "", topic: "" });
  const [tempImages, setTempImages] = useState<string[]>([]);
  // Removed ocrMode, using groq directly

  const [showAppearance, setShowAppearance] = useState(false);
  const [activeTextPart, setActiveTextPart] = useState<{ slideId: string, type: 'body' } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const slideRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const isFormattingRef = useRef(false);

  // Salvar seleção continuamente para restaurar antes de aplicar formatação
  useEffect(() => {
    const saveSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const editableEl = container instanceof HTMLElement
          ? container.closest('[contenteditable="true"]')
          : container.parentElement?.closest('[contenteditable="true"]');
        if (editableEl && !range.collapsed) {
          savedSelectionRef.current = range.cloneRange();
        }
      }
    };
    document.addEventListener('selectionchange', saveSelection);
    return () => document.removeEventListener('selectionchange', saveSelection);
  }, []);

  // Fechar barra de ferramentas ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // Se clicar na toolbar ativa, não fechar
      if (activeTextPart && toolbarRef.current && toolbarRef.current.contains(event.target as Node)) {
        return;
      }

      const target = event.target as HTMLElement;
      // Verificar se o clique foi em um elemento editável
      const isEditable = target.closest('[contenteditable="true"]');

      if (!isEditable) {
        setActiveTextPart(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeTextPart]);

  useEffect(() => {
    const saved = localStorage.getItem('lousa_projects_v4');
    if (saved) setProjects(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('lousa_projects_v4', JSON.stringify(projects));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.course.toLowerCase().includes(q) ||
      p.topic.toLowerCase().includes(q) ||
      p.slides.some(s =>
        s.content.some(c => c.toLowerCase().includes(q))
      )
    );
  }, [projects, searchQuery]);

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    // Ordenar arquivos por nome para garantir sequência previsível
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const loaders = files.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(loaders).then(results => {
      setTempImages(results);
      setShowUploadModal(true);
    });
  };

  const processScan = async () => {
    if (tempImages.length === 0) return;
    setIsLoading(true);
    setShowUploadModal(false);
    setError(null);

    try {
      let result = await extractSlidesWithLlama(tempImages);

      const newProject: BoardProject = {
        id: Date.now().toString(),
        name: `Aula de ${new Date().toLocaleDateString()}`,
        course: newProjectMeta.course || "Geral",
        topic: newProjectMeta.topic || "Sem Tópico",
        originalImages: tempImages,
        slides: result.slides.map((s: any, idx: number) => ({
          ...s,
          id: `${Date.now()}-${idx}`,
          imageUrl: tempImages[s.source_image_index !== undefined ? s.source_image_index : (s.sourceImageIndex !== undefined ? s.sourceImageIndex : 0)]
        })),
        createdAt: Date.now(),
        style: {
          template: 'modern',
          primaryColor: '#4f46e5',
          fontFamily: 'sans',
          aspectRatio: '16:9',
          titleStyles: { fontSize: 48, lineHeight: 1.2, color: '#000000', textAlign: 'left', fontWeight: 'bold', fontStyle: 'normal' },
          bodyStyles: { fontSize: 12, lineHeight: 1.5, color: '#334155', textAlign: 'left', fontWeight: 'normal', fontStyle: 'normal' }
        }
      };

      setProjects(prev => [newProject, ...prev]);
      setActiveProject(newProject);
      setTempImages([]);
      setNewProjectMeta({ course: "", topic: "" });
    } catch (err) {
      setError("Erro ao processar imagens. Verifique se o conteúdo é legível.");
    } finally {
      setIsLoading(false);
    }
  };

  const moveSlide = (idx: number, direction: 'up' | 'down') => {
    if (!activeProject) return;
    const newSlides = [...activeProject.slides];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newSlides.length) return;

    [newSlides[idx], newSlides[targetIdx]] = [newSlides[targetIdx], newSlides[idx]];
    const updated = { ...activeProject, slides: newSlides };
    setActiveProject(updated);
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
  };

  const processAppendScan = async (newImages: string[]) => {
    if (!activeProject) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await extractSlidesWithLlama(newImages);
      const startIdx = activeProject.originalImages.length;

      const newSlides = result.slides.map((s: any, idx: number) => ({
        ...s,
        id: `${Date.now()}-append-${idx}`,
        imageUrl: newImages[s.source_image_index !== undefined ? s.source_image_index : 0],
        sourceImageIndex: startIdx + (s.source_image_index || 0)
      }));

      const updated = {
        ...activeProject,
        originalImages: [...activeProject.originalImages, ...newImages],
        slides: [...activeProject.slides, ...newSlides]
      };

      setActiveProject(updated);
      setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
    } catch (err) {
      setError("Erro ao adicionar quadros.");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening the project
    if (window.confirm("Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.")) {
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      localStorage.setItem('lousa_projects_v4', JSON.stringify(updated));
    }
  };

  const updateStyle = (style: Partial<SlideStyle>) => {
    if (!activeProject) return;
    const updated = { ...activeProject, style: { ...activeProject.style, ...style } };
    setActiveProject(updated);
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
  };

  const applyCommand = (command: string, value: string = '') => {
    isFormattingRef.current = true;

    const range = savedSelectionRef.current;
    if (!range) {
      isFormattingRef.current = false;
      return;
    }

    // Encontrar o contentEditable pai da seleção salva
    const container = range.commonAncestorContainer;
    const editableEl = (container instanceof HTMLElement
      ? container.closest('[contenteditable="true"]')
      : container.parentElement?.closest('[contenteditable="true"]')) as HTMLElement | null;

    if (!editableEl) {
      isFormattingRef.current = false;
      return;
    }

    // Focar o elemento editável e restaurar a seleção
    editableEl.focus();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);

      // Aplicar o comando
      document.execCommand(command, false, value);

      // Salvar seleção atualizada
      if (selection.rangeCount > 0) {
        savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
      }
    }

    // Desbloquear blur após um pequeno delay para garantir que o evento já passou
    setTimeout(() => { isFormattingRef.current = false; }, 150);
  };

  const updateTextStyle = (type: 'body', updates: Partial<TextStyles>) => {
    if (!activeProject) return;
    const key = 'bodyStyles';
    const updatedStyle = { ...activeProject.style, [key]: { ...activeProject.style[key], ...updates } };
    updateStyle(updatedStyle);
  };

  const handleContentEdit = useCallback((slideId: string, value: string, index: number) => {
    if (!activeProject) return;

    const updatedSlides = activeProject.slides.map(s => {
      if (s.id !== slideId) return s;
      const newContent = [...s.content];
      newContent[index] = value;
      return { ...s, content: newContent };
    });

    const updatedProject = { ...activeProject, slides: updatedSlides };
    setActiveProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));
  }, [activeProject]);

  const exportAllAsPDF = async () => {
    if (!activeProject) return;
    setPdfGenerating(true);
    setActiveTextPart(null);

    try {
      const isPortrait = activeProject.style.aspectRatio === '9:16';
      const doc = new jsPDF({
        orientation: isPortrait ? 'p' : 'l',
        unit: 'px',
        format: activeProject.style.aspectRatio === '1:1' ? [1080, 1080] : [1920, 1080]
      });

      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      for (let i = 0; i < activeProject.slides.length; i++) {
        const slide = activeProject.slides[i];
        const element = slideRefs.current[slide.id];

        if (element) {
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: activeProject.style.template === 'blueprint' ? '#312e81' : '#ffffff'
          });

          const imgData = canvas.toDataURL('image/png');
          if (i > 0) doc.addPage();
          doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }
      }

      doc.save(`${activeProject.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      setError("Erro ao gerar o PDF.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const exportSlideAsPNG = useCallback(async (slideId: string) => {
    const element = slideRefs.current[slideId];
    if (!element) return;
    setIsLoading(true);
    setActiveTextPart(null);
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `slide-${slideId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      setError("Falha ao exportar imagem.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleActivation = useCallback((slideId: string) => {
    setActiveTextPart(prev => {
      if (prev?.slideId === slideId) return prev;
      return { slideId, type: 'body' };
    });
  }, []);

  const getFontClass = (font: string) => {
    switch (font) {
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono';
      default: return 'font-sans';
    }
  };

  return (
    <div className={`h-screen flex flex-col bg-slate-50 overflow-x-hidden max-w-[100vw]`}>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveProject(null)}>
            <div className="bg-indigo-600 p-2 rounded-lg group-hover:rotate-12 transition-transform">
              <i className="fa-solid fa-chalkboard-user text-white text-xl"></i>
            </div>
            <h1 className="text-xl font-black tracking-tighter text-slate-900">LOUSA <span className="text-indigo-600">IQ</span></h1>
          </div>

          <div className="w-full md:flex-1 md:max-w-xl">
            <div className="relative group">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors"></i>
              <input
                type="text"
                placeholder="Pesquisar em suas aulas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-full font-bold transition-all shadow-md flex items-center gap-2 text-sm"
            >
              <i className="fa-solid fa-camera"></i>
              <span className="hidden sm:inline">Tirar Foto</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full font-bold transition-all shadow-md flex items-center gap-2 text-sm"
            >
              <i className="fa-solid fa-cloud-arrow-up"></i>
              <span className="hidden sm:inline">Enviar Quadros</span>
              <span className="sm:hidden text-[10px]">Galeria</span>
            </button>
            <input
              type="file"
              ref={cameraInputRef}
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFilesSelect}
            />
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleFilesSelect}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-4 md:py-6 overflow-y-auto">
        {(isLoading || pdfGenerating) && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[100] flex items-center justify-center flex-col no-print">
            <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-xl font-black text-slate-800 tracking-widest uppercase">{pdfGenerating ? "GERANDO PDF FINAL..." : "DIGITALIZANDO QUADRO..."}</p>
          </div>
        )}

        {!activeProject ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
            {filteredProjects.map(p => (
              <div key={p.id} onClick={() => setActiveProject(p)} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all border overflow-hidden cursor-pointer group relative">
                <img src={p.originalImages[0]} className="h-40 w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <button
                  onClick={(e) => deleteProject(p.id, e)}
                  className="absolute top-3 right-3 bg-white/90 backdrop-blur shadow-md w-8 h-8 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                  title="Excluir Aula"
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
                <div className="p-5">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{p.course}</p>
                  <h3 className="font-bold text-slate-800 mb-3">{p.name}</h3>
                  <div className="text-xs text-slate-400 flex justify-between">
                    <span>{p.slides.length} slides</span>
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-8 w-full overflow-visible">
            <div className="lg:col-span-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-8 no-print">
              <div className="space-y-2 w-full">
                <button onClick={() => setActiveProject(null)} className="text-indigo-600 font-bold text-sm mb-4 block hover:translate-x-[-4px] transition-transform">
                  <i className="fa-solid fa-chevron-left mr-2"></i> Voltar à Biblioteca
                </button>
                <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight break-words">{activeProject.name}</h2>
              </div>
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <button onClick={() => setShowAppearance(!showAppearance)} className={`px-5 py-3 md:py-2.5 rounded-xl font-bold transition-all border w-full md:w-auto flex justify-center items-center ${showAppearance ? 'bg-indigo-600 text-white' : 'bg-white'}`}>
                  <i className="fa-solid fa-palette mr-2"></i> Design
                </button>
                <button onClick={exportAllAsPDF} className="bg-slate-900 text-white px-5 py-3 md:py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg w-full md:w-auto flex justify-center items-center">
                  <i className="fa-solid fa-file-pdf mr-2"></i> PDF
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.capture = 'environment';
                    input.onchange = async (e) => {
                      const files = Array.from((e.target as HTMLInputElement).files || []);
                      if (files.length === 0) return;
                      const loaders = files.map(file => new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                      }));
                      const newImages = await Promise.all(loaders);
                      processAppendScan(newImages);
                    };
                    input.click();
                  }}
                  className="bg-slate-900 text-white px-5 py-3 md:py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all w-full md:w-auto flex justify-center items-center"
                >
                  <i className="fa-solid fa-camera mr-2"></i> Tirar Foto
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*';
                    input.onchange = async (e) => {
                      const files = Array.from((e.target as HTMLInputElement).files || []);
                      if (files.length === 0) return;
                      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                      const loaders = files.map(file => new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                      }));
                      const newImages = await Promise.all(loaders);
                      processAppendScan(newImages);
                    };
                    input.click();
                  }}
                  className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-5 py-3 md:py-2.5 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all w-full md:w-auto flex justify-center items-center"
                >
                  <i className="fa-solid fa-cloud-arrow-up mr-2"></i> Galeria
                </button>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6 no-print w-full max-w-full min-w-0">
              {showAppearance && (
                <div className="bg-white p-6 rounded-3xl border shadow-xl space-y-6 animate-in slide-in-from-left-4 duration-300">
                  <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs border-b pb-2">Layout Base</h4>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Aspect Ratio</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['16:9', '9:16', '1:1', '4:3'].map(r => (
                        <button key={r} onClick={() => updateStyle({ aspectRatio: r as any })} className={`p-2 rounded-lg border text-[10px] font-bold ${activeProject.style.aspectRatio === r ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : ''}`}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Template</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['modern', 'minimalist', 'blueprint', 'classic'].map(t => (
                        <button key={t} onClick={() => updateStyle({ template: t as any })} className={`p-2 rounded-lg border text-[10px] font-bold uppercase ${activeProject.style.template === t ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : ''}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}


            </div>

            <div className={`lg:col-span-9 space-y-12 w-full max-w-full min-w-0 ${getFontClass(activeProject.style.fontFamily)}`}>
              {activeProject.slides.map((slide, idx) => (
                <EditableSlide
                  key={slide.id}
                  slide={slide}
                  idx={idx}
                  style={activeProject.style}
                  activeTextPart={activeTextPart && activeTextPart.slideId === slide.id ? activeTextPart : null}
                  onActivation={handleActivation}
                  onEdit={handleContentEdit}
                  onExport={exportSlideAsPNG}
                  onFormat={applyCommand}
                  onStyleUpdate={updateTextStyle}
                  onDeactivate={() => setActiveTextPart(null)}
                  onMove={moveSlide}
                  totalSlides={activeProject.slides.length}
                  onPreview={(url) => setPreviewImage(url || slide.imageUrl || activeProject.originalImages[0])}
                  toolbarRef={toolbarRef}
                  isFormattingRef={isFormattingRef}
                  savedSelectionRef={savedSelectionRef}
                  ref={(el: HTMLDivElement | null) => { slideRefs.current[slide.id] = el; }}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {
        showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
            <div className="bg-white rounded-3xl p-6 w-[95%] md:max-w-2xl md:w-full shadow-2xl scale-in-center max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <i className="fa-solid fa-layer-group text-indigo-600"></i>
                Sequência detectada ({tempImages.length} fotos)
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-slate-100">
                {tempImages.map((img, i) => (
                  <div key={i} className="relative min-w-[120px] h-20 rounded-lg overflow-hidden border border-slate-200">
                    <img src={img} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setTempImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Disciplina"
                  className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newProjectMeta.course}
                  onChange={(e) => setNewProjectMeta({ ...newProjectMeta, course: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Tópico"
                  className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newProjectMeta.topic}
                  onChange={(e) => setNewProjectMeta({ ...newProjectMeta, topic: e.target.value })}
                />
              </div>

              {/* Model selection removed, using Llama 3 (Groq) exclusively */}

              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowUploadModal(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                <button onClick={processScan} className="flex-1 py-3 font-bold bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-colors">Digitalizar Agora</button>
              </div>
            </div>
          </div>
        )
      }

      <footer className="bg-white border-t border-slate-200 p-4 md:p-6 mt-20 no-print text-center opacity-30 text-xs font-bold uppercase tracking-widest w-full box-border">
        Lousa IQ — Digitalização Integral & Design Acadêmico
      </footer>

      {previewImage && (
        <div
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[200] p-4 md:p-12 flex flex-col items-center justify-center animate-in fade-in duration-300"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-7xl w-full h-full flex items-center justify-center">
            <img
              src={previewImage}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-500"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white w-12 h-12 rounded-full flex items-center justify-center transition-all border border-white/20"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>
      )}
    </div >
  );
};

export default App;
