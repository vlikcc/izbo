import { useRef, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Modal } from './Modal';
import { useDialogFocus } from './useDialogFocus';

/**
 * Mirrors how every caller uses Modal: the form state lives in the parent, and onClose is an inline
 * arrow. That combination is what broke focus — each keystroke re-rendered the parent, handing Modal
 * a fresh onClose, which re-ran the effect that focuses the first control in the dialog.
 */
function EditHarness() {
    const [open, setOpen] = useState(true);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Profili Düzenle">
            <input
                aria-label="Ad"
                name="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
            />
            <input
                aria-label="Soyad"
                name="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
            />
        </Modal>
    );
}

/**
 * The dialog re-focuses inside requestAnimationFrame, so an assertion made straight after typing runs
 * while that callback is still pending and sees the focus the user left behind. Letting a frame pass
 * is what makes the regression observable — without this the test passes against the broken code.
 */
const flushFrame = () =>
    act(() => new Promise<void>((resolve) => { window.requestAnimationFrame(() => resolve()); }));

describe('Modal', () => {
    it('keeps focus on the field being typed into', async () => {
        const user = userEvent.setup();
        render(<EditHarness />);
        await flushFrame();

        const lastName = screen.getByLabelText('Soyad');
        await user.click(lastName);
        await user.type(lastName, 'Yılmaz');
        await flushFrame();

        expect(lastName).toHaveFocus();
        expect(lastName).toHaveValue('Yılmaz');
        expect(screen.getByRole('button', { name: 'Kapat' })).not.toHaveFocus();
    });

    it('opens with the first form control focused, not the close button', async () => {
        render(<EditHarness />);
        await flushFrame();

        // Focusing the dismiss control first means a keyboard user's first Enter throws the dialog away.
        expect(screen.getByLabelText('Ad')).toHaveFocus();
        expect(screen.getByRole('button', { name: 'Kapat' })).not.toHaveFocus();
    });

    it('does not submit the surrounding form when the close button is activated', () => {
        // Inside a <form>, a button without an explicit type submits it.
        render(<EditHarness />);
        expect(screen.getByRole('button', { name: 'Kapat' })).toHaveAttribute('type', 'button');
    });
});

/**
 * Dialogs that keep their own markup get the same behaviour through the hook rather than a second
 * copy of the effects. This covers that path directly, since the component test above cannot.
 */
function BespokeDialog() {
    const [open, setOpen] = useState(true);
    const [value, setValue] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(open, () => setOpen(false), ref);

    if (!open) return <p>kapandı</p>;
    return (
        <div ref={ref} role="dialog" aria-modal="true">
            <button type="button" className="thing-close">×</button>
            <input aria-label="Alan" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
    );
}

describe('useDialogFocus', () => {
    it('keeps focus on the field while typing in a dialog with its own markup', async () => {
        const user = userEvent.setup();
        render(<BespokeDialog />);
        await flushFrame();

        const field = screen.getByLabelText('Alan');
        await user.click(field);
        await user.type(field, 'abc');
        await flushFrame();

        expect(field).toHaveFocus();
        expect(field).toHaveValue('abc');
    });

    it('skips the close control when moving focus in', async () => {
        render(<BespokeDialog />);
        await flushFrame();

        expect(screen.getByLabelText('Alan')).toHaveFocus();
    });

    it('closes on Escape', async () => {
        const user = userEvent.setup();
        render(<BespokeDialog />);
        await flushFrame();

        await user.keyboard('{Escape}');
        expect(await screen.findByText('kapandı')).toBeInTheDocument();
    });
});
