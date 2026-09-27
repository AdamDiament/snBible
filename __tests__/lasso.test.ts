import { formatSpans } from '../src/reference';
import { cleanRecognized, referenceFromTextBox } from '../src/lasso';

jest.mock('sn-plugin-lib', () => ({ PluginCommAPI: {} }));

const label = (text: string) => {
  const spans = referenceFromTextBox(text);
  return spans ? formatSpans(spans) : null;
};

describe('handwriting clean-up', () => {
  test.each([
    ['John 3:16', 'John 3:16'],
    ['Jn 3v16', 'Jn 3:16'],
    ['Rom\n8 : 28', 'Rom 8 : 28'],
    ['  1 Cor 13 V 4-7 ', '1 Cor 13:4-7'],
  ])('%j → %j', (raw, clean) => {
    expect(cleanRecognized(raw)).toBe(clean);
  });
});

describe('reference from a text box', () => {
  test('reference above the text (Super Bible default)', () => {
    expect(label('John 3:16–18 (BSB)\n16 For God so loved…')).toBe('John 3:16–18');
  });

  test('reference below the text', () => {
    expect(label('16 For God so loved the world…\n— John 3:16 (BSB)')).toBe('John 3:16');
  });

  test('spaced layout and no "(BSB)"', () => {
    expect(label('Psalm 23\n\n1 The LORD is my shepherd…\n\n2 He makes me lie down…')).toBe('Psalm 23');
  });

  test('a typed reference on its own', () => {
    expect(label('rom 8:28')).toBe('Romans 8:28');
  });

  test('text with no reference', () => {
    expect(label('Shopping: eggs, milk')).toBeNull();
    expect(label('16 For God so loved the world')).toBeNull();
    expect(label('')).toBeNull();
  });
});
