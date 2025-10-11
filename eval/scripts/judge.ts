// Minimal local "judge" stub: replace `callModel` with real LLM integration.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { JudgeInput, EvalScore } from './types';

async function callModel(prompt: string, model: string): Promise<string> {
  // Placeholder deterministic JSON for offline scoring.
  // TODO: integrate with Azure/OpenAI provider using env vars.
  return JSON.stringify({
    dimensionScores: {
      correctness: 3.5,
      uiFidelity: 3.0,
      compositionality: 3.0,
      resilience: 3.5,
      clarity: 3.0
    },
    overall: 3.2,
    warnings: [],
    improvements: ["Integrate real LLM judge."],
    notes: "Stubbed score."
  });
}

export async function runJudge(input: JudgeInput, outDir: string): Promise<EvalScore> {
  const judgePrompt = fs.readFileSync(path.join(__dirname, '..', 'judges', 'llm-judge-prompt.txt'), 'utf8');
  const composite = [
    '=== RUBRIC ===',
    input.rubric,
    '=== SCENARIO ===',
    input.scenarioText,
    '=== RAW_OUTPUT ===',
    input.agentOutput || '<empty>',
    '=== OPTIONAL_EXPECTED ===',
    input.expectedHeuristics ? JSON.stringify(input.expectedHeuristics, null, 2) : '<none>',
    '=== INSTRUCTIONS ===',
    judgePrompt
  ].join('\n\n');

  const judgePromptPath = path.join(outDir, 'judge_prompt.txt');
  fs.writeFileSync(judgePromptPath, composite, 'utf8');

  const rawResp = await callModel(composite, input.model);
  let parsed: any;
  try {
    parsed = JSON.parse(rawResp);
  } catch (e) {
    parsed = {
      dimensionScores: { correctness: 0, uiFidelity: 0, compositionality: 0, resilience: 0, clarity: 0 },
      overall: 0,
      warnings: ['Judge JSON parse failure'],
      improvements: [],
      notes: 'Fallback zero due to parse error.'
    };
  }

  const score: EvalScore = {
    scenarioId: input.scenarioId,
    dimensionScores: parsed.dimensionScores,
    overall: parsed.overall,
    warnings: parsed.warnings || [],
    improvements: parsed.improvements || [],
    notes: parsed.notes || '',
    model: input.model,
    rawOutputPath: path.join(outDir, 'agent_output.txt'),
    judgePromptPath,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(path.join(outDir, 'score.json'), JSON.stringify(score, null, 2), 'utf8');
  return score;
}

// CLI usage
if (require.main === module) {
  (async () => {
    const [,, scenarioId, scenarioPath, agentOutputPath, rubricPath, expectedPath, model = 'stub-model'] = process.argv;
    if (!scenarioId) {
      console.error('Usage: node judge.js <scenarioId> <scenarioPath> <agentOutputPath> <rubricPath> <expectedPath?> <model?>');
      process.exit(1);
    }
    const scenarioText = fs.readFileSync(scenarioPath, 'utf8');
    const agentOutput = fs.existsSync(agentOutputPath) ? fs.readFileSync(agentOutputPath, 'utf8') : '';
    const rubric = fs.readFileSync(rubricPath, 'utf8');
    const expectedHeuristics = expectedPath && fs.existsSync(expectedPath) ? JSON.parse(fs.readFileSync(expectedPath, 'utf8')) : undefined;

    const outDir = path.join(path.dirname(agentOutputPath));
    await runJudge({
      scenarioId,
      scenarioText,
      agentOutput,
      expectedHeuristics,
      rubric,
      model
    }, outDir);
  })().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
