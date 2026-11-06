import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MathText } from './MathText';
import { splitMath } from './splitMath';

describe('splitMath', () => {
    it('separates inline and display formulas from text', () => {
        expect(splitMath('Hesapla: $x^2$ ve $$\\frac{1}{2}$$ bitti')).toEqual([
            { kind: 'text', value: 'Hesapla: ' },
            { kind: 'inline', value: 'x^2' },
            { kind: 'text', value: ' ve ' },
            { kind: 'display', value: '\\frac{1}{2}' },
            { kind: 'text', value: ' bitti' },
        ]);
    });

    it('keeps escaped and unclosed dollar signs as text', () => {
        expect(splitMath('Fiyat \\$5, tek $ işaret')).toEqual([{ kind: 'text', value: 'Fiyat $5, tek $ işaret' }]);
    });

    it('does not end a formula at an escaped dollar', () => {
        expect(splitMath('$a\\$b$')).toEqual([{ kind: 'inline', value: 'a\\$b' }]);
    });
});

describe('MathText', () => {
    it('renders formulas with KaTeX and leaves text as text', () => {
        const { container } = render(<MathText text={'Kök: $\\sqrt{16}$'} />);
        expect(container.textContent).toContain('Kök:');
        expect(container.querySelector('.katex')).not.toBeNull();
    });

    it('never injects author HTML', () => {
        const { container } = render(<MathText text={'<img src=x onerror="alert(1)"> $<b>x</b>$'} />);
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('b')).toBeNull();
        expect(container.textContent).toContain('<img src=x');
    });

    it('shows broken LaTeX instead of throwing, and refuses links', () => {
        const { container } = render(<MathText text={'$\\frac{1}{$ ve $\\href{javascript:alert(1)}{tıkla}$'} />);
        expect(container.querySelector('a')).toBeNull();
        expect(container.textContent).toContain('ve');
    });
});
