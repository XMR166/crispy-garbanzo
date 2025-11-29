
import React, { useState, useRef, useEffect } from 'react';
import { GameStatus, StoryState, Difficulty, Checkpoint, CharacterOptions } from './types';
import { initStory, nextTurn } from './services/geminiService';
import { StoryCard } from './components/StoryCard';
import { BookOpen, Sparkles, Settings, Send, RotateCcw, PenTool, X, Save, Disc, Skull, Shield, Sword, AlertTriangle, Users, Feather, Share2 } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.SETUP);
  const [topic, setTopic] = useState('');
  const [turnCount, setTurnCount] = useState(10);
  const [characterCount, setCharacterCount] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  
  // Current options for all characters
  const [currentCharacters, setCurrentCharacters] = useState<CharacterOptions[]>([]);
  
  // Theme state
  const [themeColor, setThemeColor] = useState<string>('indigo');

  // Multi-character selection state
  // Map of character name -> selected action
  const [pendingSelections, setPendingSelections] = useState<Record<string, string>>({});
  
  // Custom input state (tracked per character name)
  const [customInputTarget, setCustomInputTarget] = useState<string | null>(null);
  const [customActionText, setCustomActionText] = useState('');
  
  const [state, setState] = useState<StoryState>({
    topic: '',
    maxTurns: 10,
    characterCount: 1,
    currentTurn: 0,
    history: [],
    isGameOver: false,
    isLoading: false,
    error: null,
    difficulty: 'normal',
    checkpoint: null,
    finalTitle: undefined
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      // Small delay to ensure render is complete
      setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [state.history, state.isLoading, customInputTarget, state.isGameOver]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      topic: topic, 
      maxTurns: turnCount, 
      characterCount: characterCount,
      difficulty: difficulty, 
      error: null,
      finalTitle: undefined
    }));
    
    try {
      const segment = await initStory(topic, turnCount, difficulty, characterCount);
      
      if (segment.theme_color) setThemeColor(segment.theme_color);

      setState(prev => ({
        ...prev,
        isLoading: false,
        currentTurn: 1,
        history: [{ type: 'narrative', content: segment.text, image: segment.imageBase64 }],
        isGameOver: segment.isEnding
      }));
      setCurrentCharacters(segment.characters || []);
      setPendingSelections({});
      setStatus(GameStatus.PLAYING);
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Hubo un error al iniciar la historia. Por favor intenta de nuevo." 
      }));
    }
  };

  // Select an option for a specific character
  const selectOption = (characterName: string, option: string) => {
    setPendingSelections(prev => ({
      ...prev,
      [characterName]: option
    }));
    setCustomInputTarget(null); // Close custom input if open
  };

  // Handle a single character instant choice (Original behavior)
  const handleSinglePlayerChoice = (choice: string) => {
    const charName = currentCharacters[0].name;
    const choicesPrompt = `${charName} decide: "${choice}"`;
    executeTurn(choicesPrompt, [{ type: 'choice', content: choice }]);
  };

  // Submit all pending selections for multi-character mode
  const submitMultiTurn = () => {
    const choicesList = currentCharacters.map(char => {
      const choice = pendingSelections[char.name];
      return { name: char.name, choice: choice || "No hace nada" };
    });

    const choicesPrompt = choicesList.map(c => `${c.name} decide: "${c.choice}"`).join('\n');
    const displayContent = choicesList.map(c => `${c.name}: ${c.choice}`).join('\n');

    executeTurn(choicesPrompt, [{ type: 'choice', content: displayContent }]);
  };

  const executeTurn = async (promptString: string, historyItems: any[]) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      history: [...prev.history, ...historyItems]
    }));

    try {
      const nextTurnNum = state.currentTurn + 1;
      const segment = await nextTurn(promptString, nextTurnNum, state.maxTurns);

      if (segment.theme_color) setThemeColor(segment.theme_color);

      setState(prev => ({
        ...prev,
        isLoading: false,
        currentTurn: nextTurnNum,
        history: [...prev.history, { type: 'narrative', content: segment.text, image: segment.imageBase64 }],
        isGameOver: segment.isEnding,
        finalTitle: segment.isEnding ? segment.title : undefined
      }));
      setCurrentCharacters(segment.characters || []);
      setPendingSelections({});
      
      if (segment.isEnding) {
        setStatus(GameStatus.FINISHED);
      }
    } catch (err) {
      console.error(err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Error al generar la continuación. Intenta de nuevo."
      }));
      // Revert history on error
      setState(prev => ({
        ...prev,
        history: prev.history.slice(0, -historyItems.length)
      }));
    }
  };

  const saveCheckpoint = () => {
    const checkpoint: Checkpoint = {
      turn: state.currentTurn,
      history: [...state.history],
      characters: [...currentCharacters],
      themeColor: themeColor
    };
    setState(prev => ({ ...prev, checkpoint }));
  };

  const loadCheckpoint = () => {
    if (!state.checkpoint) return;
    setState(prev => ({
      ...prev,
      currentTurn: prev.checkpoint!.turn,
      history: prev.checkpoint!.history,
      isGameOver: false,
      isLoading: false,
      error: null
    }));
    setCurrentCharacters(state.checkpoint.characters);
    setThemeColor(state.checkpoint.themeColor);
    setPendingSelections({});
    setStatus(GameStatus.PLAYING);
  };

  const resetGame = () => {
    setStatus(GameStatus.SETUP);
    setTopic('');
    setTurnCount(10);
    setCurrentCharacters([]);
    setThemeColor('indigo');
    setPendingSelections({});
    setCustomInputTarget(null);
    setState({
      topic: '',
      maxTurns: 10,
      characterCount: 1,
      currentTurn: 0,
      history: [],
      isGameOver: false,
      isLoading: false,
      error: null,
      difficulty: 'normal',
      checkpoint: null,
      finalTitle: undefined
    });
  };

  const handleShare = async () => {
    const storyText = state.history
      .filter(h => h.type === 'narrative')
      .map(h => h.content)
      .join('\n\n');
      
    const title = state.finalTitle || `Historia: ${state.topic}`;
    const fullContent = `${title.toUpperCase()}\n\n${storyText}\n\nGenerado con Cuentacuentos Infinito`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: fullContent,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(fullContent);
      alert("Historia copiada al portapapeles");
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customActionText.trim() && customInputTarget) {
      if (state.characterCount === 1) {
        handleSinglePlayerChoice(customActionText.trim());
      } else {
        selectOption(customInputTarget, customActionText.trim());
      }
      setCustomInputTarget(null);
      setCustomActionText('');
    }
  };

  const getDifficultyIcon = (diff: Difficulty) => {
    switch(diff) {
      case 'easy': return <Shield className="w-5 h-5 text-emerald-700" />;
      case 'normal': return <Sword className="w-5 h-5 text-blue-700" />;
      case 'hard': return <Skull className="w-5 h-5 text-orange-700" />;
      case 'extreme': return <AlertTriangle className="w-5 h-5 text-red-700" />;
    }
  };

  // Helper for theme classes - defaulting to darker shades for light mode text
  const tc = (strength: number = 600) => `${themeColor}-${strength}`;

  // Check if all characters have a selection in multi-mode
  const allCharactersSelected = currentCharacters.length > 0 && 
    currentCharacters.every(c => pendingSelections[c.name]);

  const isPlaying = status === GameStatus.PLAYING || status === GameStatus.FINISHED;

  return (
    <div className={`min-h-screen ${isPlaying ? 'bg-[#292524] sm:bg-[#333]' : 'bg-[#2c1810]'} font-serif transition-colors duration-700 flex flex-col items-center overflow-x-hidden`}>
      
      {/* Settings (Book Cover) */}
      {status === GameStatus.SETUP && (
        <div className="w-full min-h-screen flex items-center justify-center p-4 py-12 bg-[#2c1810]">
          {/* Leather Book Cover Container */}
          <div className="relative max-w-2xl w-full bg-[#3f2e26] rounded-sm shadow-2xl border-r-[12px] border-l-[2px] border-y-[2px] border-[#251a14] overflow-hidden">
             {/* Texture overlay */}
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 pointer-events-none mix-blend-multiply"></div>
             
             {/* Gold frame */}
             <div className="relative z-10 p-2 sm:p-4 h-full border-[6px] border-[#a07e3e] m-3 sm:m-5 outline outline-2 outline-[#5a4638] outline-offset-[-10px]">
                
                {/* Corner Ornaments */}
                <div className="absolute top-2 left-2 text-[#a07e3e] opacity-80"><Sparkles className="w-6 h-6" /></div>
                <div className="absolute top-2 right-2 text-[#a07e3e] opacity-80"><Sparkles className="w-6 h-6" /></div>
                <div className="absolute bottom-2 left-2 text-[#a07e3e] opacity-80"><Sparkles className="w-6 h-6" /></div>
                <div className="absolute bottom-2 right-2 text-[#a07e3e] opacity-80"><Sparkles className="w-6 h-6" /></div>

                {/* Title Area */}
                <div className="text-center mt-8 mb-8">
                  <h1 className="text-4xl sm:text-5xl font-bold text-[#d4af37] tracking-wider uppercase" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.6)' }}>
                    Cuentacuentos<br/>Infinito
                  </h1>
                  <div className="h-px w-32 bg-[#a07e3e] mx-auto mt-4"></div>
                </div>

                {/* Paper Note Setup Form */}
                <div className="bg-[#f4ecd8] p-6 sm:p-8 shadow-[0_4px_6px_rgba(0,0,0,0.3)] transform rotate-1 max-w-lg mx-auto relative mb-6">
                  {/* Pin or Tape */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-[#d6cbb5]/80 rotate-[-1deg] shadow-sm"></div>

                  <form onSubmit={handleStart} className="space-y-6">
                    <div>
                      <label htmlFor="topic" className="block text-sm font-bold text-stone-800 uppercase tracking-widest mb-1 font-sans">
                        Tema de la Historia
                      </label>
                      <textarea
                        id="topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Escribe aquí el comienzo..."
                        className="w-full bg-transparent border-b-2 border-stone-400 p-2 text-stone-900 placeholder-stone-500 focus:border-stone-800 focus:outline-none transition-colors resize-none h-20 text-xl font-serif italic"
                        required
                      />
                      <p className="text-xs text-stone-500 italic mt-1 font-sans">
                        Describe el mundo, el conflicto inicial o el género de tu aventura.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="block text-xs font-bold text-stone-600 uppercase font-sans">Longitud Máxima</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="5"
                              max="20"
                              value={turnCount}
                              onChange={(e) => setTurnCount(Number(e.target.value))}
                              className="flex-1 accent-stone-800 h-1 bg-stone-300 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xl font-bold text-stone-800 w-8">{turnCount}</span>
                          </div>
                          <p className="text-xs text-stone-500 italic font-sans leading-tight">
                            Límite de turnos. La historia puede terminar antes si la trama se resuelve.
                          </p>
                       </div>
                       
                       <div className="space-y-2">
                          <label className="block text-xs font-bold text-stone-600 uppercase font-sans">Personajes</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="1"
                              max="4"
                              value={characterCount}
                              onChange={(e) => setCharacterCount(Number(e.target.value))}
                              className="flex-1 accent-stone-800 h-1 bg-stone-300 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xl font-bold text-stone-800 w-8">{characterCount}</span>
                          </div>
                          <p className="text-xs text-stone-500 italic font-sans leading-tight">
                            Número de protagonistas que controlarás simultáneamente.
                          </p>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="block text-xs font-bold text-stone-600 uppercase font-sans">Dificultad</label>
                       <div className="flex justify-between gap-1">
                          {(['easy', 'normal', 'hard', 'extreme'] as Difficulty[]).map((diff) => (
                            <button
                              key={diff}
                              type="button"
                              onClick={() => setDifficulty(diff)}
                              className={`p-2 rounded-md transition-all flex justify-center flex-1 ${
                                difficulty === diff
                                  ? 'text-stone-900 bg-stone-200 shadow-inner ring-1 ring-stone-400'
                                  : 'text-stone-400 hover:text-stone-600'
                              }`}
                              title={diff}
                            >
                              {getDifficultyIcon(diff)}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-stone-500 italic font-sans leading-tight">
                           Determina la probabilidad de supervivencia ante decisiones arriesgadas.
                        </p>
                    </div>

                    <button 
                      type="submit" 
                      disabled={state.isLoading}
                      className="w-full mt-4 bg-stone-900 text-[#f4ecd8] py-3 font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                      {state.isLoading ? '...' : 'Abrir Libro'}
                    </button>
                  </form>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Story (Pages) */}
      {isPlaying && (
        <div className="w-full max-w-4xl flex-1 flex flex-col relative">
          {/* Header Actions (Floating) */}
          <div className="fixed top-0 right-0 p-4 z-50 flex gap-2">
             {!state.isLoading && !state.isGameOver && (
                <button
                  onClick={saveCheckpoint}
                  className="bg-white/80 backdrop-blur text-stone-800 p-2 rounded-full shadow-md hover:bg-white border border-stone-200"
                  title="Guardar Checkpoint"
                >
                  <Save className="w-5 h-5" />
                </button>
             )}
             <div className="bg-white/80 backdrop-blur text-stone-800 px-3 py-2 rounded-full shadow-md border border-stone-200 font-bold font-serif text-sm">
                Pag. {state.currentTurn}
             </div>
          </div>

          {/* Book Page Container */}
          <div className="bg-[#f4ecd8] min-h-screen w-full max-w-3xl mx-auto shadow-2xl relative sm:my-8 px-6 py-12 sm:px-12 md:px-16 border-r border-stone-300">
             {/* Binding shadow effect (Left side) */}
             <div className="absolute top-0 bottom-0 left-0 w-8 sm:w-16 bg-gradient-to-r from-black/10 to-transparent pointer-events-none"></div>

             <div className="space-y-2 relative z-10">
                {state.history.map((item, idx) => (
                  <StoryCard 
                    key={idx} 
                    content={item.content} 
                    type={item.type} 
                    image={item.image}
                    isLatest={idx === state.history.length - 1 && item.type === 'narrative'}
                  />
                ))}

                {state.isLoading && (
                  <div className="flex justify-center py-12">
                     <div className="animate-pulse flex flex-col items-center gap-2 opacity-60">
                        <Feather className="w-8 h-8 text-stone-400" />
                        <span className="text-sm font-serif italic text-stone-500">La tinta se seca...</span>
                     </div>
                  </div>
                )}

                {state.isGameOver && state.finalTitle && (
                  <div className="mt-12 mb-8 text-center animate-fade-in">
                    <div className="text-stone-400 mb-2 font-sans text-xs uppercase tracking-[0.3em]">Fin de</div>
                    <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 uppercase tracking-widest leading-relaxed">
                      {state.finalTitle}
                    </h2>
                    <div className="h-1 w-24 bg-stone-800 mx-auto mt-6"></div>
                  </div>
                )}
                
                <div ref={scrollRef} className="h-24" /> {/* Spacer for footer */}
             </div>
          </div>

          {/* Controls Footer */}
          <div className="fixed bottom-0 left-0 w-full bg-[#f4ecd8] border-t border-[#e6dcc5] p-4 z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
            <div className="max-w-3xl mx-auto">
              {!state.isGameOver && !state.isLoading && (
                <div className="font-sans">
                  
                  {/* Custom Input */}
                  {customInputTarget && (
                    <form onSubmit={handleCustomSubmit} className="flex gap-2 items-center mb-4 p-2 bg-white rounded shadow-sm border border-stone-200">
                       <button
                        type="button"
                        onClick={() => { setCustomInputTarget(null); setCustomActionText(''); }}
                        className="p-2 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <input
                          type="text"
                          value={customActionText}
                          onChange={(e) => setCustomActionText(e.target.value)}
                          placeholder={`Acción para ${customInputTarget}...`}
                          autoFocus
                          className="flex-1 bg-transparent border-none focus:ring-0 text-stone-800 placeholder-stone-400"
                        />
                      <button
                        type="submit"
                        disabled={!customActionText.trim()}
                        className={`p-2 rounded bg-${tc(700)} text-white disabled:opacity-50`}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  )}

                  {!customInputTarget && (
                    <div className="space-y-4">
                      {/* Character Cards */}
                      <div className={`grid gap-3 ${state.characterCount > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        {currentCharacters.map((char, charIdx) => (
                          <div key={charIdx} className={state.characterCount > 1 ? "bg-white/50 p-3 rounded border border-stone-200" : ""}>
                            {state.characterCount > 1 && (
                               <div className="flex justify-between items-center mb-2">
                                  <h3 className="font-bold text-stone-800 text-sm">{char.name}</h3>
                                  {pendingSelections[char.name] && <span className="text-xs text-emerald-600 font-bold">✓</span>}
                               </div>
                            )}
                            
                            <div className="flex flex-wrap gap-2">
                              {char.options.map((opt, optIdx) => {
                                const isSelected = pendingSelections[char.name] === opt;
                                return (
                                  <button
                                    key={optIdx}
                                    onClick={() => state.characterCount === 1 ? handleSinglePlayerChoice(opt) : selectOption(char.name, opt)}
                                    className={`px-3 py-2 rounded text-sm transition-colors border text-left
                                      ${isSelected 
                                        ? `bg-${tc(100)} border-${tc(500)} text-${tc(900)}` 
                                        : `bg-white border-stone-300 text-stone-700 hover:border-${tc(400)}`
                                      }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                               <button
                                  onClick={() => { setCustomInputTarget(char.name); setCustomActionText(''); }}
                                  className="px-3 py-2 rounded text-sm border border-dashed border-stone-300 text-stone-500 hover:bg-stone-50"
                                  title="Escribir acción"
                                >
                                  <PenTool className="w-4 h-4" />
                                </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {state.characterCount > 1 && (
                        <button
                          onClick={submitMultiTurn}
                          disabled={!allCharactersSelected}
                          className={`w-full py-3 rounded font-bold uppercase tracking-widest text-sm transition-all shadow-md
                            ${allCharactersSelected 
                              ? `bg-${tc(800)} text-white hover:bg-${tc(900)}`
                              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            }`}
                        >
                          Continuar Relato
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {state.isGameOver && !state.isLoading && (
                <div className="flex flex-wrap gap-3 justify-center font-sans">
                  <button 
                    onClick={resetGame} 
                    className="px-6 py-3 rounded bg-stone-800 text-white font-bold uppercase tracking-widest shadow-lg hover:bg-stone-900"
                  >
                    Nuevo Libro
                  </button>

                  <button 
                    onClick={handleShare} 
                    className="px-6 py-3 rounded bg-amber-100 border border-amber-300 text-amber-900 font-bold uppercase tracking-widest shadow hover:bg-amber-200 flex items-center gap-2"
                  >
                    <Share2 className="w-5 h-5" />
                    Compartir
                  </button>

                  {state.checkpoint && (
                    <button 
                      onClick={loadCheckpoint} 
                      className="px-6 py-3 rounded bg-white border border-stone-300 text-stone-700 font-bold uppercase tracking-widest shadow hover:bg-stone-50"
                    >
                      Cargar Página
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
