import React, { useLayoutEffect, useMemo, useRef } from 'react';
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

/**
 * One formula. KaTeX builds the DOM itself into this element, so no HTML string from author text is
 * ever handed to React's innerHTML.
 */
const Formula: React.FC<{ tex: string; display: boolean }> = ({ tex, display }) => {
    const ref = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        if (ref.current) katex.render(tex, ref.current, { ...KATEX_OPTIONS, displayMode: display });
    }, [tex, display]);

    return <span ref={ref} className={display ? 'math-display' : 'math-inline'} />;
};

interface MathTextProps {
    text: string;
    className?: string;
}

/** Question text with formulas. Plain text keeps its line breaks; formulas render through KaTeX. */
export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
    const parts = useMemo(() => splitMath(text ?? ''), [text]);

    return (
        <span className={['math-text', className].filter(Boolean).join(' ')}>
            {parts.map((part, index) =>
                part.kind === 'text'
                    ? <React.Fragment key={index}>{part.value}</React.Fragment>
                    : <Formula key={`${index}-${part.kind}`} tex={part.value} display={part.kind === 'display'} />)}
        </span>
    );
};

export default MathText;
