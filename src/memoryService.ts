import CryptoJS from 'crypto-js';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  Timestamp, 
  doc, 
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { GoogleGenAI } from "@google/genai";

import { validationService } from './validationService';

export enum DerivationTier {
  USER_EXPLICIT = 0,
  USER_BEHAVIOR = 1,
  LLM_INFERENCE = 2,
  LLM_SYNTHESIS = 3,
  EXTERNAL = 4,
}

export interface Memory {
  id?: string;
  content: string;
  embedding?: number[];
  valid_from: Date | Timestamp;
  valid_until?: Date | Timestamp;
  transaction_time: Date | Timestamp;
  source_id?: string;
  confidence: number;
  derivation_tier: DerivationTier;
  prev_hash?: string;
  hash: string;
  superseded_by?: string;
  parent_id?: string;
  uid: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const memoryService = {
  async getLastHash(): Promise<string | undefined> {
    if (!auth.currentUser) return undefined;
    const path = 'memories';
    try {
      const q = query(
        collection(db, path),
        where('uid', '==', auth.currentUser.uid),
        orderBy('transaction_time', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return undefined;
      return (snapshot.docs[0].data() as Memory).hash;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  calculateHash(content: string, metadata: any, prevHash?: string): string {
    const data = JSON.stringify({
      content,
      metadata,
      prevHash: prevHash || '',
    });
    return CryptoJS.SHA256(data).toString();
  },

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: [text],
      });
      
      if (!result.embeddings || result.embeddings.length === 0) {
        throw new Error("No embeddings returned from model.");
      }
      
      return result.embeddings[0].values;
    } catch (error: any) {
      console.error("Embedding generation failed:", error);
      throw new Error(`Neural link failed: ${error.message || "Unknown error"}`);
    }
  },

  async addMemory(content: string, validFrom: Date, tier: DerivationTier, sourceId?: string, confidenceAdjustment: number = 1.0, parentId?: string): Promise<string> {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    const prevHash = await this.getLastHash();
    const baseConfidence = this.calculateConfidence(tier);
    const confidence = baseConfidence * confidenceAdjustment;
    const hash = this.calculateHash(content, { validFrom, tier, sourceId, parentId }, prevHash);
    
    const embedding = await this.generateEmbedding(content);
    
    const memory: Omit<Memory, 'id'> = {
      content,
      embedding,
      valid_from: Timestamp.fromDate(validFrom),
      transaction_time: serverTimestamp() as Timestamp,
      confidence,
      derivation_tier: tier,
      prev_hash: prevHash ?? null,
      hash,
      uid: auth.currentUser.uid,
      source_id: sourceId ?? null,
      parent_id: parentId ?? null,
    };

    const path = 'memories';
    try {
      const docRef = await addDoc(collection(db, path), memory);
      
      if (parentId) {
        await updateDoc(doc(db, path, parentId), {
          superseded_by: docRef.id
        });
      }

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  async getRevisionHistory(memoryId: string): Promise<Memory[]> {
    const path = 'memories';
    const history: Memory[] = [];
    let currentId: string | undefined = memoryId;

    try {
      while (currentId) {
        const docRef = doc(db, path, currentId);
        const docSnap = await getDocs(query(collection(db, path), where('__name__', '==', currentId)));
        
        if (docSnap.empty) break;
        
        const data = { id: docSnap.docs[0].id, ...docSnap.docs[0].data() } as Memory;
        history.push(data);
        currentId = data.parent_id;
      }
      return history;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  async semanticSearch(queryText: string, memories: Memory[], threshold: number = 0.7): Promise<Memory[]> {
    if (!queryText.trim()) return memories;
    
    const queryEmbedding = await this.generateEmbedding(queryText);
    
    const scoredMemories = memories.map(memory => {
      const similarity = memory.embedding ? this.cosineSimilarity(queryEmbedding, memory.embedding) : 0;
      return { ...memory, similarity };
    });

    return scoredMemories
      .filter(m => m.similarity >= threshold)
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  },

  /**
   * Hybrid Search: Combines vector embeddings with keyword matching.
   * This is a key optimization for high-recall retrieval systems.
   */
  async hybridSearch(queryText: string, memories: Memory[]): Promise<Memory[]> {
    if (!queryText.trim()) return memories;

    // 1. Semantic Search (Vector Embeddings)
    const semanticResults = await this.semanticSearch(queryText, memories, 0.4);
    
    // 2. Keyword Search (Exact Matching)
    const keywordResults = memories.filter(m => 
      m.content.toLowerCase().includes(queryText.toLowerCase())
    );
    
    // 3. Combine and Deduplicate
    const combined = [...semanticResults];
    keywordResults.forEach(km => {
      if (!combined.find(sm => sm.id === km.id)) {
        combined.push(km);
      }
    });
    
    return combined;
  },

  async validateAndAddMemory(content: string, validFrom: Date, tier: DerivationTier, existingMemories: Memory[]): Promise<{ id?: string, error?: string }> {
    const validation = await validationService.validateIngestion(content, existingMemories, tier);
    
    if (!validation.isValid) {
      return { error: validation.reason || "Memory rejected by security filters." };
    }

    const id = await this.addMemory(content, validFrom, tier, undefined, validation.suggestedConfidenceAdjustment);
    return { id };
  },

  calculateConfidence(tier: DerivationTier): number {
    switch (tier) {
      case DerivationTier.USER_EXPLICIT: return 0.95;
      case DerivationTier.USER_BEHAVIOR: return 0.85;
      case DerivationTier.LLM_INFERENCE: return 0.75;
      case DerivationTier.LLM_SYNTHESIS: return 0.65;
      case DerivationTier.EXTERNAL: return 0.55;
      default: return 0.5;
    }
  },

  async invalidateSource(sourceId: string) {
    if (!auth.currentUser) return;
    const path = 'memories';
    try {
      const q = query(
        collection(db, path),
        where('uid', '==', auth.currentUser.uid),
        where('source_id', '==', sourceId)
      );
      const snapshot = await getDocs(q);
      
      const promises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as Memory;
        // Halve confidence on invalidation
        return updateDoc(doc(db, path, docSnap.id), {
          confidence: data.confidence / 2,
          is_invalidated: true, // Flag for UI
        });
      });
      
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};
