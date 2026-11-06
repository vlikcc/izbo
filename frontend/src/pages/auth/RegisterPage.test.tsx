import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';
import { useAuthStore } from '../../stores/authStore';

const register = vi.fn().mockResolvedValue('Kayıt talebiniz alındı.');

/** Made at run time so no credential-looking string lives in the repository. */
const testPassword = `T${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}-9`;

function renderPage() {
    return render(
        <MemoryRouter>
            <RegisterPage />
        </MemoryRouter>,
    );
}

async function fillCommonFields(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Ad'), 'Ayşe');
    await user.type(screen.getByLabelText('Soyad'), 'Yılmaz');
    await user.type(screen.getByLabelText('E-posta'), 'ayse@example.com');
    await user.type(screen.getByLabelText('Şifre'), testPassword);
    await user.type(screen.getByLabelText('Şifre Tekrar'), testPassword);
}

describe('RegisterPage', () => {
    beforeEach(() => {
        register.mockClear();
        useAuthStore.setState({ register, isLoading: false, error: null });
    });

    it('registers a parent without asking for a grade', async () => {
        const user = userEvent.setup();
        renderPage();

        expect(screen.getByRole('radio', { name: /Veliyim/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.queryByLabelText('Sınıf')).not.toBeInTheDocument();

        await fillCommonFields(user);
        await user.click(screen.getByRole('button', { name: 'Kayıt Ol' }));

        expect(register).toHaveBeenCalledWith(expect.objectContaining({ role: 'Parent', email: 'ayse@example.com' }));
        expect(register.mock.calls[0][0]).not.toHaveProperty('gradeLevel');
    });

    it('asks a student for their grade and sends the exam target that fits it', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('radio', { name: /Öğrenciyim/ }));
        await fillCommonFields(user);
        await user.selectOptions(screen.getByLabelText('Sınıf'), '8');
        await user.selectOptions(screen.getByLabelText('Hedef sınav'), 'Lgs');
        await user.click(screen.getByRole('button', { name: 'Kayıt Ol' }));

        expect(register).toHaveBeenCalledWith(expect.objectContaining({ role: 'Student', gradeLevel: 8, examTarget: 'Lgs' }));
    });
});
