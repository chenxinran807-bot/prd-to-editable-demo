const PRIORITY_RANK = new Map([['P0', 0], ['P1', 1], ['P2', 2]]);
const QUESTION_FIELDS = [
  'id', 'theme', 'requirementId', 'priority', 'question', 'options',
  'impact', 'source', 'sourceIds', 'evidence',
  'recommendation',
];

function fail(message) {
  throw new TypeError(`Invalid clarification: ${message}`);
}

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string`);
}

function validateBlockers(blockers) {
  if (!Array.isArray(blockers)) fail('blockers must be an array');
  const ids = new Set();
  blockers.forEach((blocker, index) => {
    if (!blocker || typeof blocker !== 'object' || Array.isArray(blocker)) fail(`blockers[${index}] must be an object`);
    for (const field of ['id', 'theme', 'priority', 'requirementId', 'question']) nonEmptyString(blocker[field], `blockers[${index}].${field}`);
    if (!PRIORITY_RANK.has(blocker.priority)) fail(`blockers[${index}].priority must be P0, P1, or P2`);
    if (blocker.options !== undefined) {
      if (!Array.isArray(blocker.options) || blocker.options.length === 0) fail(`blockers[${index}].options must be a non-empty array`);
      const options = new Set();
      blocker.options.forEach((option, optionIndex) => {
        nonEmptyString(option, `blockers[${index}].options[${optionIndex}]`);
        const normalized = option.trim();
        if (options.has(normalized)) fail(`blockers[${index}].options contains duplicate option ${normalized}`);
        options.add(normalized);
      });
    }
    if (ids.has(blocker.id)) fail(`duplicate blocker id ${blocker.id}`);
    ids.add(blocker.id);
  });
}

function questionFrom(blocker) {
  return Object.fromEntries(QUESTION_FIELDS
    .filter((field) => blocker[field] !== undefined)
    .map((field) => [field, structuredClone(blocker[field])]));
}

export function buildClarificationTurn(blockers) {
  validateBlockers(blockers);
  if (blockers.length === 0) return null;

  const ranked = blockers
    .map((blocker, index) => ({ blocker, index }))
    .sort((left, right) => PRIORITY_RANK.get(left.blocker.priority) - PRIORITY_RANK.get(right.blocker.priority)
      || left.index - right.index);
  const theme = ranked[0].blocker.theme;
  const questions = ranked
    .filter(({ blocker }) => blocker.theme === theme)
    .slice(0, 3)
    .map(({ blocker }) => questionFrom(blocker));
  return { theme, questions };
}

function validateAnswers(answers, blockerIds) {
  if (!Array.isArray(answers)) fail('answers must be an array');
  const ids = new Set();
  answers.forEach((answer, index) => {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) fail(`answers[${index}] must be an object`);
    for (const field of ['blockerId', 'answer', 'answeredAt']) nonEmptyString(answer[field], `answers[${index}].${field}`);
    if (ids.has(answer.blockerId)) fail(`duplicate answer for blocker ${answer.blockerId}`);
    if (!blockerIds.has(answer.blockerId)) fail(`answer references unknown blocker ${answer.blockerId}`);
    ids.add(answer.blockerId);
  });
}

function validateRequirements(requirements) {
  const ids = new Set();
  requirements.forEach((requirement, index) => {
    if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) fail(`requirements[${index}] must be an object`);
    nonEmptyString(requirement.id, `requirements[${index}].id`);
    if (ids.has(requirement.id)) fail(`duplicate requirement id ${requirement.id}`);
    ids.add(requirement.id);
  });
  return ids;
}

export function applyClarifications(ir, answers) {
  if (!ir || typeof ir !== 'object' || Array.isArray(ir)) fail('ir must be an object');
  if (!Array.isArray(ir.blockers)) fail('ir.blockers must be an array');
  if (!Array.isArray(ir.requirements)) fail('ir.requirements must be an array');

  validateBlockers(ir.blockers);
  const requirementIds = validateRequirements(ir.requirements);
  for (const blocker of ir.blockers) {
    if (!requirementIds.has(blocker.requirementId)) fail(`blocker ${blocker.id} references unknown requirement ${blocker.requirementId}`);
  }
  const blockerIds = new Set(ir.blockers.map(({ id }) => id));
  validateAnswers(answers, blockerIds);
  const blockerById = new Map(ir.blockers.map((blocker) => [blocker.id, blocker]));
  const result = structuredClone(ir);
  const answeredIds = new Set(answers.map(({ blockerId }) => blockerId));
  result.blockers = result.blockers.filter(({ id }) => !answeredIds.has(id));

  for (const answer of answers) {
    const requirementId = blockerById.get(answer.blockerId).requirementId;
    const requirement = result.requirements.find(({ id }) => id === requirementId);
    if (!requirement) continue;
    if (requirement.confirmations === undefined) requirement.confirmations = [];
    if (!Array.isArray(requirement.confirmations)) fail(`requirement ${requirementId}.confirmations must be an array`);
    requirement.confirmations.push(structuredClone(answer));
  }

  for (const requirement of result.requirements) {
    const hadLinkedBlocker = ir.blockers.some(({ requirementId }) => requirementId === requirement.id);
    const hasUnresolvedBlocker = result.blockers.some(({ requirementId }) => requirementId === requirement.id);
    if (hadLinkedBlocker && !hasUnresolvedBlocker) requirement.certainty = 'confirmed';
  }
  return result;
}
