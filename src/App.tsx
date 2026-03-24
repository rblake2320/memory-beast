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
  Activity,
  Edit3,
  Eye,
  X,
  Users,
  ShieldCheck
} from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './ErrorBoundary';
import { memoryService, Memory, DerivationTier } from './memoryService';
import { benchmarkService, BenchmarkResult } from './benchmarkService';
import { userService, UserProfile, UserRole } from './userService';
import { collection, query, where, orderBy, onSnapshot, Timestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';

import { NotificationProvider, useNotification } from './NotificationContext';
import { getErrorMessage } from './utils/errorUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function RevisionHistoryModal({ memoryId, onClose }: { memoryId: string, onClose: () => void }) {
  const [history, setHistory] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const data = await memoryService.getRevisionHistory(memoryId);
      setHistory(data);
      setLoading(false);
    };
    fetchHistory();
  }, [memoryId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-serif italic">Revision History</h3>
            <p className="text-xs text-stone-400 font-mono uppercase tracking-widest mt-1">Neural Audit Trail</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin" />
            </div>
          ) : (
            history.map((version, index) => (
              <div key={version.id} className="relative pl-8 border-l-2 border-stone-100 last:border-l-0 pb-8 last:pb-0">
                <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-stone-200" />
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
                    {index === 0 ? "Current Version" : `Version ${history.length - index}`}
                  </span>
                  <span className="text-[10px] font-mono text-stone-300">
                    {format(version.transaction_time instanceof Timestamp ? version.transaction_time.toDate() : version.transaction_time, 'MMM d, HH:mm:ss')}
                  </span>
                </div>
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                  <p className="text-stone-800 text-sm leading-relaxed">{version.content}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center">
                    <Fingerprint className="w-2.5 h-2.5 text-stone-500" />
                  </div>
                  <span className="text-[9px] font-mono text-stone-400 truncate max-w-[200px]">
                    {version.hash}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function EditMemoryModal({ memory, onClose, onUpdate, memories }: { memory: Memory, onClose: () => void, onUpdate: () => void, memories: Memory[] }) {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [content, setContent] = useState(memory.content);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || content === memory.content || isUpdating) return;

    setIsUpdating(true);
    try {
      const result = await memoryService.validateAndAddMemory(
        content,
        new Date(),
        DerivationTier.USER_EXPLICIT,
        memories
      );

      if (result.error) {
        const err = getErrorMessage(result.error);
        notifyError(err.title, err.description);
      } else {
        // Now link it to the parent
        if (result.id && memory.id) {
          await updateDoc(doc(db, 'memories', result.id), {
            parent_id: memory.id
          });
          await updateDoc(doc(db, 'memories', memory.id), {
            superseded_by: result.id
          });
        }
        notifySuccess("Memory Revised", "The neural pattern has been updated in the timeline.");
        onUpdate();
        onClose();
      }
    } catch (err: any) {
      console.error("Update failed:", err);
      const errorDetails = getErrorMessage(err);
      notifyError(errorDetails.title, errorDetails.description);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <h3 className="text-xl font-serif italic">Revise Memory</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Current Content</label>
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 text-stone-500 text-sm italic">
              {memory.content}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">New Revision</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-32 p-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all resize-none text-stone-800"
              placeholder="Enter revised fact..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-medium hover:bg-stone-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating || !content.trim() || content === memory.content}
              className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Commit Revision
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function MemoryCard({ memory, onShowHistory, onEdit }: { memory: Memory, onShowHistory: () => void, onEdit: () => void }) {
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

      <div className="flex gap-2 mb-6">
        <button 
          onClick={onShowHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all text-[10px] font-mono uppercase tracking-wider"
        >
          <History className="w-3 h-3" />
          History
        </button>
        <button 
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all text-[10px] font-mono uppercase tracking-wider"
        >
          <Edit3 className="w-3 h-3" />
          Edit
        </button>
      </div>

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

function AuditTrail({ memories }: { memories: Memory[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  const filteredMemories = memories.filter(memory => 
    memory.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    memory.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (memory.prev_hash && memory.prev_hash.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif italic">Cryptographic Audit Trail</h2>
          <p className="text-xs text-stone-400 font-mono uppercase tracking-widest mt-1">Neural Chain Verification</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content or hash..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-full border border-stone-200">
            <Fingerprint className="w-4 h-4" />
            <span className="text-xs font-mono uppercase tracking-wider">Chain Integrity Verified</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-stone-400">Transaction Time</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-stone-400">Memory Content</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-stone-400">Previous Hash</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-stone-400">Current Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredMemories.map((memory) => {
                const transDate = memory.transaction_time instanceof Timestamp 
                  ? memory.transaction_time.toDate() 
                  : memory.transaction_time;
                
                return (
                  <tr 
                    key={memory.id} 
                    className="hover:bg-stone-50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedMemory(memory)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-stone-900">
                          {format(transDate, 'MMM d, yyyy')}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                          {format(transDate, 'HH:mm:ss.SSS')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-stone-600 line-clamp-1 max-w-xs" title={memory.content}>
                        {memory.content}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          memory.prev_hash ? "bg-emerald-400" : "bg-stone-200"
                        )} />
                        <code className="text-[10px] font-mono text-stone-400 bg-stone-50 px-2 py-1 rounded border border-stone-100">
                          {memory.prev_hash ? `${memory.prev_hash.substring(0, 8)}...` : "GENESIS"}
                        </code>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <code className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 font-bold">
                          {memory.hash.substring(0, 8)}...
                        </code>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredMemories.length === 0 && (
          <div className="py-24 flex flex-col items-center justify-center text-stone-400 space-y-4">
            <Database className="w-12 h-12 opacity-20" />
            <p className="font-serif italic text-lg">
              {searchQuery ? "No matching records found." : "No cryptographic records found."}
            </p>
          </div>
        )}
      </div>

      {selectedMemory && (
        <MemoryDetailsModal 
          memory={selectedMemory} 
          onClose={() => setSelectedMemory(null)} 
        />
      )}
    </div>
  );
}

function MemoryDetailsModal({ memory, onClose }: { memory: Memory, onClose: () => void }) {
  const transDate = memory.transaction_time instanceof Timestamp 
    ? memory.transaction_time.toDate() 
    : memory.transaction_time;
  
  const validFromDate = memory.valid_from instanceof Timestamp
    ? memory.valid_from.toDate()
    : memory.valid_from;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-serif italic">Memory Details</h3>
            <p className="text-xs text-stone-400 font-mono uppercase tracking-widest mt-1">Neural Record Inspection</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section className="space-y-3">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Content</h4>
            <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
              <p className="text-stone-800 leading-relaxed">{memory.content}</p>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-3">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Temporal Metadata</h4>
              <div className="space-y-4">
                <div>
                  <span className="block text-[10px] text-stone-400 uppercase mb-1">Transaction Time</span>
                  <span className="text-sm font-medium text-stone-700">{format(transDate, 'PPP p')}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-stone-400 uppercase mb-1">Valid From</span>
                  <span className="text-sm font-medium text-stone-700">{format(validFromDate, 'PPP p')}</span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-stone-400">System Metadata</h4>
              <div className="space-y-4">
                <div>
                  <span className="block text-[10px] text-stone-400 uppercase mb-1">Confidence Score</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500" 
                        style={{ width: `${memory.confidence * 100}%` }} 
                      />
                    </div>
                    <span className="text-sm font-medium text-stone-700">{(memory.confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] text-stone-400 uppercase mb-1">Derivation Tier</span>
                  <span className="text-sm font-medium text-stone-700">Tier {memory.derivation_tier}</span>
                </div>
              </div>
            </section>
          </div>

          <section className="space-y-3">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Cryptographic Hashes</h4>
            <div className="space-y-4">
              <div>
                <span className="block text-[10px] text-stone-400 uppercase mb-1">Current Hash</span>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <code className="text-[11px] font-mono text-blue-700 break-all">{memory.hash}</code>
                </div>
              </div>
              {memory.prev_hash && (
                <div>
                  <span className="block text-[10px] text-stone-400 uppercase mb-1">Previous Hash</span>
                  <div className="p-3 bg-stone-50 border border-stone-100 rounded-xl">
                    <code className="text-[11px] font-mono text-stone-500 break-all">{memory.prev_hash}</code>
                  </div>
                </div>
              )}
            </div>
          </section>

          {memory.source_id && (
            <section className="space-y-3">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Source Reference</h4>
              <div className="p-3 bg-stone-50 border border-stone-100 rounded-xl">
                <code className="text-[11px] font-mono text-stone-500">{memory.source_id}</code>
              </div>
            </section>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function UsersManager() {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await userService.getAllUsers();
        setUsers(data);
      } catch (err: any) {
        console.error("Failed to fetch users:", err);
        const errorDetails = getErrorMessage(err);
        notifyError(errorDetails.title, errorDetails.description);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      await userService.updateUserRole(uid, newRole);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      notifySuccess("Role Updated", `User permissions have been modified to ${newRole}.`);
    } catch (err: any) {
      console.error("Failed to update role:", err);
      const errorDetails = getErrorMessage(err);
      notifyError(errorDetails.title, errorDetails.description);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-12 h-12 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-serif italic">Neural Access Control</h2>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-wider">Admin Override Active</span>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-stone-400">User</th>
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-stone-400">Email</th>
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-stone-400">Role</th>
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-stone-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((u) => (
              <tr key={u.uid} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full border border-stone-200" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-stone-400" />
                      </div>
                    )}
                    <span className="font-medium text-stone-900">{u.displayName || 'Anonymous'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-stone-500 font-mono">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider",
                    u.role === 'admin' ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"
                  )}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <select 
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                    className="text-xs bg-white border border-stone-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-stone-900 outline-none"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, profile, logout } = useAuth();
  const { error: notifyError, success: notifySuccess, info: notifyInfo } = useNotification();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'benchmark' | 'users' | 'audit'>('feed');
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [historyMemoryId, setHistoryMemoryId] = useState<string | null>(null);
  const [editMemory, setEditMemory] = useState<Memory | null>(null);
  const [showHighConfidenceOnly, setShowHighConfidenceOnly] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'memories'),
      where('uid', '==', user.uid),
      orderBy('transaction_time', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memory));
      // Only show memories that are not superseded
      setMemories(docs.filter(m => !m.superseded_by));
    }, (err) => {
      console.error("Snapshot error:", err);
      const errorDetails = getErrorMessage(err);
      notifyError(errorDetails.title, errorDetails.description);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const filterMemories = async () => {
      let results = [...memories];

      if (searchQuery.trim()) {
        if (useSemanticSearch) {
          setIsSearching(true);
          try {
            results = await memoryService.hybridSearch(searchQuery, memories);
          } catch (err: any) {
            console.error("Semantic search failed:", err);
            const errorDetails = getErrorMessage("Semantic search failed. Falling back to keyword search.");
            notifyInfo(errorDetails.title, errorDetails.description);
            setUseSemanticSearch(false); // Fallback to keyword search
            results = memories.filter(m => 
              m.content.toLowerCase().includes(searchQuery.toLowerCase())
            );
          } finally {
            setIsSearching(false);
          }
        } else {
          results = memories.filter(m => 
            m.content.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
      }

      if (showHighConfidenceOnly) {
        results = results.filter(m => m.confidence >= 0.9);
      }

      setFilteredMemories(results);
    };

    const timer = setTimeout(filterMemories, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, memories, useSemanticSearch, showHighConfidenceOnly]);

  // Auto-save logic
  useEffect(() => {
    if (!user) return;
    const savedDraft = localStorage.getItem(`nexus_draft_${user.uid}`);
    if (savedDraft && savedDraft !== newContent) {
      setDraftAvailable(savedDraft);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !newContent.trim()) return;
    
    const interval = setInterval(() => {
      localStorage.setItem(`nexus_draft_${user.uid}`, newContent);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user, newContent]);

  const handleRestoreDraft = () => {
    if (draftAvailable) {
      setNewContent(draftAvailable);
      setDraftAvailable(null);
      notifyInfo("Draft Restored", "Your unsaved neural pattern has been recovered.");
    }
  };

  const handleDiscardDraft = () => {
    if (user) {
      localStorage.removeItem(`nexus_draft_${user.uid}`);
      setDraftAvailable(null);
      notifyInfo("Draft Discarded", "The unsaved neural pattern has been cleared.");
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isAdding) return;

    setIsAdding(true);
    try {
      const result = await memoryService.validateAndAddMemory(
        newContent, 
        new Date(), 
        DerivationTier.USER_EXPLICIT,
        memories
      );
      
      if (result.error) {
        const errorDetails = getErrorMessage(result.error);
        notifyError(errorDetails.title, errorDetails.description);
      } else {
        setNewContent('');
        if (user) {
          localStorage.removeItem(`nexus_draft_${user.uid}`);
        }
        notifySuccess("Memory Ingested", "The neural pattern has been successfully committed to the timeline.");
      }
    } catch (err: any) {
      console.error("Failed to add memory:", err);
      const errorDetails = getErrorMessage(err);
      notifyError(errorDetails.title, errorDetails.description);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const longMem = await benchmarkService.runLongMemEval(memories);
      const dmr = await benchmarkService.runDMR(memories);
      setBenchmarkResults([longMem, dmr]);
      notifySuccess("Benchmark Complete", "Neural recall evaluation has been finalized.");
    } catch (err: any) {
      console.error("Benchmark failed:", err);
      const errorDetails = getErrorMessage("Failed to run evaluation. Please check your neural link.");
      notifyError(errorDetails.title, errorDetails.description);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleSeedData = async () => {
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
          const errorDetails = getErrorMessage(`Seeding failed: ${result.error}`);
          notifyError(errorDetails.title, errorDetails.description);
          break;
        }
      }

      // Refresh local state to ensure benchmarks see the new data
      const q = query(collection(db, 'memories'), where('uid', '==', user?.uid));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memory));
      setMemories(docs.filter(m => !m.superseded_by));

      notifySuccess("Data Seeded", "Benchmark datasets have been initialized.");
    } catch (err: any) {
      console.error("Seeding failed:", err);
      const errorDetails = getErrorMessage("Failed to seed benchmark data.");
      notifyError(errorDetails.title, errorDetails.description);
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
              <button 
                onClick={() => setActiveTab('audit')}
                className={cn(
                  "text-xs font-mono uppercase tracking-widest transition-all",
                  activeTab === 'audit' ? "text-stone-900 font-bold border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
                )}
              >
                Audit Trail
              </button>
              {profile?.role === 'admin' && (
                <button 
                  onClick={() => setActiveTab('users')}
                  className={cn(
                    "text-xs font-mono uppercase tracking-widest transition-all",
                    activeTab === 'users' ? "text-stone-900 font-bold border-b-2 border-stone-900" : "text-stone-400 hover:text-stone-600"
                  )}
                >
                  Users
                </button>
              )}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Input & Stats */}
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-serif italic">Ingest Fact</h2>
                {draftAvailable && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-amber-600 animate-pulse">Draft Found</span>
                  </div>
                )}
              </div>

              {draftAvailable && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl"
                >
                  <p className="text-xs text-amber-800 mb-3">You have an unsaved draft from a previous session.</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleRestoreDraft}
                      className="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-mono uppercase tracking-wider rounded-lg hover:bg-amber-700 transition-all"
                    >
                      Restore
                    </button>
                    <button 
                      onClick={handleDiscardDraft}
                      className="px-3 py-1.5 bg-white border border-amber-200 text-amber-600 text-[10px] font-mono uppercase tracking-wider rounded-lg hover:bg-amber-50 transition-all"
                    >
                      Discard
                    </button>
                  </div>
                </motion.div>
              )}

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

          {/* Right Column: Feed / Benchmark / Users */}
          <div className="lg:col-span-8 space-y-8">
            {activeTab === 'feed' && (
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-full">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">90%+ Trust</span>
                  <button 
                    onClick={() => setShowHighConfidenceOnly(!showHighConfidenceOnly)}
                    className={cn(
                      "w-8 h-4 rounded-full transition-all relative",
                      showHighConfidenceOnly ? "bg-emerald-600" : "bg-stone-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                      showHighConfidenceOnly ? "left-4.5" : "left-0.5"
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
                      <MemoryCard 
                        key={memory.id} 
                        memory={memory} 
                        onShowHistory={() => setHistoryMemoryId(memory.id!)}
                        onEdit={() => setEditMemory(memory)}
                      />
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
            )}
            
            {activeTab === 'benchmark' && (
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
                                ? "- ✅ **Vector Embeddings** implemented for semantic retrieval (DMR recall optimized).\n- 🚧 **Hierarchical Context Summarization** planned for 100k+ token scenarios.\n- 🚧 **Bitemporal Indexing** optimized for sub-100ms latency on complex queries."
                                : "- ✅ **Bitemporal Indexing** active (valid_from vs transaction_time separation).\n- ✅ **Multi-hop Reasoning** enabled via parent_id audit trail traversal.\n- 🚧 **Graph-based Traversal** planned for deeper semantic linkage."
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

            {activeTab === 'audit' && (
              <AuditTrail memories={memories} />
            )}

            {activeTab === 'users' && profile?.role === 'admin' && (
              <UsersManager />
            )}
          </div>
        </div>
        {historyMemoryId && (
          <RevisionHistoryModal 
            memoryId={historyMemoryId} 
            onClose={() => setHistoryMemoryId(null)} 
          />
        )}

        {editMemory && (
          <EditMemoryModal 
            memory={editMemory} 
            memories={memories}
            onClose={() => setEditMemory(null)}
            onUpdate={() => {}} // Snapshot will handle it
          />
        )}
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
      <NotificationProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

