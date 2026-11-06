import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { splitMath } from './splitMath';
import './Math.css';

/** Untrusted author input: no \href/\includegraphics, bounded sizes and macro expansion, never throws. */
const KATEX_OPTIONS = {
    throwOnError: false,
    trust: false,
    strict: 'ignore' as const,
    maxSize: 10,
    maxExpand: 500,
    output: 'htmlAndMathml' as const,
};

interface MathTextProps {
    text: string;
    className?: string;
}

/** Question text with formulas. Plain text keeps its line breaks; formulas render through KaTeX. */
export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
    const parts = useMemo(() => splitMath(text ?? '').map(segment =>
        segment.kind === 'text'
            ? segment
            : { ...segment, value: katex.renderToString(segment.value, { ...KATEX_OPTIONS, displayMode: segment.kind === 'display' }) }),
    [text]);

    return (
        <span className={['math-text', className].filter(Boolean).join(' ')}>
            {parts.map((part, index) =>
                part.kind === 'text'
                    ? <React.Fragment key={index}>{part.value}</React.Fragment>
                    // KaTeX output is generated markup, not author HTML: the author's text never reaches innerHTML raw.
                    : <span key={index} className={part.kind === 'display' ? 'math-display' : 'math-inline'} dangerouslySetInnerHTML={{ __html: part.value }} />)}
        </span>
    );
};

export default MathText;
