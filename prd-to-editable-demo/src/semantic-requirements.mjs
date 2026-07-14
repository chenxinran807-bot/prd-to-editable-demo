const REQUIRED_ARRAYS = ['businessObjects', 'userActions', 'states', 'screens', 'transitions', 'evidence', 'assumptions', 'gaps'];
const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);

function requireString(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be a non-empty string`);
  return value.trim();
}

function requireStringArray(value, path) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return [...new Set(value.map((item, index) => requireString(item, `${path}[${index}]`)))];
}

function assertEvidenceInSource(quote, source, path) {
  if (!source.includes(quote)) throw new Error(`${path}: evidence quote is not present in the PRD`);
}

function normalizePageContent(value, source, screens) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('pageContent must be an array');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`pageContent[${index}] must be an object`);
    const screen = requireString(item.screen, `pageContent[${index}].screen`);
    if (!screens.includes(screen)) throw new Error(`pageContent screen must be declared in screens: ${screen}`);
    const evidence = requireString(item.evidence, `pageContent[${index}].evidence`);
    assertEvidenceInSource(evidence, source, `pageContent[${index}].evidence`);
    return { screen, elements: requireStringArray(item.elements, `pageContent[${index}].elements`), evidence };
  });
}

function normalizeInformationArchitecture(value, source, screens) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('informationArchitecture must be an array');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`informationArchitecture[${index}] must be an object`);
    const parent = requireString(item.parent, `informationArchitecture[${index}].parent`);
    if (!screens.includes(parent)) throw new Error(`informationArchitecture parent must be declared in screens: ${parent}`);
    const evidence = requireString(item.evidence, `informationArchitecture[${index}].evidence`);
    assertEvidenceInSource(evidence, source, `informationArchitecture[${index}].evidence`);
    return { parent, children: requireStringArray(item.children, `informationArchitecture[${index}].children`), evidence };
  });
}

export function validateSemanticRequirements(input, source) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('semantic requirements must be an object');
  if (input.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (input.extractionMode !== 'model-semantic') throw new Error('extractionMode must be model-semantic');
  if (!CONFIDENCE_LEVELS.has(input.confidence)) throw new Error('confidence must be high, medium, or low');
  for (const field of REQUIRED_ARRAYS) if (!Array.isArray(input[field])) throw new Error(`${field} must be an array`);

  const result = {
    schemaVersion: 1,
    extractionMode: 'model-semantic',
    confidence: input.confidence,
    title: requireString(input.title, 'title'),
    actor: requireString(input.actor, 'actor'),
    goal: requireString(input.goal, 'goal'),
    businessObjects: requireStringArray(input.businessObjects, 'businessObjects'),
    userActions: requireStringArray(input.userActions, 'userActions'),
    states: requireStringArray(input.states, 'states'),
    screens: requireStringArray(input.screens, 'screens'),
    transitions: input.transitions.map((transition, index) => {
      if (!transition || typeof transition !== 'object') throw new Error(`transitions[${index}] must be an object`);
      const normalized = {
        from: requireString(transition.from, `transitions[${index}].from`),
        action: requireString(transition.action, `transitions[${index}].action`),
        to: requireString(transition.to, `transitions[${index}].to`),
        evidence: requireString(transition.evidence, `transitions[${index}].evidence`)
      };
      assertEvidenceInSource(normalized.evidence, source, `transitions[${index}].evidence`);
      return normalized;
    }),
    evidence: input.evidence.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`evidence[${index}] must be an object`);
      const normalized = {
        kind: requireString(item.kind, `evidence[${index}].kind`),
        term: requireString(item.term, `evidence[${index}].term`),
        quote: requireString(item.quote, `evidence[${index}].quote`)
      };
      assertEvidenceInSource(normalized.quote, source, `evidence[${index}].quote`);
      return normalized;
    }),
    assumptions: requireStringArray(input.assumptions, 'assumptions'),
    gaps: requireStringArray(input.gaps, 'gaps')
  };
  result.pageContent = normalizePageContent(input.pageContent, source, result.screens);
  result.informationArchitecture = normalizeInformationArchitecture(input.informationArchitecture, source, result.screens);

  for (const transition of result.transitions) {
    if (!result.screens.includes(transition.from) || !result.screens.includes(transition.to)) {
      throw new Error(`transition endpoints must be declared in screens: ${transition.from} -> ${transition.to}`);
    }
  }
  for (const [field, kind] of [['businessObjects', 'business-object'], ['userActions', 'user-action']]) {
    for (const term of result[field]) {
      if (!result.evidence.some(item => item.kind === kind && item.term === term)) {
        throw new Error(`${field} term has no matching evidence: ${term}`);
      }
    }
  }
  return result;
}
