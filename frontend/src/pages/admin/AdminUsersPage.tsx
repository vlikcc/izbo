import React, { useEffect, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { Pagination } from '../../components/ui/Pagination';
import { userService } from '../../services/user.service';
import { toast } from '../../lib/toast';
import type { User } from '../../types';

const ROLES: User['role'][] = ['Student', 'Instructor', 'Admin', 'SuperAdmin'];

export const AdminUsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [stats, setStats] = useState<Record<string, number>>({});
    const [roleFilter, setRoleFilter] = useState('');

    const load = async (nextPage: number, role?: string) => {
        try {
            const [list, nextStats] = await Promise.all([
                userService.getUsers(nextPage, 20, role || undefined),
                userService.getStats(),
            ]);
            setUsers(list.items);
            setTotalPages(list.totalPages || 1);
            setPage(list.page);
            setStats(nextStats);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Kullanıcılar yüklenemedi');
        }
    };

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                const [list, nextStats] = await Promise.all([
                    userService.getUsers(1, 20, roleFilter || undefined),
                    userService.getStats(),
                ]);
                if (cancelled) return;
                setUsers(list.items);
                setTotalPages(list.totalPages || 1);
                setPage(list.page);
                setStats(nextStats);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Kullanıcılar yüklenemedi');
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [roleFilter]);

    const toggleActive = async (user: User) => {
        try {
            await userService.setActive(user.id, !user.isActive);
            toast.success(user.isActive ? 'Kullanıcı pasifleştirildi' : 'Kullanıcı etkinleştirildi');
            await load(page, roleFilter);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Durum güncellenemedi');
        }
    };

    const changeRole = async (user: User, role: string) => {
        try {
            await userService.updateRole(user.id, role);
            toast.success('Rol güncellendi');
            await load(page, roleFilter);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Rol güncellenemedi');
        }
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">Kullanıcı yönetimi</h1>
                    <p className="page-subtitle">Rol atama, aktivasyon ve istatistikler</p>
                </div>
            </div>

            <div className="dashboard-stats">
                {Object.entries(stats).map(([role, count]) => (
                    <Card key={role} variant="default" padding="md">
                        <strong>{role}</strong>
                        <p>{count}</p>
                    </Card>
                ))}
            </div>

            <label htmlFor="role-filter">Rol filtresi</label>
            <select
                id="role-filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
            >
                <option value="">Tümü</option>
                {ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                ))}
            </select>

            <div className="homework-list" style={{ marginTop: 16 }}>
                {users.map((user) => (
                    <Card key={user.id} variant="default" padding="md">
                        <h3>{user.firstName} {user.lastName}</h3>
                        <p>{user.email}</p>
                        <p>Durum: {user.isActive ? 'Aktif' : 'Pasif'}</p>
                        <label htmlFor={`role-${user.id}`}>Rol</label>
                        <select
                            id={`role-${user.id}`}
                            value={user.role}
                            onChange={(event) => void changeRole(user, event.target.value)}
                        >
                            {ROLES.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                        <Button variant="outline" size="sm" onClick={() => void toggleActive(user)}>
                            {user.isActive ? 'Pasifleştir' : 'Etkinleştir'}
                        </Button>
                    </Card>
                ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={(next) => void load(next, roleFilter)} />
        </div>
    );
};

export default AdminUsersPage;
