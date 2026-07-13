export function validateModel(model) {
  if (!Array.isArray(model.pages) || model.pages.length === 0) throw new Error('model requires pages');
  const pageIds = new Set();
  const keys = new Set();
  for (const page of model.pages) {
    if (pageIds.has(page.id)) throw new Error(`duplicate page id: ${page.id}`);
    pageIds.add(page.id);
    for (const element of page.elements ?? []) {
      if (keys.has(element.key)) throw new Error(`duplicate proto key: ${element.key}`);
      keys.add(element.key);
    }
  }
  if (!pageIds.has(model.startPage)) throw new Error(`unknown start page: ${model.startPage}`);
  for (const page of model.pages) {
    for (const element of page.elements ?? []) {
      if (element.action?.type === 'navigate' && !pageIds.has(element.action.target)) {
        throw new Error(`unknown navigation target: ${element.action.target}`);
      }
    }
  }
  return model;
}
