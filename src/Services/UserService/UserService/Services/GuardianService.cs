using Microsoft.EntityFrameworkCore;
using Shared.Audit;
using Shared.DTOs;
using Shared.Internal;
using Shared.Models;
using Shared.Text;
using System.Security.Cryptography;
using System.Text;
using UserService.Data;

namespace UserService.Services;

public enum CreateChildOutcome
{
    Created,
    UsernameTaken,
    TooManyChildren,

    /// <summary>AuthService could not be reached; nothing was created.</summary>
    AuthServiceUnavailable
}

public sealed record CreateChildResult(CreateChildOutcome Outcome, ChildDto? Child = null);

public enum LinkChildOutcome
{
    Linked,
    InvalidCode,
    AlreadyLinked,
    TooManyChildren
}

public sealed record LinkChildResult(LinkChildOutcome Outcome, ChildDto? Child = null);

public enum ResetChildPasswordOutcome
{
    Updated,

    /// <summary>Not a child of this parent, or a self-registered account the parent may not take over.</summary>
    NotAllowed,
    AuthServiceUnavailable
}

public interface IGuardianService
{
    Task<List<ChildDto>> GetChildrenAsync(Guid parentId, CancellationToken cancellationToken = default);
    Task<List<PublicUserDto>> GetGuardiansAsync(Guid studentId, CancellationToken cancellationToken = default);
    Task<CreateChildResult> CreateChildAsync(Guid parentId, CreateChildRequest request, CancellationToken cancellationToken = default);
    Task<LinkChildResult> LinkChildAsync(Guid parentId, string code, CancellationToken cancellationToken = default);
    Task<bool> UnlinkChildAsync(Guid parentId, Guid studentId, CancellationToken cancellationToken = default);
    Task<ResetChildPasswordOutcome> ResetChildPasswordAsync(Guid parentId, Guid studentId, string password, CancellationToken cancellationToken = default);
    Task<GuardianCodeDto?> IssueLinkCodeAsync(Guid studentId, CancellationToken cancellationToken = default);
    Task<bool> IsGuardianAsync(Guid parentId, Guid studentId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Parent ↔ student links. A link is created either when a parent opens a child account (the child signs in
/// by user name) or when a student hands an existing account's parent a one-time code.
/// </summary>
public class GuardianService : IGuardianService
{
    /// <summary>No 0/O or 1/I/L: the code is read aloud and typed by hand.</summary>
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 8;
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromDays(7);

    /// <summary>Generous for a family, small enough that one account cannot farm student profiles.</summary>
    public const int MaxChildrenPerParent = 10;

    private readonly UserDbContext _context;
    private readonly IUserManagementService _users;
    private readonly IAccountStateClient _accountState;
    private readonly IAuditLogger _audit;
    private readonly ILogger<GuardianService> _logger;

    public GuardianService(
        UserDbContext context,
        IUserManagementService users,
        IAccountStateClient accountState,
        IAuditLogger audit,
        ILogger<GuardianService> logger)
    {
        _context = context;
        _users = users;
        _accountState = accountState;
        _audit = audit;
        _logger = logger;
    }

    public async Task<List<ChildDto>> GetChildrenAsync(Guid parentId, CancellationToken cancellationToken = default)
    {
        var rows = await (
                from link in _context.GuardianLinks.AsNoTracking()
                join user in _context.Users.AsNoTracking() on link.StudentId equals user.Id
                where link.ParentId == parentId && user.DeletedAt == null
                orderby user.FirstName, user.LastName
                select new { user, link.CreatedAt })
            .ToListAsync(cancellationToken);

        return rows.Select(r => ToChildDto(r.user, r.CreatedAt)).ToList();
    }

    public async Task<List<PublicUserDto>> GetGuardiansAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        return await (
                from link in _context.GuardianLinks.AsNoTracking()
                join user in _context.Users.AsNoTracking() on link.ParentId equals user.Id
                where link.StudentId == studentId && user.DeletedAt == null
                orderby user.FirstName
                select new PublicUserDto(user.Id, user.FirstName, user.LastName, user.Role.ToString(), user.ProfileImageUrl))
            .ToListAsync(cancellationToken);
    }

    public async Task<CreateChildResult> CreateChildAsync(
        Guid parentId,
        CreateChildRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (await CountChildrenAsync(parentId, cancellationToken) >= MaxChildrenPerParent)
        {
            return new CreateChildResult(CreateChildOutcome.TooManyChildren);
        }

        var username = UsernameRules.Normalize(request.Username);

        // Answered locally first so a taken name does not cost a round trip; AuthService stays the authority.
        if (await _context.Users.AnyAsync(u => u.Username == username, cancellationToken))
        {
            return new CreateChildResult(CreateChildOutcome.UsernameTaken);
        }

        var created = await _accountState.CreateChildAccountAsync(
            new CreateChildAccountRequest(
                request.FirstName.Trim(),
                request.LastName.Trim(),
                username,
                request.Password,
                request.GradeLevel,
                request.ExamTarget),
            cancellationToken);

        switch (created.Status)
        {
            case CreateChildAccountStatus.UsernameTaken:
                return new CreateChildResult(CreateChildOutcome.UsernameTaken);
            case CreateChildAccountStatus.Failed:
            case CreateChildAccountStatus.Created when created.AccountId is null:
                return new CreateChildResult(CreateChildOutcome.AuthServiceUnavailable);
        }

        var studentId = created.AccountId!.Value;

        // AuthService mirrors the profile itself, but best-effort; make sure the row exists before linking.
        await _users.UpsertProfileAsync(
            new AccountProfileSync(
                studentId,
                Email: null,
                request.FirstName.Trim(),
                request.LastName.Trim(),
                nameof(UserRole.Student),
                PhoneNumber: null,
                IsActive: true,
                username,
                request.GradeLevel,
                request.ExamTarget),
            cancellationToken);

        var link = new GuardianLink { Id = Guid.NewGuid(), ParentId = parentId, StudentId = studentId };
        _context.GuardianLinks.Add(link);
        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(
            new AuditRecord("ChildAccountCreated", parentId, "User", studentId.ToString()), cancellationToken);

        var student = await _context.Users.AsNoTracking().FirstAsync(u => u.Id == studentId, cancellationToken);
        _logger.LogInformation("Parent {ParentId} opened child account {StudentId}", parentId, studentId);
        return new CreateChildResult(CreateChildOutcome.Created, ToChildDto(student, link.CreatedAt));
    }

    public async Task<LinkChildResult> LinkChildAsync(Guid parentId, string code, CancellationToken cancellationToken = default)
    {
        var hash = HashCode(code);
        var now = DateTime.UtcNow;

        var row = await _context.GuardianLinkCodes
            .FirstOrDefaultAsync(c => c.CodeHash == hash && c.UsedAt == null && c.ExpiresAt > now, cancellationToken);

        if (row is null)
        {
            _logger.LogWarning("Parent {ParentId} presented an unknown or expired guardian code", parentId);
            return new LinkChildResult(LinkChildOutcome.InvalidCode);
        }

        var student = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == row.StudentId && u.DeletedAt == null && u.Role == UserRole.Student, cancellationToken);

        if (student is null)
        {
            return new LinkChildResult(LinkChildOutcome.InvalidCode);
        }

        var existing = await _context.GuardianLinks
            .FirstOrDefaultAsync(l => l.ParentId == parentId && l.StudentId == student.Id, cancellationToken);

        if (existing is not null)
        {
            return new LinkChildResult(LinkChildOutcome.AlreadyLinked, ToChildDto(student, existing.CreatedAt));
        }

        if (await CountChildrenAsync(parentId, cancellationToken) >= MaxChildrenPerParent)
        {
            return new LinkChildResult(LinkChildOutcome.TooManyChildren);
        }

        // One code, one parent: a code that leaked after use links nobody else.
        row.UsedAt = now;
        var link = new GuardianLink { Id = Guid.NewGuid(), ParentId = parentId, StudentId = student.Id, CreatedAt = now };
        _context.GuardianLinks.Add(link);
        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(
            new AuditRecord("GuardianLinked", parentId, "User", student.Id.ToString()), cancellationToken);

        return new LinkChildResult(LinkChildOutcome.Linked, ToChildDto(student, link.CreatedAt));
    }

    public async Task<bool> UnlinkChildAsync(Guid parentId, Guid studentId, CancellationToken cancellationToken = default)
    {
        var link = await _context.GuardianLinks
            .FirstOrDefaultAsync(l => l.ParentId == parentId && l.StudentId == studentId, cancellationToken);

        if (link is null)
        {
            return false;
        }

        _context.GuardianLinks.Remove(link);
        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(
            new AuditRecord("GuardianUnlinked", parentId, "User", studentId.ToString()), cancellationToken);
        return true;
    }

    public async Task<ResetChildPasswordOutcome> ResetChildPasswordAsync(
        Guid parentId,
        Guid studentId,
        string password,
        CancellationToken cancellationToken = default)
    {
        var child = await (
                from link in _context.GuardianLinks
                join user in _context.Users on link.StudentId equals user.Id
                where link.ParentId == parentId && link.StudentId == studentId && user.DeletedAt == null
                select user)
            .FirstOrDefaultAsync(cancellationToken);

        // A student who registered with their own address owns their credentials; a link only lets the
        // parent follow progress. Only user-name accounts — the ones a parent opened — can be reset here.
        if (child is null || child.Email is not null)
        {
            return ResetChildPasswordOutcome.NotAllowed;
        }

        if (!await _accountState.SetPasswordAsync(studentId, password, cancellationToken))
        {
            return ResetChildPasswordOutcome.AuthServiceUnavailable;
        }

        await _audit.WriteAsync(
            new AuditRecord("ChildPasswordReset", parentId, "User", studentId.ToString()), cancellationToken);
        return ResetChildPasswordOutcome.Updated;
    }

    public async Task<GuardianCodeDto?> IssueLinkCodeAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var student = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == studentId && u.DeletedAt == null && u.Role == UserRole.Student, cancellationToken);

