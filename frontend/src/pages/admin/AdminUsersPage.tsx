import React, { useEffect, useState } from 'react';
import { Button, Card, Select } from '../../components/ui';
import { Pagination } from '../../components/ui/Pagination';
import { userService } from '../../services/user.service';
import { toast } from '../../lib/toast';
import type { User } from '../../types';
import './AdminUsersPage.css';

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

            <div className="admin-stats">
                {Object.entries(stats).map(([role, count]) => (
                    <Card key={role} variant="default" padding="md">
                        <span className="admin-stat-label">{role}</span>
                        <span className="admin-stat-value">{count}</span>
                    </Card>
                ))}
            </div>

            <div className="filter-bar">
                <Select
                    id="role-filter"
                    className="select-inline"
                    label="Rol filtresi"
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                >
                    <option value="">Tümü</option>
                    {ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </Select>
            </div>

            <div className="admin-user-list">
                {users.map((user) => (
                    <Card key={user.id} variant="default" padding="md">
                        <div className="admin-user-row">
                            <div className="admin-user-identity">
                                <div className="admin-user-name">{user.firstName} {user.lastName}</div>
                                <div className="admin-user-email">{user.email}</div>
                                <span className={`admin-user-status ${user.isActive ? 'is-active' : 'is-inactive'}`}>
                                    {user.isActive ? 'Aktif' : 'Pasif'}
                                </span>
                            </div>

                            <div className="admin-user-actions">
                                <Select
                                    id={`role-${user.id}`}
                                    label="Rol"
                                    value={user.role}
                                    onChange={(event) => void changeRole(user, event.target.value)}
                                >
                                    {ROLES.map((role) => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </Select>
                                <Button
                                    variant={user.isActive ? 'danger' : 'secondary'}
                                    size="md"
                                    onClick={() => void toggleActive(user)}
                                >
                                    {user.isActive ? 'Pasifleştir' : 'Etkinleştir'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={(next) => void load(next, roleFilter)} />
        </div>
    );
};

export default AdminUsersPage;
