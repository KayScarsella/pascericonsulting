import { UserResponseRow, SectionLogicRule } from "@/types/questions";

// Mappa le risposte per accesso veloce
export function mapResponses(responses: UserResponseRow[] | null) {
  const map: Record<string, unknown> = {};
  responses?.forEach(r => {
    const val = r.answer_text || r.answer_json; 
    if (val !== null && val !== '') {
      map[r.question_id] = val; 
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
      let rawValueToTest;
      if (cond.extra_field) {
          rawValueToTest = extraDataMap[cond.question_id]?.[cond.extra_field];
      } else {
          rawValueToTest = answersMap[cond.question_id];
      }

      if (rawValueToTest === undefined || rawValueToTest === null || rawValueToTest === '') return false;

      // Normalizziamo per il confronto sicuro (come visto prima)
      const valA = typeof rawValueToTest === 'boolean' ? rawValueToTest : String(rawValueToTest).toLowerCase();
      const valB = typeof cond.value === 'boolean' ? cond.value : String(cond.value).toLowerCase();

      switch (cond.operator) {
        case 'eq': return valA === valB;
        case 'neq': return valA !== valB;
        default: return false;
      }
    });

    if (isRuleActive) return rule; 
  }
  return null; 
}