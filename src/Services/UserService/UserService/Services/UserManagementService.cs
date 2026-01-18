using Microsoft.EntityFrameworkCore;
using Shared.DTOs;
using Shared.Models;
using UserService.Data;

namespace UserService.Services;

public interface IUserManagementService
{
    Task<UserDto?> GetUserAsync(Guid id);
    Task<UserDto?> GetUserByEmailAsync(string email);
    Task<PagedResponse<UserDto>> GetUsersAsync(UserRole? role, PagedRequest request);
    Task<UserDto?> UpdateUserAsync(Guid id, UpdateUserRequest request);
    Task<bool> UpdateUserRoleAsync(Guid id, UpdateRoleRequest request);
    Task<bool> DeactivateUserAsync(Guid id);
    Task<bool> ActivateUserAsync(Guid id);
    Task<List<UserDto>> SearchUsersAsync(string query, int limit = 20);
    Task<Dictionary<UserRole, int>> GetUserStatsAsync();
}

public class UserManagementService : IUserManagementService
{
    private readonly UserDbContext _context;
    private readonly ILogger<UserManagementService> _logger;

    public UserManagementService(UserDbContext context, ILogger<UserManagementService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<UserDto?> GetUserAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        return user != null ? MapToDto(user) : null;
    }

    public async Task<UserDto?> GetUserByEmailAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        return user != null ? MapToDto(user) : null;
    }

    public async Task<PagedResponse<UserDto>> GetUsersAsync(UserRole? role, PagedRequest request)
    {
        var query = _context.Users.Where(u => u.IsActive);

        if (role.HasValue)
            query = query.Where(u => u.Role == role.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(u => MapToDto(u))
            .ToListAsync();

        return new PagedResponse<UserDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<UserDto?> UpdateUserAsync(Guid id, UpdateUserRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return null;

        if (!string.IsNullOrEmpty(request.FirstName)) user.FirstName = request.FirstName;
        if (!string.IsNullOrEmpty(request.LastName)) user.LastName = request.LastName;
        if (!string.IsNullOrEmpty(request.PhoneNumber)) user.PhoneNumber = request.PhoneNumber;
        if (!string.IsNullOrEmpty(request.ProfileImageUrl)) user.ProfileImageUrl = request.ProfileImageUrl;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} updated", id);
        return MapToDto(user);
    }

    public async Task<bool> UpdateUserRoleAsync(Guid id, UpdateRoleRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return false;

        if (Enum.TryParse<UserRole>(request.Role, out var newRole))
        {
            user.Role = newRole;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} role changed to {Role}", id, newRole);
            return true;
        }

        return false;
    }

    public async Task<bool> DeactivateUserAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return false;

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} deactivated", id);
        return true;
    }

    public async Task<bool> ActivateUserAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return false;

        user.IsActive = true;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} activated", id);
        return true;
    }

    public async Task<List<UserDto>> SearchUsersAsync(string query, int limit = 20)
    {
        var users = await _context.Users
            .Where(u => u.IsActive &&
                (u.FirstName.Contains(query) ||
                 u.LastName.Contains(query) ||
                 u.Email.Contains(query)))
            .OrderBy(u => u.LastName)
            .Take(limit)
            .ToListAsync();

        return users.Select(MapToDto).ToList();
    }

    public async Task<Dictionary<UserRole, int>> GetUserStatsAsync()
    {
        var stats = await _context.Users
            .Where(u => u.IsActive)
            .GroupBy(u => u.Role)
            .Select(g => new { Role = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Role, x => x.Count);

        return stats;
    }

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