        if (student is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;

        // Only the newest code works; issuing one retires any the student handed out before.
        var outstanding = await _context.GuardianLinkCodes
            .Where(c => c.StudentId == studentId && c.UsedAt == null && c.ExpiresAt > now)
            .ToListAsync(cancellationToken);
        foreach (var old in outstanding)
        {
            old.ExpiresAt = now;
        }

        var code = new string(RandomNumberGenerator.GetItems<char>(CodeAlphabet, CodeLength));
        var row = new GuardianLinkCode
        {
            Id = Guid.NewGuid(),
            StudentId = studentId,
            CodeHash = HashCode(code),
            ExpiresAt = now.Add(CodeLifetime),
            CreatedAt = now
        };

        _context.GuardianLinkCodes.Add(row);
        await _context.SaveChangesAsync(cancellationToken);
        return new GuardianCodeDto(code, row.ExpiresAt);
    }

    public Task<bool> IsGuardianAsync(Guid parentId, Guid studentId, CancellationToken cancellationToken = default) =>
        _context.GuardianLinks.AsNoTracking()
            .AnyAsync(l => l.ParentId == parentId && l.StudentId == studentId, cancellationToken);

    /// <summary>Case, spaces and dashes are forgiven, since people copy codes in groups like "ABCD-EFGH".</summary>
    internal static string HashCode(string? code)
    {
        var canonical = new string((code ?? string.Empty)
            .Where(char.IsLetterOrDigit)
            .Select(char.ToUpperInvariant)
            .ToArray());

        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    private Task<int> CountChildrenAsync(Guid parentId, CancellationToken cancellationToken) =>
        _context.GuardianLinks.CountAsync(l => l.ParentId == parentId, cancellationToken);

    private static ChildDto ToChildDto(User user, DateTime linkedAt) => new(
        user.Id,
        user.FirstName,
        user.LastName,
        user.Username,
        user.Email,
        user.GradeLevel,
        user.ExamTarget?.ToString(),
        user.ProfileImageUrl,
        linkedAt);
}
