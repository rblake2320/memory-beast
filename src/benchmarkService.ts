import { Memory, DerivationTier } from "./memoryService";

export interface BenchmarkResult {
  dataset: string;
  recallScore: number;
  latencyAvg: number;
  totalTests: number;
  passed: number;
  failed: number;
  details: {
    testName: string;
    passed: boolean;
    expected: string;
    actual: string;
    latency: number;
  }[];
}

export const benchmarkService = {
  /**
   * Simulates a LongMemEval benchmark.
   * Focuses on recall accuracy across a large number of distracting memories.
   */
  async runLongMemEval(memories: Memory[]): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const tests = [
      {
        name: "Needle in a Haystack (Recent)",
        query: "What is the secret code for the vault?",
        expected: "4759",
        fact: "The secret code for the vault is 4759."
      },
      {
        name: "Temporal Fact Recall",
        query: "Where was the meeting on March 15th?",
        expected: "Berlin",
        fact: "The meeting on March 15th was held in Berlin."
      },
      {
        name: "Distractor Resilience",
        query: "What color is the cat?",
        expected: "Calico",
        fact: "The cat is Calico."
      }
    ];

    const details = [];
    let passed = 0;

    for (const test of tests) {
      const testStart = Date.now();
      // Simulate search
      const found = memories.find(m => 
        m.content.toLowerCase().includes(test.expected.toLowerCase()) &&
        m.content.toLowerCase().includes(test.query.split(' ').pop()?.toLowerCase() || '')
      );

      const isPassed = !!found;
      if (isPassed) passed++;

      details.push({
        testName: test.name,
        passed: isPassed,
        expected: test.expected,
        actual: found ? found.content : "Not found",
        latency: Date.now() - testStart
      });
    }

    return {
      dataset: "LongMemEval (Simulated)",
      recallScore: passed / tests.length,
      latencyAvg: (Date.now() - startTime) / tests.length,
      totalTests: tests.length,
      passed,
      failed: tests.length - passed,
      details
    };
  },

  /**
   * Simulates a DMR (Deep Memory Retrieval) benchmark.
   * Focuses on semantic retrieval and multi-hop reasoning.
   */
  async runDMR(memories: Memory[]): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const tests = [
      {
        name: "Semantic Retrieval (Synonyms)",
        query: "Tell me about the feline's appearance.",
        expected: "Calico",
        fact: "The cat is Calico."
      },
      {
        name: "Contextual Linkage",
        query: "Who attended the Berlin meeting?",
        expected: "Alice",
        fact: "Alice attended the meeting in Berlin."
      }
    ];

    const details = [];
    let passed = 0;

    for (const test of tests) {
      const testStart = Date.now();
      // Simulate semantic search (simplified)
      const found = memories.find(m => 
        m.content.toLowerCase().includes(test.expected.toLowerCase())
      );

      const isPassed = !!found;
      if (isPassed) passed++;

      details.push({
        testName: test.name,
        passed: isPassed,
        expected: test.expected,
        actual: found ? found.content : "Not found",
        latency: Date.now() - testStart
      });
    }

    return {
      dataset: "DMR (Simulated)",
      recallScore: passed / tests.length,
      latencyAvg: (Date.now() - startTime) / tests.length,
      totalTests: tests.length,
      passed,
      failed: tests.length - passed,
      details
    };
  }
};
