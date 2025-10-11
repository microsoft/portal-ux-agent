export interface DimensionScores {
  correctness: number;
  uiFidelity: number;
  compositionality: number;
  resilience: number;
  clarity: number;
}

export interface EvalScore {
  scenarioId: string;
  dimensionScores: DimensionScores;
  overall: number;
  warnings: string[];
  improvements: string[];
  notes: string;
  model: string;
  rawOutputPath: string;
  judgePromptPath: string;
  timestamp: string;
}

export interface ScenarioManifestEntry {
  id: string;
  file: string;
  expectedFile?: string;
}

export interface RunManifest {
  runId: string;
  createdAt: string;
  model: string;
  scenarios: ScenarioManifestEntry[];
  rubricPath: string;
}

export interface JudgeInput {
  scenarioId: string;
  scenarioText: string;
  agentOutput: string;
  expectedHeuristics?: any;
  rubric: string;
  model: string;
}
