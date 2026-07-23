export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function renderOptionField(opt, values) {
  const id = `opt-${opt.key}-${Math.random().toString(36).slice(2, 8)}`;
  let input;
  if (opt.type === 'select') {
    input = el(
      'select',
      { id, class: 'field-input' },
      opt.choices.map((choice) => {
        const value = typeof choice === 'object' ? choice.value : choice;
        const label = typeof choice === 'object' ? choice.label : choice;
        return el('option', { value, selected: value === values[opt.key] ? '' : undefined }, label);
      })
    );
    input.addEventListener('change', () => {
      values[opt.key] = input.value;
    });
  } else if (opt.type === 'checkbox') {
    input = el('input', { id, type: 'checkbox', class: 'field-checkbox' });
    input.checked = !!values[opt.key];
    input.addEventListener('change', () => {
      values[opt.key] = input.checked;
    });
  } else {
    input = el('input', {
      id,
      type: opt.type === 'password' ? 'password' : opt.type === 'number' ? 'number' : 'text',
      class: 'field-input',
      value: values[opt.key] ?? ''
    });
    input.addEventListener('input', () => {
      values[opt.key] = opt.type === 'number' ? Number(input.value) : input.value;
    });
  }
  return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, opt.label), input]);
}
