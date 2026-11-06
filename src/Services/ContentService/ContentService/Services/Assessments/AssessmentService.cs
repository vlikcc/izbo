using ContentService.Data;
using ContentService.Services.Questions;
using Microsoft.EntityFrameworkCore;
using Shared.Audit;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Services.Assessments;

public interface IAssessmentService
{
    /// <summary>Published mock exams and placement tests for the given levels, with the caller's own sitting.</summary>
    Task<List<AssessmentSummaryDto>> ListForLearnerAsync(IReadOnlyCollection<string> levelSlugs, Caller caller, CancellationToken cancellationToken = default);

    Task<PagedResponse<AssessmentSummaryDto>> ListAllAsync(PagedRequest paging, CancellationToken cancellationToken = default);
    Task<ContentResult<AssessmentDetailDto>> GetDetailAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ContentResult<AssessmentDetailDto>> CreateAsync(SaveAssessmentRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<AssessmentDetailDto>> UpdateAsync(Guid id, SaveAssessmentRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<AssessmentDetailDto>> SaveSectionsAsync(Guid id, SaveSectionsRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<AssessmentDetailDto>> PublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<AssessmentDetailDto>> UnpublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<bool>> DeleteAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>Random published questions from the topics, skipping ones held for other tests.</summary>
    Task<List<Guid>> SuggestQuestionsAsync(SuggestQuestionsRequest request, CancellationToken cancellationToken = default);
}

public class AssessmentService : IAssessmentService
{
    public const int MinDurationMinutes = 5;
    public const int MaxDurationMinutes = 300;
    public const int MaxSections = 10;
    public const int MaxQuestions = 200;

    private readonly ContentDbContext _db;
    private readonly TimeProvider _clock;
    private readonly IAuditLogger _audit;

    public AssessmentService(ContentDbContext db, TimeProvider clock, IAuditLogger audit)
    {
        _db = db;
        _clock = clock;
        _audit = audit;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;

    public async Task<List<AssessmentSummaryDto>> ListForLearnerAsync(IReadOnlyCollection<string> levelSlugs, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(levelSlugs);
        ArgumentNullException.ThrowIfNull(caller);

        var now = Now;
        var slugs = levelSlugs.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).ToList();
        var oldest = now.AddDays(-60);

        var query = _db.Assessments.AsNoTracking()
            .Include(a => a.Level)
            .Where(a => a.Status == AssessmentStatus.Published
                && (a.Kind == AssessmentKind.Placement || a.WindowEnd == null || a.WindowEnd > oldest));
        if (slugs.Count > 0)
        {
            query = query.Where(a => slugs.Contains(a.Level!.Slug));
        }

        var assessments = await query.ToListAsync(cancellationToken);
        var ids = assessments.Select(a => a.Id).ToList();
        var counts = await QuestionCountsAsync(ids, cancellationToken);
        var mine = await _db.Attempts.AsNoTracking()
            .Where(a => a.UserId == caller.UserId && a.AssessmentId != null && ids.Contains(a.AssessmentId.Value))
            .ToDictionaryAsync(a => a.AssessmentId!.Value, a => (a.Id, a.Status), cancellationToken);

        return assessments
            .Select(a => ToSummary(a, counts.GetValueOrDefault(a.Id), now, mine.TryGetValue(a.Id, out var m) ? m : null))
            .OrderBy(s => s.State switch
            {
                AssessmentWindowState.Open => 0,
                AssessmentWindowState.Upcoming => 1,
                _ => 2
            })
            .ThenBy(s => s.State == AssessmentWindowState.Closed ? DateTime.MaxValue - (s.WindowEnd ?? DateTime.MinValue) : TimeSpan.Zero)
            .ThenBy(s => s.WindowStart ?? DateTime.MinValue)
            .ThenBy(s => s.Title, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<PagedResponse<AssessmentSummaryDto>> ListAllAsync(PagedRequest paging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(paging);

        var now = Now;
        var total = await _db.Assessments.CountAsync(cancellationToken);
        var page = paging.NormalizedPage;
        var size = paging.NormalizedPageSize;
        var assessments = await _db.Assessments.AsNoTracking()
            .Include(a => a.Level)
            .OrderByDescending(a => a.UpdatedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);
        var counts = await QuestionCountsAsync(assessments.Select(a => a.Id).ToList(), cancellationToken);

        return new PagedResponse<AssessmentSummaryDto>(
            assessments.Select(a => ToSummary(a, counts.GetValueOrDefault(a.Id), now, null)).ToList(),
            page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    public async Task<ContentResult<AssessmentDetailDto>> GetDetailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var detail = await LoadDetailAsync(id, cancellationToken);
        return detail is null ? ContentResult.NotFound<AssessmentDetailDto>("Test not found") : ContentResult.Ok(detail);
    }

    public async Task<ContentResult<AssessmentDetailDto>> CreateAsync(SaveAssessmentRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        var (level, error) = await ValidateSettingsAsync(request, cancellationToken);
        if (level is null)
        {
            return ContentResult.Invalid<AssessmentDetailDto>(error!);
        }

        var now = Now;
        var assessment = new Assessment
        {
            Id = Guid.NewGuid(),
            OwnerId = caller.UserId,
            Status = AssessmentStatus.Draft,
            CreatedAt = now,
        };
        Apply(assessment, request, level, now);

        _db.Assessments.Add(assessment);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok((await LoadDetailAsync(assessment.Id, cancellationToken))!);
    }

    public async Task<ContentResult<AssessmentDetailDto>> UpdateAsync(Guid id, SaveAssessmentRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var assessment = await _db.Assessments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (assessment is null)
        {
            return ContentResult.NotFound<AssessmentDetailDto>("Test not found");
        }

        if (assessment.Status != AssessmentStatus.Draft)
        {
            return ContentResult.Conflict<AssessmentDetailDto>("Unpublish the test before changing it");
        }

        var (level, error) = await ValidateSettingsAsync(request, cancellationToken);
        if (level is null)
        {
            return ContentResult.Invalid<AssessmentDetailDto>(error!);
        }

        Apply(assessment, request, level, Now);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok((await LoadDetailAsync(id, cancellationToken))!);
    }

    public async Task<ContentResult<AssessmentDetailDto>> SaveSectionsAsync(Guid id, SaveSectionsRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var assessment = await _db.Assessments
            .Include(a => a.Sections)
            .Include(a => a.Questions)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (assessment is null)
        {
            return ContentResult.NotFound<AssessmentDetailDto>("Test not found");
        }

        if (assessment.Status != AssessmentStatus.Draft)
        {
            return ContentResult.Conflict<AssessmentDetailDto>("Unpublish the test before changing its questions");
        }

        var sections = request.Sections ?? [];
        if (sections.Count is 0 or > MaxSections)
        {
            return ContentResult.Invalid<AssessmentDetailDto>($"A test has 1 to {MaxSections} sections");
        }

        var allIds = sections.SelectMany(s => s.QuestionIds ?? []).ToList();
        if (allIds.Count > MaxQuestions)
        {
            return ContentResult.Invalid<AssessmentDetailDto>($"A test has at most {MaxQuestions} questions");
        }

        if (allIds.Count != allIds.Distinct().Count())
        {
            return ContentResult.Invalid<AssessmentDetailDto>("A question appears twice");
        }

        if (sections.Any(s => string.IsNullOrWhiteSpace(s.Title) || s.Title.Trim().Length > 200))
        {
            return ContentResult.Invalid<AssessmentDetailDto>("Every section needs a title of at most 200 characters");
        }

        var published = await _db.BankQuestions
            .CountAsync(q => allIds.Contains(q.Id) && q.Status == ContentStatus.Published, cancellationToken);
        if (published != allIds.Count)
        {
            return ContentResult.Invalid<AssessmentDetailDto>("Only published questions can be used in a test");
        }

        var subjectIds = sections.Where(s => s.SubjectId != null).Select(s => s.SubjectId!.Value).Distinct().ToList();
        if (subjectIds.Count > 0 &&
            await _db.Subjects.CountAsync(s => subjectIds.Contains(s.Id), cancellationToken) != subjectIds.Count)
        {
            return ContentResult.Invalid<AssessmentDetailDto>("Subject not found");
        }

        _db.AssessmentQuestions.RemoveRange(assessment.Questions);
        _db.AssessmentSections.RemoveRange(assessment.Sections);

        var sectionOrder = 1;
        foreach (var input in sections)
        {
            var section = new AssessmentSection
            {
                Id = Guid.NewGuid(),
                AssessmentId = id,
                SubjectId = input.SubjectId,
                Title = input.Title.Trim(),
                Order = sectionOrder++,
            };
            _db.AssessmentSections.Add(section);

            var questionOrder = 1;
            foreach (var questionId in input.QuestionIds ?? [])
            {
                _db.AssessmentQuestions.Add(new AssessmentQuestion
                {
                    AssessmentId = id,
                    QuestionId = questionId,
                    SectionId = section.Id,
                    Order = questionOrder++,
                });
            }
        }

        assessment.UpdatedAt = Now;
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok((await LoadDetailAsync(id, cancellationToken))!);
    }

    public async Task<ContentResult<AssessmentDetailDto>> PublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var assessment = await _db.Assessments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (assessment is null)
        {
            return ContentResult.NotFound<AssessmentDetailDto>("Test not found");
        }

        if (assessment.Status == AssessmentStatus.Published)
        {
            return ContentResult.Ok((await LoadDetailAsync(id, cancellationToken))!);
        }

        if (!await _db.AssessmentQuestions.AnyAsync(q => q.AssessmentId == id, cancellationToken))
        {
            return ContentResult.Invalid<AssessmentDetailDto>("Add questions before publishing");
        }

        if (assessment.Kind == AssessmentKind.MockExam && assessment.WindowEnd <= Now)
        {
            return ContentResult.Invalid<AssessmentDetailDto>("The window has already ended; move it before publishing");
        }

        var now = Now;
        assessment.Status = AssessmentStatus.Published;
        assessment.PublishedAt = now;
        assessment.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("AssessmentPublished", caller.UserId, "Assessment", id.ToString()), cancellationToken);
        return ContentResult.Ok((await LoadDetailAsync(id, cancellationToken))!);
    }

    public async Task<ContentResult<AssessmentDetailDto>> UnpublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var assessment = await _db.Assessments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (assessment is null)
        {
            return ContentResult.NotFound<AssessmentDetailDto>("Test not found");
        }

        if (await _db.Attempts.AnyAsync(a => a.AssessmentId == id, cancellationToken))
        {
            return ContentResult.Conflict<AssessmentDetailDto>("Students have already taken this test");
        }

        assessment.Status = AssessmentStatus.Draft;
        assessment.UpdatedAt = Now;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("AssessmentUnpublished", caller.UserId, "Assessment", id.ToString()), cancellationToken);
        return ContentResult.Ok((await LoadDetailAsync(id, cancellationToken))!);
    }

    public async Task<ContentResult<bool>> DeleteAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var assessment = await _db.Assessments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (assessment is null)
        {
            return ContentResult.NotFound<bool>("Test not found");
        }

        if (assessment.Status != AssessmentStatus.Draft || await _db.Attempts.AnyAsync(a => a.AssessmentId == id, cancellationToken))
        {
            return ContentResult.Conflict<bool>("Only an unpublished test nobody has taken can be deleted");
        }

        _db.Assessments.Remove(assessment);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("AssessmentDeleted", caller.UserId, "Assessment", id.ToString()), cancellationToken);
        return ContentResult.Ok(true);
    }

