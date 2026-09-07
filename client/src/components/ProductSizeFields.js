import React from 'react';

const letters = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'];
const groups = [
  ['Youth', ['2', '4', '6', '8', '10', '12', '14', '16', '18', 'XS', 'S', 'M', 'L', 'XL'].map(size => `Youth ${size}`)],
  ["Men’s", letters.map(size => `Men's ${size}`)],
  ["Women’s (AU)", ['6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30'].map(size => `Women's ${size}`)],
  ['Adult / unisex', letters.map(size => `Adult / unisex ${size}`)],
  ['Other', ['One size']],
];
const presets = new Set(groups.flatMap(([, sizes]) => sizes));
const options = text => [...new Set(text.split('\n').map(value => value.trim()).filter(Boolean))];

export default function ProductSizeFields({ value, onChange }) {
  const selected = options(value);
  const custom = value.split('\n').filter(size => !presets.has(size.trim()));
  const toggle = (size, checked) => onChange((checked ? [...selected, size] : selected.filter(item => item !== size)).join('\n'));
  return <fieldset className="product-size-fields">
    <legend>Available sizes</legend>
    <p>Tick only the sizes available for this product. Check the supplier’s size chart before publishing.</p>
    {groups.map(([name, sizes]) => <fieldset key={name} className="product-size-group">
      <legend>{name}</legend>
      <div className="product-size-grid">{sizes.map(size => <label key={size}><input type="checkbox" checked={selected.includes(size)} onChange={event => toggle(size, event.target.checked)} />{size}</label>)}</div>
    </fieldset>)}
    <label>Other sizes / colours (one option per line)<textarea aria-label="Other sizes / colours" className="yjrl-input" rows={3} value={custom.join('\n')} placeholder="Women's XS / Blue&#10;Size 12 / Gold" onChange={event => onChange([...selected.filter(size => presets.has(size)), ...event.target.value.split('\n')].join('\n'))} /></label>
    <p>{selected.length} option{selected.length === 1 ? '' : 's'} selected. Customers will choose from these options.</p>
  </fieldset>;
}
