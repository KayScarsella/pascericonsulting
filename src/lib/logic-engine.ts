import { UserResponseRow, SectionLogicRule } from "@/types/questions";

function isNonEmptyResponse(r: UserResponseRow): boolean {
  const t = r.answer_text
  if (t !== null && t !== undefined && String(t).trim() !== '') return true
  if (r.answer_json !== null && r.answer_json !== undefined) {
    if (Array.isArray(r.answer_json) && r.answer_json.length > 0) return true
    if (typeof r.answer_json === 'object' && !Array.isArray(r.answer_json)) return true
  }
  if (r.file_path) return true
  return false
}

/**
 * Merge parent + child response rows for display/prefill.
 * Child wins only when it has a non-empty answer; otherwise parent value is kept.
 * Avoids losing parent answers when the child session has empty placeholder rows.
 */
export function mergeParentChildResponses(
  parentRows: UserResponseRow[] | null,
  childRows: UserResponseRow[] | null
): UserResponseRow[] {
  const byId = new Map<string, UserResponseRow>()
  for (const r of parentRows || []) {
    if (isNonEmptyResponse(r)) byId.set(r.question_id, r)
  }
  for (const r of childRows || []) {
    if (isNonEmptyResponse(r)) {
      byId.set(r.question_id, r)
    } else if (!byId.has(r.question_id)) {
      // keep child row so file_path-only or structure isn't dropped
      byId.set(r.question_id, r)
    }
  }
  return Array.from(byId.values())
}

// Mappa le risposte per accesso veloce
export function mapResponses(responses: UserResponseRow[] | null) {
  const map: Record<string, unknown> = {};
  responses?.forEach(r => {
    const val = r.answer_text ?? r.answer_json
    if (val !== null && val !== undefined && val !== '') {
      map[r.question_id] = val
    } else if (r.answer_json !== null && r.answer_json !== undefined) {
      // oggetto/array JSON anche se answer_text vuoto
      if (Array.isArray(r.answer_json) && r.answer_json.length > 0) {
        map[r.question_id] = r.answer_json
      } else if (typeof r.answer_json === 'object' && !Array.isArray(r.answer_json)) {
        const keys = Object.keys(r.answer_json as object)
        if (keys.length > 0) map[r.question_id] = r.answer_json
      }
    }
  });
  return map;
}

export function checkSectionRules(
  rules: SectionLogicRule[] | null, 
  answersMap: Record<string, unknown>,
  extraDataMap: Record<string, Record<string, unknown>> = {} // 🛠️ Aggiungiamo la mappa extra
): SectionLogicRule | null {
  
  if (!rules || !Array.isArray(rules) || rules.length === 0) return null;

  for (const rule of rules) {
    const isRuleActive = rule.conditions.every(cond => {
      let rawValueToTest: unknown;
      if (cond.extra_field) {
          rawValueToTest = extraDataMap[cond.question_id]?.[cond.extra_field];
      } else {
          rawValueToTest = answersMap[cond.question_id];
      }

      if (cond.operator === 'is_not_empty') {
        return rawValueToTest !== undefined && rawValueToTest !== null && rawValueToTest !== '';
      }

      if (rawValueToTest === undefined || rawValueToTest === null || rawValueToTest === '') return false;

      // Normalizziamo per il confronto sicuro (come visto prima)
      const valA = typeof rawValueToTest === 'boolean' ? rawValueToTest : String(rawValueToTest).toLowerCase();
      const valB = typeof cond.value === 'boolean' ? cond.value : String(cond.value).toLowerCase();

      switch (cond.operator) {
        case 'eq': return valA === valB;
        case 'neq': return valA !== valB;
        case 'gt': return Number(rawValueToTest) > Number(cond.value);
        case 'lt': return Number(rawValueToTest) < Number(cond.value);
        default: return false;
      }
    });

    if (isRuleActive) return rule; 
  }
  return null; 
}