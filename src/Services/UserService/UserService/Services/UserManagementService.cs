using Microsoft.EntityFrameworkCore;
using Shared.Audit;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shared.Text;
using UserService.Data;

namespace UserService.Services;

public interface IUserManagementService
{
    Task<UserDto?> GetUserAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>The publicly visible subset of a profile, for rendering other users in the UI.</summary>
    Task<PublicUserDto?> GetPublicUserAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PagedResponse<UserDto>> GetUsersAsync(UserRole? role, PagedRequest request, CancellationToken cancellationToken = default);
    Task<UserDto?> UpdateUserAsync(Guid id, UpdateUserRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdateUserRoleAsync(Guid id, UpdateRoleRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> SetUserActiveAsync(Guid id, bool isActive, Caller caller, CancellationToken cancellationToken = default);
    Task<List<PublicUserDto>> SearchUsersAsync(string query, int limit = 20, CancellationToken cancellationToken = default);
    Task<Dictionary<UserRole, int>> GetUserStatsAsync(CancellationToken cancellationToken = default);
    Task<UserDto?> ExportUserAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> DeleteOwnAccountAsync(Guid id, CancellationToken cancellationToken = default);
}

public class UserManagementService : IUserManagementService
{
    private readonly UserDbContext _context;
    private readonly IAuditLogger _audit;
    private readonly ILogger<UserManagementService> _logger;

    public UserManagementService(UserDbContext context, IAuditLogger audit, ILogger<UserManagementService> logger)
    {
        _context = context;
        _audit = audit;
        _logger = logger;
    }

    public async Task<UserDto?> GetUserAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        return user != null ? MapToDto(user) : null;
    }

    public async Task<PublicUserDto?> GetPublicUserAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == id && u.IsActive)
            .Select(u => new PublicUserDto(u.Id, u.FirstName, u.LastName, u.Role.ToString(), u.ProfileImageUrl))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<PagedResponse<UserDto>> GetUsersAsync(UserRole? role, PagedRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _context.Users.AsNoTracking().Where(u => u.DeletedAt == null);

        if (role.HasValue)
            query = query.Where(u => u.Role == role.Value);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(u => new UserDto(
                u.Id, u.Email, u.FirstName, u.LastName, u.Role.ToString(),
                u.PhoneNumber, u.ProfileImageUrl, u.IsActive, u.CreatedAt))
            .ToListAsync(cancellationToken);

        return new PagedResponse<UserDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<UserDto?> UpdateUserAsync(Guid id, UpdateUserRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null) return null;

        if (!string.IsNullOrEmpty(request.FirstName)) user.FirstName = request.FirstName;
        if (!string.IsNullOrEmpty(request.LastName)) user.LastName = request.LastName;
        if (!string.IsNullOrEmpty(request.PhoneNumber)) user.PhoneNumber = request.PhoneNumber;
        if (!string.IsNullOrEmpty(request.ProfileImageUrl)) user.ProfileImageUrl = request.ProfileImageUrl;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("User {UserId} updated", id);
        return MapToDto(user);
    }

    public async Task<bool> UpdateUserRoleAsync(Guid id, UpdateRoleRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var newRole))
        {
            return false;
        }

        // Granting SuperAdmin is reserved for SuperAdmins, otherwise an Admin could promote themselves
        // past the only role that can demote them.
        if (newRole == UserRole.SuperAdmin && caller.Role != UserRole.SuperAdmin)
        {
            _logger.LogWarning("User {UserId} attempted to grant SuperAdmin without being one", caller.UserId);
            return false;
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null) return false;

        // Demoting an existing SuperAdmin, including oneself, is likewise SuperAdmin-only.
        if (user.Role == UserRole.SuperAdmin && caller.Role != UserRole.SuperAdmin)
        {
            _logger.LogWarning(
                "User {UserId} attempted to change the role of SuperAdmin {TargetUserId}", caller.UserId, id);
            return false;
        }

        user.Role = newRole;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(
            new AuditRecord("RoleChanged", caller.UserId, "User", id.ToString(), newRole.ToString()),
            cancellationToken);

        _logger.LogInformation(
            "User {TargetUserId} role changed to {Role} by {UserId}", id, newRole, caller.UserId);
        return true;
    }

    public async Task<bool> SetUserActiveAsync(Guid id, bool isActive, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        // Locking yourself out of the platform is never the intent.
        if (!isActive && caller.Is(id))
        {
            _logger.LogWarning("User {UserId} attempted to deactivate their own account", caller.UserId);
            return false;
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null) return false;

        if (!isActive && user.Role == UserRole.SuperAdmin && caller.Role != UserRole.SuperAdmin)
        {
            _logger.LogWarning(
                "User {UserId} attempted to deactivate SuperAdmin {TargetUserId}", caller.UserId, id);
            return false;
        }

        user.IsActive = isActive;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(
            new AuditRecord(isActive ? "UserActivated" : "UserDeactivated", caller.UserId, "User", id.ToString()),
            cancellationToken);

        _logger.LogInformation(
            "User {TargetUserId} {Action} by {UserId}", id, isActive ? "activated" : "deactivated", caller.UserId);
        return true;
    }

    /// <summary>
    /// Returns public profiles only. E-mail is searchable so instructors can find a known student by
    /// address, but it is never returned, which keeps the endpoint from being an address harvester.
    /// </summary>
    public async Task<List<PublicUserDto>> SearchUsersAsync(string query, int limit = 20, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < MinimumSearchLength)
        {
            return [];
        }

        var term = query.Trim();
        var email = EmailNormalizer.Normalize(term);

        return await _context.Users
            .AsNoTracking()
            .Where(u => u.IsActive && u.DeletedAt == null &&
                (EF.Functions.ILike(u.FirstName, $"%{term}%") ||
                 EF.Functions.ILike(u.LastName, $"%{term}%") ||
                 u.Email == email))
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .Take(Math.Clamp(limit, 1, 50))
            .Select(u => new PublicUserDto(u.Id, u.FirstName, u.LastName, u.Role.ToString(), u.ProfileImageUrl))
            .ToListAsync(cancellationToken);
    }

    public async Task<Dictionary<UserRole, int>> GetUserStatsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(u => u.DeletedAt == null)
            .GroupBy(u => u.Role)
            .Select(g => new { Role = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Role, x => x.Count, cancellationToken);
    }

    public async Task<UserDto?> ExportUserAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        return user is null ? null : MapToDto(user);
    }

    public async Task<bool> DeleteOwnAccountAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return false;
        }

        user.IsActive = false;
        user.DeletedAt = DateTime.UtcNow;
        user.Email = $"deleted-{user.Id:N}@invalid.local";
        user.FirstName = "Silinmiş";
        user.LastName = "Kullanıcı";
        user.PhoneNumber = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("AccountDeleted", id, "User", id.ToString()), cancellationToken);
        return true;
    }

    /// <summary>Short prefixes would match most of the directory, defeating the point of a search.</summary>
    private const int MinimumSearchLength = 2;

    private static UserDto MapToDto(User u) => new(
        u.Id,
        u.Email,
        u.FirstName,
        u.LastName,
        u.Role.ToString(),
        u.PhoneNumber,
        u.ProfileImageUrl,
        u.IsActive,
        u.CreatedAt
    );
}
