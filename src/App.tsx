import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Database, 
  Clock, 
  Lock, 
  Plus, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  Fingerprint,
  History,
  Zap,
  BarChart3,
  Play,
  Activity
} from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './ErrorBoundary';
import { memoryService, Memory, DerivationTier } from './memoryService';
import { benchmarkService, BenchmarkResult } from './benchmarkService';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getErrorMessage = (err: any): string => {
  if (!err) return "An unexpected error occurred.";
  
  let message = typeof err === 'string' ? err : err.message || String(err);
  
  try {
    const parsed = JSON.parse(message);
    if (parsed.error) {
      if (parsed.error.includes('permission-denied') || parsed.error.includes('insufficient permissions')) {
        return "Access Denied: You do not have permission to perform this neural operation.";
      }
      if (parsed.error.includes('quota-exceeded')) {
        return "System Overload: Neural quota exceeded. Please try again in the next cycle.";
      }
      return parsed.error;
    }
  } catch {
    // Not JSON
  }
  
  if (message.includes('API_KEY_INVALID')) {
    return "Neural Link Failed: Invalid Gemini API key. Please check your system configuration.";
  }
  
  return message;
};

function MemoryCard({ memory }: { memory: Memory }) {
  const validDate = memory.valid_from instanceof Timestamp 
    ? memory.valid_from.toDate() 
    : memory.valid_from;
  
  const transDate = memory.transaction_time instanceof Timestamp 
    ? memory.transaction_time.toDate() 
    : memory.transaction_time;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            memory.confidence > 0.8 ? "bg-emerald-500" : "bg-amber-500"
          )} />
          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
            Tier {memory.derivation_tier} • {(memory.confidence * 100).toFixed(0)}% Trust
          </span>
        </div>
        <div className="flex gap-1">
          <Fingerprint className="w-3 h-3 text-stone-300" />
          <span className="text-[8px] font-mono text-stone-300 truncate max-w-[60px]">
            {memory.hash}
          </span>
        </div>
      </div>

      <p className="text-stone-800 font-sans text-lg leading-relaxed mb-6">
        {memory.content}
      </p>

      <div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-4">
        <div>
          <span className="block text-[9px] font-mono uppercase text-stone-400 mb-1">Valid Time</span>
          <div className="flex items-center gap-1.5 text-stone-600">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-medium">{format(validDate, 'MMM d, yyyy')}</span>
          </div>
        </div>
        <div>
          <span className="block text-[9px] font-mono uppercase text-stone-400 mb-1">Transaction Time</span>
          <div className="flex items-center gap-1.5 text-stone-600">
            <History className="w-3 h-3" />
            <span className="text-xs font-medium">{format(transDate, 'HH:mm:ss')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'benchmark'>('feed');
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'memories'),
      where('uid', '==', user.uid),
      orderBy('transaction_time', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memory));
      setMemories(docs);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const filterMemories = async () => {
      if (!searchQuery.trim()) {
        setFilteredMemories(memories);
        return;
      }

      if (useSemanticSearch) {
        setIsSearching(true);
        setError(null);
        try {
          const results = await memoryService.semanticSearch(searchQuery, memories);
          setFilteredMemories(results);
        } catch (err: any) {
          console.error("Semantic search failed:", err);
          setError(getErrorMessage("Semantic search failed. Falling back to keyword search."));
          setUseSemanticSearch(false); // Fallback to keyword search
        } finally {
          setIsSearching(false);
        }
      } else {
        setFilteredMemories(memories.filter(m => 
          m.content.toLowerCase().includes(searchQuery.toLowerCase())
        ));
      }
    };

    const timer = setTimeout(filterMemories, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, memories, useSemanticSearch]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isAdding) return;

    setIsAdding(true);
    setError(null);
    try {
      const result = await memoryService.validateAndAddMemory(
        newContent, 
        new Date(), 
        DerivationTier.USER_EXPLICIT,
        memories
      );
      
      if (result.error) {
        setError(getErrorMessage(result.error));
      } else {
        setNewContent('');
      }
    } catch (err: any) {
      console.error("Failed to add memory:", err);
      setError(getErrorMessage(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    setError(null);
    try {
      const longMem = await benchmarkService.runLongMemEval(memories);
      const dmr = await benchmarkService.runDMR(memories);
      setBenchmarkResults([longMem, dmr]);
    } catch (err: any) {
      console.error("Benchmark failed:", err);
      setError(getErrorMessage("Failed to run evaluation. Please check your neural link."));
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleSeedData = async () => {
    setError(null);
    try {
      const seedFacts = [
        "The secret code for the vault is 4759.",
        "The meeting on March 15th was held in Berlin.",
        "The cat is Calico.",
        "Alice attended the meeting in Berlin."
      ];

      for (const fact of seedFacts) {
        const result = await memoryService.validateAndAddMemory(
          fact,
          new Date(),
          DerivationTier.USER_EXPLICIT,
          memories
        );
        if (result.error) {
          setError(getErrorMessage(`Seeding failed: ${result.error}`));
          break;
        }
      }
    } catch (err: any) {
      console.error("Seeding failed:", err);
      setError(getErrorMessage("Failed to seed benchmark data."));
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-stone-900 font-sans selection:bg-stone-900 selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-stone-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-serif italic tracking-tight">Nexus Memory</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 mr-4">
              <button 
                onClick={() => setActiveTab('feed')}
                className={cn(
                  "text-xs font-mono uppercase tracking-widest transition-all",
                  activeTab === 'feed' ? "text-stone-900 font-bold border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
                )}
              >
                Feed
              </button>
              <button 
                onClick={() => setActiveTab('benchmark')}
                className={cn(
                  "text-xs font-mono uppercase tracking-widest transition-all",
                  activeTab === 'benchmark' ? "text-stone-900 font-bold border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
                )}
              >
                Benchmark
              </button>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-full border border-stone-200">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Chain Verified</span>
            </div>
            <button 
              onClick={logout}
              className="text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 text-rose-800">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-rose-600 transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Input & Stats */}
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
              <h2 className="text-2xl font-serif italic mb-6">Ingest Fact</h2>
              <form onSubmit={handleAddMemory} className="space-y-4">
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="What happened? (e.g., 'Started learning Rust today')"
                  className="w-full h-32 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all resize-none text-stone-800 placeholder:text-stone-400"
                />
                <button
                  disabled={isAdding || !newContent.trim()}
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  {isAdding ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Commit to Chain
                    </>
                  )}
                </button>
              </form>
            </section>

            <section className="bg-stone-900 rounded-3xl p-8 text-white">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-mono uppercase tracking-widest opacity-60">System Health</h3>
                <Database className="w-4 h-4 opacity-60" />
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="opacity-60">Chain Integrity</span>
                    <span className="text-emerald-400">100%</span>
                  </div>
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-emerald-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <span className="block text-[10px] opacity-40 uppercase mb-1">Total Facts</span>
                    <span className="text-2xl font-serif italic">{memories.length}</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <span className="block text-[10px] opacity-40 uppercase mb-1">Avg Trust</span>
                    <span className="text-2xl font-serif italic">
                      {memories.length > 0 
                        ? (memories.reduce((acc, m) => acc + m.confidence, 0) / memories.length * 100).toFixed(0)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Feed / Benchmark */}
          <div className="lg:col-span-8 space-y-8">
            {activeTab === 'feed' ? (
              <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-3xl font-serif italic">Memory Feed</h2>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-full">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Semantic</span>
                  <button 
                    onClick={() => setUseSemanticSearch(!useSemanticSearch)}
                    className={cn(
                      "w-8 h-4 rounded-full transition-all relative",
                      useSemanticSearch ? "bg-stone-900" : "bg-stone-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                      useSemanticSearch ? "left-4.5" : "left-0.5"
                    )} />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder={useSemanticSearch ? "Search by meaning..." : "Search neural patterns..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-11 pr-6 py-3 bg-white border border-stone-200 rounded-full focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all w-full md:w-64"
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border-2 border-stone-900/10 border-t-stone-900 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AnimatePresence mode="popLayout">
                    {filteredMemories.map((memory) => (
                      <MemoryCard key={memory.id} memory={memory} />
                    ))}
                  </AnimatePresence>
                  
                  {filteredMemories.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-stone-400 space-y-4">
                      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
                        <History className="w-8 h-8" />
                      </div>
                      <p className="font-serif italic text-lg">No memories found in this timeline.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-serif italic">Recall Benchmarks</h2>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleSeedData}
                      className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-medium hover:bg-stone-200 transition-all"
                    >
                      Seed Benchmark Data
                    </button>
                    <button 
                      onClick={handleRunBenchmark}
                      disabled={isBenchmarking}
                      className="px-6 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium flex items-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {isBenchmarking ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Run Evaluation
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {benchmarkResults.map((res, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white border border-stone-200 rounded-3xl p-8 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-serif italic">{res.dataset}</h3>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest",
                          res.recallScore > 0.8 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          Recall: {(res.recallScore * 100).toFixed(1)}%
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-stone-400">Avg Latency</span>
                          <span className="font-mono">{res.latencyAvg.toFixed(2)}ms</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-stone-400">Tests Passed</span>
                          <span className="font-mono">{res.passed} / {res.totalTests}</span>
                        </div>
                        
                        <div className="pt-4 space-y-3">
                          {res.details.map((detail, dIdx) => (
                            <div key={dIdx} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-medium text-stone-500">{detail.testName}</span>
                                {detail.passed ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 text-rose-500" />
                                )}
                              </div>
                              <div className="text-[10px] text-stone-400">
                                Expected: <span className="text-stone-600">{detail.expected}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {benchmarkResults.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-stone-400 space-y-4 border-2 border-dashed border-stone-200 rounded-3xl">
                      <BarChart3 className="w-12 h-12 opacity-20" />
                      <p className="font-serif italic text-lg">No benchmark data available. Run evaluation to establish baseline.</p>
                    </div>
                  )}
                </div>

                {benchmarkResults.length > 0 && (
                  <div className="bg-stone-900 rounded-3xl p-8 text-white">
                    <div className="flex items-center gap-3 mb-8">
                      <Activity className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-lg font-serif italic">Optimization Roadmap</h3>
                    </div>
                    <div className="space-y-10">
                      {benchmarkResults.map((res, idx) => (
                        <div key={idx} className="relative pl-6 border-l border-white/10">
                          <div className="absolute -left-1.5 top-0 w-3 h-3 bg-stone-900 border-2 border-emerald-400 rounded-full" />
                          <h4 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-4">{res.dataset}</h4>
                          <div className="prose prose-invert prose-sm max-w-none text-stone-400">
                            <ReactMarkdown>
                              {res.dataset === "LongMemEval (Simulated)" 
                                ? "- Implement **Vector Embeddings** for semantic retrieval to improve DMR recall beyond exact keyword matching.\n- Introduce **Hierarchical Context Summarization** to handle \"Needle in a Haystack\" scenarios with 100k+ tokens.\n- Optimize **Bitemporal Indexing** to reduce latency in complex temporal reasoning queries."
                                : "- Optimize **Bitemporal Indexing** to reduce latency in complex temporal reasoning queries.\n- Improve **Multi-hop Reasoning** by traversing the audit trail more efficiently.\n- Implement **Graph-based Traversal** for deeper semantic linkage across disparate timelines."
                              }
                            </ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Landing() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6 overflow-hidden relative">
      {/* Atmospheric Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-2xl w-full text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8"
        >
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-400">Cryptographically Secure</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-6xl md:text-8xl font-serif italic text-white mb-8 tracking-tight"
        >
          Nexus <br />
          Memory
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-stone-400 text-lg md:text-xl font-sans leading-relaxed mb-12 max-w-lg mx-auto"
        >
          A bitemporal, neural-symbolic memory system with cryptographic audit trails and cascade invalidation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <button
            onClick={login}
            className="group relative px-8 py-4 bg-white text-stone-900 rounded-2xl font-medium overflow-hidden transition-all active:scale-95"
          >
            <div className="absolute inset-0 bg-stone-200 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-2">
              Initialize Neural Link
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-24 grid grid-cols-3 gap-8"
        >
          <div className="space-y-2">
            <span className="block text-[10px] font-mono uppercase text-white">Bitemporal</span>
            <div className="h-px bg-white/20" />
          </div>
          <div className="space-y-2">
            <span className="block text-[10px] font-mono uppercase text-white">Audit Trail</span>
            <div className="h-px bg-white/20" />
          </div>
          <div className="space-y-2">
            <span className="block text-[10px] font-mono uppercase text-white">Neural-Symbolic</span>
            <div className="h-px bg-white/20" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return user ? <Dashboard /> : <Landing />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