    public async Task<List<Guid>> SuggestQuestionsAsync(SuggestQuestionsRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var topicIds = request.TopicIds ?? [];
        var exclude = request.Exclude ?? [];
        var reserved = AssessmentQueries.ReservedQuestionIds(_db, Now);

        var query = _db.BankQuestions.AsNoTracking()
            .Where(q => topicIds.Contains(q.TopicId)
                && q.Status == ContentStatus.Published
                && !exclude.Contains(q.Id)
                && !reserved.Contains(q.Id));
        if (request.Difficulty is { } difficulty)
        {
            query = query.Where(q => q.Difficulty == difficulty);
        }

        return await query
            .OrderBy(_ => EF.Functions.Random())
            .Take(Math.Clamp(request.Count, 1, 50))
            .Select(q => q.Id)
            .ToListAsync(cancellationToken);
    }

    // ---- Helpers ----

    private async Task<(Level? Level, string? Error)> ValidateSettingsAsync(SaveAssessmentRequest request, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.Kind))
        {
            return (null, "Unknown test kind");
        }

        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 255)
        {
            return (null, "A title of at most 255 characters is required");
        }

        if ((request.Description?.Length ?? 0) > 4000)
        {
            return (null, "The description is longer than 4000 characters");
        }

        if (request.DurationMinutes is < MinDurationMinutes or > MaxDurationMinutes)
        {
            return (null, $"The duration must be {MinDurationMinutes}–{MaxDurationMinutes} minutes");
        }

        if (request.ScoringRule is { } rule && !Enum.IsDefined(rule))
        {
            return (null, "Unknown scoring rule");
        }

        if (request.Kind == AssessmentKind.MockExam)
        {
            if (request.WindowStart is null || request.WindowEnd is null)
            {
                return (null, "A mock exam needs a start and an end");
            }

            if (request.WindowEnd <= request.WindowStart)
            {
                return (null, "The window must end after it starts");
            }
        }

        var level = await _db.Levels.AsNoTracking().FirstOrDefaultAsync(l => l.Id == request.LevelId, cancellationToken);
        return level is null ? (null, "Level not found") : (level, null);
    }

    private static void Apply(Assessment assessment, SaveAssessmentRequest request, Level level, DateTime now)
    {
        assessment.Kind = request.Kind;
        assessment.Title = request.Title.Trim();
        assessment.Description = request.Description?.Trim() ?? string.Empty;
        assessment.LevelId = level.Id;
        assessment.DurationMinutes = request.DurationMinutes;
        assessment.ScoringRule = request.ScoringRule ?? ScoringCalculator.DefaultFor(level);
        assessment.AccessTier = request.AccessTier;

        // Placement tests have no window: they are taken whenever a student starts.
        assessment.WindowStart = request.Kind == AssessmentKind.MockExam ? ToUtc(request.WindowStart) : null;
        assessment.WindowEnd = request.Kind == AssessmentKind.MockExam ? ToUtc(request.WindowEnd) : null;
        assessment.UpdatedAt = now;
    }

    private static DateTime? ToUtc(DateTime? value) => value switch
    {
        null => null,
        { Kind: DateTimeKind.Utc } utc => utc,
        { Kind: DateTimeKind.Local } local => local.ToUniversalTime(),
        { } unspecified => DateTime.SpecifyKind(unspecified, DateTimeKind.Utc)
    };

    private async Task<Dictionary<Guid, int>> QuestionCountsAsync(List<Guid> ids, CancellationToken cancellationToken) =>
        await _db.AssessmentQuestions.AsNoTracking()
            .Where(q => ids.Contains(q.AssessmentId))
            .GroupBy(q => q.AssessmentId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

    private async Task<AssessmentDetailDto?> LoadDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        var assessment = await _db.Assessments.AsNoTracking()
            .Include(a => a.Level)
            .Include(a => a.Sections)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (assessment is null)
        {
            return null;
        }

        var entries = await _db.AssessmentQuestions.AsNoTracking()
            .Where(q => q.AssessmentId == id)
            .Include(q => q.Question!).ThenInclude(q => q.Topic!).ThenInclude(t => t.Unit!).ThenInclude(u => u.Subject!).ThenInclude(s => s.Level)
            .Include(q => q.Question!).ThenInclude(q => q.LearningOutcome)
            .Include(q => q.Question!).ThenInclude(q => q.SolutionVideo)
            .OrderBy(q => q.Order)
            .ToListAsync(cancellationToken);
        var attemptCount = await _db.Attempts.CountAsync(a => a.AssessmentId == id, cancellationToken);

        var sections = assessment.Sections
            .OrderBy(s => s.Order)
            .Select(s => new AssessmentSectionDto(
                s.Id,
                s.SubjectId,
                s.Title,
                s.Order,
                entries.Where(e => e.SectionId == s.Id).Select(e => QuestionBankService.ToDto(e.Question!)).ToList()))
            .ToList();

        return new AssessmentDetailDto(
            ToSummary(assessment, entries.Count, Now, null),
            assessment.RankedAt,
            attemptCount,
            sections);
    }

    private static AssessmentSummaryDto ToSummary(Assessment a, int questionCount, DateTime now, (Guid Id, AttemptStatus Status)? mine) => new(
        a.Id,
        a.Kind,
        a.Title,
        a.Description,
        a.LevelId,
        a.Level?.Slug ?? string.Empty,
        a.Level?.Name ?? string.Empty,
        a.DurationMinutes,
        a.ScoringRule,
        questionCount,
        a.WindowStart,
        a.WindowEnd,
        AssessmentQueries.WindowState(a, now),
        a.AccessTier,
        a.Status,
        mine?.Id,
        mine?.Status);
}
