# Evaluation Rubric

## Dimensions (0.0 - 5.0 each)
1. **Correctness**  
   UI matches user intent semantically; required data views/components present; no hallucinated categories.
2. **UI Fidelity**  
   Layout & component composition plausible for existing library; balanced granularity (not over / under fragmented).
3. **Compositionality**  
   Logical reuse & grouping (cards, KPI blocks, tables); appropriate abstraction for repeated patterns.
4. **Resilience**  
   Handles incomplete intent gracefully (placeholders, TODO markers) without crashing; no references to non-existent components.
5. **Clarity (Optional)**  
   Readable labels, accessible naming hints, concise identifiers.

## Scoring Guidance
| Score | Descriptor |
|-------|------------|
| 0     | Missing / unusable |
| 1     | Major gaps, little alignment |
| 2     | Partial alignment; several structural issues |
| 3     | Adequate; minor issues |
| 4     | Strong; small polish opportunities |
| 5     | Excellent; production-quality |

## Aggregation
Overall score = arithmetic mean of the numeric dimensions included (all five if clarity provided).

## Non-Numeric Annotations
Judge may emit:
- `warnings`: array of strings
- `improvements`: actionable suggestions
- `notes`: concise reasoning (< 500 chars)

## Edge Case Handling
- Empty or malformed agent output: all scores 0, warning added.
- Missing dimension evidence: score 0 with warning specifying missing evidence.
- Excess hallucinated components: deduct at least 1 point from correctness & fidelity.
