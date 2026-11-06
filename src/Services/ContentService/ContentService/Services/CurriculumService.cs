using ContentService.Data;
using ContentService.Services.Import;
using Microsoft.EntityFrameworkCore;
using Shared.Audit;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Services;

public interface ICurriculumService
{
    Task<List<LevelDto>> GetLevelsAsync(CancellationToken cancellationToken = default);
    Task<List<SubjectDto>?> GetSubjectsAsync(string levelSlug, CancellationToken cancellationToken = default);
    Task<SubjectTreeDto?> GetSubjectTreeAsync(Guid subjectId, Caller caller, CancellationToken cancellationToken = default);
    Task<TopicDetailDto?> GetTopicAsync(Guid topicId, Caller caller, CancellationToken cancellationToken = default);

    Task<ContentResult<SubjectDto>> CreateSubjectAsync(CreateSubjectRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<SubjectDto>> UpdateSubjectAsync(Guid id, UpdateSubjectRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<bool>> DeleteSubjectAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    Task<ContentResult<CurriculumUnitDto>> CreateUnitAsync(CreateUnitRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<CurriculumUnitDto>> UpdateUnitAsync(Guid id, UpdateUnitRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<bool>> DeleteUnitAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    Task<ContentResult<TopicDto>> CreateTopicAsync(CreateTopicRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<TopicDto>> UpdateTopicAsync(Guid id, UpdateTopicRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<bool>> DeleteTopicAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    Task<ContentResult<LearningOutcomeDto>> CreateOutcomeAsync(CreateOutcomeRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<LearningOutcomeDto>> UpdateOutcomeAsync(Guid id, UpdateOutcomeRequest request, CancellationToken cancellationToken = default);
    Task<ContentResult<bool>> DeleteOutcomeAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>
    /// Idempotent upsert of a curriculum spreadsheet. All-or-nothing: when any row is invalid nothing is
    /// written and the errors are returned. With <paramref name="dryRun"/> the counts are computed but
    /// nothing is written either.
    /// </summary>
    Task<ContentResult<CurriculumImportResult>> ImportAsync(Stream file, string fileName, bool dryRun, Caller caller, CancellationToken cancellationToken = default);

    Task<List<LevelDto>> GetPublicLevelsAsync(CancellationToken cancellationToken = default);
    Task<PublicLevelDto?> GetPublicLevelAsync(string slug, CancellationToken cancellationToken = default);
}

public class CurriculumService : ICurriculumService
{
    private readonly ContentDbContext _db;
    private readonly IAuditLogger _audit;
    private readonly ILogger<CurriculumService> _logger;

    public CurriculumService(ContentDbContext db, IAuditLogger audit, ILogger<CurriculumService> logger)
    {
        _db = db;
        _audit = audit;
        _logger = logger;
    }

    // ---- Read ----

    public async Task<List<LevelDto>> GetLevelsAsync(CancellationToken cancellationToken = default) =>
        (await _db.Levels.AsNoTracking().OrderBy(l => l.Order).ToListAsync(cancellationToken))
            .Select(l => l.ToDto())
            .ToList();

    public async Task<List<SubjectDto>?> GetSubjectsAsync(string levelSlug, CancellationToken cancellationToken = default)
    {
        var level = await _db.Levels.AsNoTracking().FirstOrDefaultAsync(l => l.Slug == levelSlug, cancellationToken);
        if (level is null)
        {
            return null;
        }

        var subjects = await _db.Subjects.AsNoTracking()
            .Where(s => s.LevelId == level.Id)
            .OrderBy(s => s.Order).ThenBy(s => s.Name)
            .ToListAsync(cancellationToken);
        return subjects.Select(s => s.ToDto()).ToList();
    }

    public async Task<SubjectTreeDto?> GetSubjectTreeAsync(Guid subjectId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var subject = await _db.Subjects.AsNoTracking()
            .Include(s => s.Level)
            .Include(s => s.Units).ThenInclude(u => u.Topics)
            .AsSplitQuery()
            .FirstOrDefaultAsync(s => s.Id == subjectId, cancellationToken);
        if (subject is null)
        {
            return null;
        }

        var topicIds = subject.Units.SelectMany(u => u.Topics).Select(t => t.Id).ToList();

        var itemCounts = await _db.ContentItems.AsNoTracking()
            .ListedForEveryone()
            .Where(i => topicIds.Contains(i.TopicId))
            .GroupBy(i => i.TopicId)
            .Select(g => new { TopicId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TopicId, x => x.Count, cancellationToken);

        var completedCounts = await _db.Progress.AsNoTracking()
            .Where(p => p.UserId == caller.UserId && p.Completed)
            .Join(_db.ContentItems.ListedForEveryone().Where(i => topicIds.Contains(i.TopicId)),
                p => p.ContentItemId, i => i.Id, (p, i) => i.TopicId)
            .GroupBy(topicId => topicId)
            .Select(g => new { TopicId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TopicId, x => x.Count, cancellationToken);

        var units = subject.Units
            .OrderBy(u => u.Order).ThenBy(u => u.Name)
            .Select(u => new UnitNodeDto(
                u.Id,
                u.SubjectId,
                u.Name,
                u.Order,
                u.Topics
                    .OrderBy(t => t.Order).ThenBy(t => t.Name)
                    .Select(t => new TopicNodeDto(
                        t.Id, t.UnitId, t.Slug, t.Name, t.Order,
                        itemCounts.GetValueOrDefault(t.Id),
                        completedCounts.GetValueOrDefault(t.Id)))
                    .ToList()))
            .ToList();

        return new SubjectTreeDto(subject.ToDto(), subject.Level!.ToDto(), units);
    }

    public async Task<TopicDetailDto?> GetTopicAsync(Guid topicId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var topic = await _db.Topics.AsNoTracking()
            .Include(t => t.Unit).ThenInclude(u => u!.Subject)
            .Include(t => t.Outcomes)
            .FirstOrDefaultAsync(t => t.Id == topicId, cancellationToken);
        if (topic is null)
        {
            return null;
        }

        var items = await _db.ContentItems.AsNoTracking()
            .ListedForEveryone()
            .Where(i => i.TopicId == topicId)
            .OrderBy(i => i.Order).ThenBy(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        var itemIds = items.Select(i => i.Id).ToList();
        var progress = await _db.Progress.AsNoTracking()
            .Where(p => p.UserId == caller.UserId && itemIds.Contains(p.ContentItemId))
            .ToDictionaryAsync(p => p.ContentItemId, cancellationToken);

        return new TopicDetailDto(
            topic.Id,
            topic.UnitId,
            topic.Unit!.Name,
            topic.Unit.SubjectId,
            topic.Unit.Subject!.Name,
            topic.Slug,
            topic.Name,
            topic.Order,
            topic.Outcomes.OrderBy(o => o.Code, StringComparer.Ordinal).Select(o => o.ToDto()).ToList(),
            items.Select(i => i.ToSummary(progress.GetValueOrDefault(i.Id))).ToList());
    }

    // ---- Subjects ----

    public async Task<ContentResult<SubjectDto>> CreateSubjectAsync(CreateSubjectRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!await _db.Levels.AnyAsync(l => l.Id == request.LevelId, cancellationToken))
        {
            return ContentResult.Invalid<SubjectDto>("Level not found");
        }

        var slug = request.Slug ?? Slug.From(request.Name);
        if (await _db.Subjects.AnyAsync(s => s.LevelId == request.LevelId && s.Slug == slug, cancellationToken))
        {
            return ContentResult.Conflict<SubjectDto>($"A subject with slug '{slug}' already exists in this level");
        }

        var order = request.Order ?? await NextOrderAsync(_db.Subjects.Where(s => s.LevelId == request.LevelId).Select(s => s.Order), cancellationToken);
        var subject = new Subject
        {
            Id = Guid.NewGuid(),
            LevelId = request.LevelId,
            Name = request.Name.Trim(),
            Slug = slug,
            Color = request.Color ?? "#2563eb",
            Order = order
        };

        _db.Subjects.Add(subject);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(subject.ToDto());
    }

    public async Task<ContentResult<SubjectDto>> UpdateSubjectAsync(Guid id, UpdateSubjectRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var subject = await _db.Subjects.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (subject is null)
        {
            return ContentResult.NotFound<SubjectDto>("Subject not found");
        }

        if (request.Slug is not null && request.Slug != subject.Slug &&
            await _db.Subjects.AnyAsync(s => s.LevelId == subject.LevelId && s.Slug == request.Slug, cancellationToken))
        {
            return ContentResult.Conflict<SubjectDto>($"A subject with slug '{request.Slug}' already exists in this level");
        }

        if (request.Name is not null) subject.Name = request.Name.Trim();
        if (request.Slug is not null) subject.Slug = request.Slug;
        if (request.Color is not null) subject.Color = request.Color;
        if (request.Order.HasValue) subject.Order = request.Order.Value;

        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(subject.ToDto());
    }

    public async Task<ContentResult<bool>> DeleteSubjectAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var subject = await _db.Subjects.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (subject is null)
        {
            return ContentResult.NotFound<bool>("Subject not found");
        }

        if (await _db.ContentItems.AnyAsync(i => i.Topic!.Unit!.SubjectId == id, cancellationToken))
        {
            return ContentResult.Conflict<bool>("The subject still has content; move or delete it first");
        }

        _db.Subjects.Remove(subject);
        await _db.SaveChangesAsync(cancellationToken);
        await AuditAsync("ContentSubjectDeleted", caller, "Subject", id, cancellationToken);
        return ContentResult.Ok(true);
    }

    // ---- Units ----

    public async Task<ContentResult<CurriculumUnitDto>> CreateUnitAsync(CreateUnitRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!await _db.Subjects.AnyAsync(s => s.Id == request.SubjectId, cancellationToken))
        {
            return ContentResult.Invalid<CurriculumUnitDto>("Subject not found");
        }

        var unit = new CurriculumUnit
        {
            Id = Guid.NewGuid(),
            SubjectId = request.SubjectId,
            Name = request.Name.Trim(),
            Order = request.Order ?? await NextOrderAsync(_db.Units.Where(u => u.SubjectId == request.SubjectId).Select(u => u.Order), cancellationToken)
        };

        _db.Units.Add(unit);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(ToDto(unit));
    }

    public async Task<ContentResult<CurriculumUnitDto>> UpdateUnitAsync(Guid id, UpdateUnitRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var unit = await _db.Units.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (unit is null)
        {
            return ContentResult.NotFound<CurriculumUnitDto>("Unit not found");
        }

        if (request.Name is not null) unit.Name = request.Name.Trim();
        if (request.Order.HasValue) unit.Order = request.Order.Value;

        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(ToDto(unit));
    }

    public async Task<ContentResult<bool>> DeleteUnitAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var unit = await _db.Units.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (unit is null)
        {
            return ContentResult.NotFound<bool>("Unit not found");
        }

        if (await _db.ContentItems.AnyAsync(i => i.Topic!.UnitId == id, cancellationToken))
        {
            return ContentResult.Conflict<bool>("The unit still has content; move or delete it first");
        }

        _db.Units.Remove(unit);
        await _db.SaveChangesAsync(cancellationToken);
        await AuditAsync("ContentUnitDeleted", caller, "Unit", id, cancellationToken);
        return ContentResult.Ok(true);
    }

    // ---- Topics ----

    public async Task<ContentResult<TopicDto>> CreateTopicAsync(CreateTopicRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!await _db.Units.AnyAsync(u => u.Id == request.UnitId, cancellationToken))
        {
            return ContentResult.Invalid<TopicDto>("Unit not found");
        }

        var slug = request.Slug ?? Slug.From(request.Name);
        if (await _db.Topics.AnyAsync(t => t.UnitId == request.UnitId && t.Slug == slug, cancellationToken))
        {
            return ContentResult.Conflict<TopicDto>($"A topic with slug '{slug}' already exists in this unit");
        }

        var topic = new Topic
        {
            Id = Guid.NewGuid(),
            UnitId = request.UnitId,
            Name = request.Name.Trim(),
            Slug = slug,
            Order = request.Order ?? await NextOrderAsync(_db.Topics.Where(t => t.UnitId == request.UnitId).Select(t => t.Order), cancellationToken)
        };

        _db.Topics.Add(topic);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(ToDto(topic));
    }

    public async Task<ContentResult<TopicDto>> UpdateTopicAsync(Guid id, UpdateTopicRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var topic = await _db.Topics.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (topic is null)
        {
            return ContentResult.NotFound<TopicDto>("Topic not found");
        }

        if (request.Slug is not null && request.Slug != topic.Slug &&
            await _db.Topics.AnyAsync(t => t.UnitId == topic.UnitId && t.Slug == request.Slug, cancellationToken))
        {
            return ContentResult.Conflict<TopicDto>($"A topic with slug '{request.Slug}' already exists in this unit");
        }

        if (request.Name is not null) topic.Name = request.Name.Trim();
        if (request.Slug is not null) topic.Slug = request.Slug;
        if (request.Order.HasValue) topic.Order = request.Order.Value;

        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(ToDto(topic));
    }

    public async Task<ContentResult<bool>> DeleteTopicAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var topic = await _db.Topics.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (topic is null)
        {
            return ContentResult.NotFound<bool>("Topic not found");
        }

        if (await _db.ContentItems.AnyAsync(i => i.TopicId == id, cancellationToken))
        {
            return ContentResult.Conflict<bool>("The topic still has content; move or delete it first");
        }

        _db.Topics.Remove(topic);
        await _db.SaveChangesAsync(cancellationToken);
        await AuditAsync("ContentTopicDeleted", caller, "Topic", id, cancellationToken);
        return ContentResult.Ok(true);
    }

    // ---- Outcomes ----

    public async Task<ContentResult<LearningOutcomeDto>> CreateOutcomeAsync(CreateOutcomeRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!await _db.Topics.AnyAsync(t => t.Id == request.TopicId, cancellationToken))
        {
            return ContentResult.Invalid<LearningOutcomeDto>("Topic not found");
        }

        var code = request.Code.Trim();
        if (await _db.LearningOutcomes.AnyAsync(o => o.TopicId == request.TopicId && o.Code == code, cancellationToken))
        {
            return ContentResult.Conflict<LearningOutcomeDto>($"Outcome '{code}' already exists in this topic");
        }

        var outcome = new LearningOutcome
        {
            Id = Guid.NewGuid(),
            TopicId = request.TopicId,
            Code = code,
            Description = request.Description.Trim()
        };

        _db.LearningOutcomes.Add(outcome);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(outcome.ToDto());
    }

    public async Task<ContentResult<LearningOutcomeDto>> UpdateOutcomeAsync(Guid id, UpdateOutcomeRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var outcome = await _db.LearningOutcomes.FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
        if (outcome is null)
        {
            return ContentResult.NotFound<LearningOutcomeDto>("Outcome not found");
        }

        var code = request.Code?.Trim();
        if (code is not null && code != outcome.Code &&
            await _db.LearningOutcomes.AnyAsync(o => o.TopicId == outcome.TopicId && o.Code == code, cancellationToken))
        {
            return ContentResult.Conflict<LearningOutcomeDto>($"Outcome '{code}' already exists in this topic");
        }

        if (code is not null) outcome.Code = code;
        if (request.Description is not null) outcome.Description = request.Description.Trim();

        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(outcome.ToDto());
    }

    public async Task<ContentResult<bool>> DeleteOutcomeAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var outcome = await _db.LearningOutcomes.FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
        if (outcome is null)
        {
            return ContentResult.NotFound<bool>("Outcome not found");
        }

        _db.LearningOutcomes.Remove(outcome);
        await _db.SaveChangesAsync(cancellationToken);
        await AuditAsync("ContentOutcomeDeleted", caller, "LearningOutcome", id, cancellationToken);
        return ContentResult.Ok(true);
    }

    // ---- Import ----

    public async Task<ContentResult<CurriculumImportResult>> ImportAsync(
        Stream file,
        string fileName,
        bool dryRun,
        Caller caller,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);
        ArgumentNullException.ThrowIfNull(caller);

        List<List<string>> table;
        try
        {
            var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
            if (extension == ".xlsx")
            {
                table = XlsxTableReader.Read(file, CurriculumImportParser.MaxRows);
            }
            else if (extension is ".csv" or ".txt")
            {
                using var reader = new StreamReader(file, System.Text.Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
                table = CsvTableReader.Read(reader, CurriculumImportParser.MaxRows);
            }
            else
            {
                return ContentResult.Invalid<CurriculumImportResult>("Upload an .xlsx or .csv file.");
            }
        }
        catch (Exception ex) when (ex is InvalidDataException or System.Xml.XmlException)
        {
            return ContentResult.Invalid<CurriculumImportResult>("The file could not be read: " + ex.Message);
        }

        var parsed = CurriculumImportParser.Parse(table);
        var errors = parsed.Errors;

        var levels = await _db.Levels.AsNoTracking().ToListAsync(cancellationToken);
        var subjectsByLevel = new Dictionary<Guid, List<Subject>>();
        var touchedOutcomes = new HashSet<Guid>();
        int subjectsCreated = 0, unitsCreated = 0, topicsCreated = 0, outcomesCreated = 0, outcomesUpdated = 0;

        foreach (var row in parsed.Rows)
        {
            var level = ResolveLevel(row.Level, levels);
            if (level is null)
            {
                errors.Add(new CurriculumImportError(row.RowNumber, $"Unknown level '{row.Level}'"));
                continue;
            }

            if (!subjectsByLevel.TryGetValue(level.Id, out var subjects))
            {
                subjects = await _db.Subjects
                    .Where(s => s.LevelId == level.Id)
                    .Include(s => s.Units).ThenInclude(u => u.Topics).ThenInclude(t => t.Outcomes)
                    .AsSplitQuery()
                    .ToListAsync(cancellationToken);
                subjectsByLevel[level.Id] = subjects;
            }

            var subjectSlug = Slug.From(row.Subject);
            var subject = subjects.FirstOrDefault(s => s.Slug == subjectSlug || Slug.From(s.Name) == subjectSlug);
            if (subject is null)
            {
                subject = new Subject
                {
                    Id = Guid.NewGuid(),
                    LevelId = level.Id,
                    Name = row.Subject,
                    Slug = subjectSlug,
                    Order = subjects.Count == 0 ? 1 : subjects.Max(s => s.Order) + 1
                };
                subjects.Add(subject);
                _db.Subjects.Add(subject);
                subjectsCreated++;
            }

            var unitKey = Slug.From(row.Unit);
            var unit = subject.Units.FirstOrDefault(u => Slug.From(u.Name) == unitKey);
            if (unit is null)
            {
                unit = new CurriculumUnit
                {
                    Id = Guid.NewGuid(),
                    SubjectId = subject.Id,
                    Name = row.Unit,
                    Order = subject.Units.Count == 0 ? 1 : subject.Units.Max(u => u.Order) + 1
                };
                subject.Units.Add(unit);
                _db.Units.Add(unit);
                unitsCreated++;
            }

            var topicSlug = Slug.From(row.Topic);
            var topic = unit.Topics.FirstOrDefault(t => t.Slug == topicSlug);
            if (topic is null)
            {
                topic = new Topic
                {
                    Id = Guid.NewGuid(),
                    UnitId = unit.Id,
                    Name = row.Topic,
                    Slug = topicSlug,
                    Order = unit.Topics.Count == 0 ? 1 : unit.Topics.Max(t => t.Order) + 1
                };
                unit.Topics.Add(topic);
                _db.Topics.Add(topic);
                topicsCreated++;
            }

            if (row.OutcomeCode is null)
            {
                continue;
            }

            var outcome = topic.Outcomes.FirstOrDefault(o => string.Equals(o.Code, row.OutcomeCode, StringComparison.OrdinalIgnoreCase));
            if (outcome is null)
            {
                outcome = new LearningOutcome
                {
                    Id = Guid.NewGuid(),
                    TopicId = topic.Id,
                    Code = row.OutcomeCode,
                    Description = row.OutcomeDescription!
                };
                topic.Outcomes.Add(outcome);
                _db.LearningOutcomes.Add(outcome);
                touchedOutcomes.Add(outcome.Id);
                outcomesCreated++;
            }
            else if (outcome.Description != row.OutcomeDescription)
            {
                outcome.Description = row.OutcomeDescription!;
                if (touchedOutcomes.Add(outcome.Id))
                {
                    outcomesUpdated++;
                }
            }
        }

        errors.Sort((a, b) => a.Row.CompareTo(b.Row));
        var result = new CurriculumImportResult(
            dryRun,
            parsed.Rows.Count,
            subjectsCreated,
            unitsCreated,
            topicsCreated,
            outcomesCreated,
            outcomesUpdated,
            errors);

        if (dryRun || errors.Count > 0)
        {
            _db.ChangeTracker.Clear();
            return ContentResult.Ok(result);
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "Curriculum import conflicted with a concurrent change");
            return ContentResult.Conflict<CurriculumImportResult>("The curriculum changed while importing; run the import again.");
        }

        _logger.LogInformation(
            "Curriculum import by {UserId}: {Rows} rows, {Subjects} subjects, {Units} units, {Topics} topics, {Created} outcomes created, {Updated} updated",
            caller.UserId, parsed.Rows.Count, subjectsCreated, unitsCreated, topicsCreated, outcomesCreated, outcomesUpdated);
        await _audit.WriteAsync(
            new AuditRecord("CurriculumImported", caller.UserId, "Curriculum", null,
                $"rows={parsed.Rows.Count} subjects={subjectsCreated} units={unitsCreated} topics={topicsCreated} outcomes={outcomesCreated}/{outcomesUpdated}"),
            cancellationToken);

        return ContentResult.Ok(result);
    }

    /// <summary>
    /// Accepts the slug ("5-sinif"), the display name ("5. Sınıf"), a bare grade ("5") or an exam
    /// short form ("TYT").
    /// </summary>
    internal static Level? ResolveLevel(string value, IReadOnlyList<Level> levels)
    {
        var slug = Slug.From(value);
        if (int.TryParse(slug, out var grade))
        {
            slug = $"{grade}-sinif";
        }

        return levels.FirstOrDefault(l => l.Slug == slug)
            ?? levels.FirstOrDefault(l => Slug.From(l.Name) == slug)
            ?? levels.FirstOrDefault(l => l.Slug == "yks-" + slug);
    }

    // ---- Public ----

    public Task<List<LevelDto>> GetPublicLevelsAsync(CancellationToken cancellationToken = default) =>
        GetLevelsAsync(cancellationToken);

    public async Task<PublicLevelDto?> GetPublicLevelAsync(string slug, CancellationToken cancellationToken = default)
    {
        var level = await _db.Levels.AsNoTracking().FirstOrDefaultAsync(l => l.Slug == slug, cancellationToken);
        if (level is null)
        {
            return null;
        }

        var subjects = await _db.Subjects.AsNoTracking()
            .Where(s => s.LevelId == level.Id)
            .OrderBy(s => s.Order).ThenBy(s => s.Name)
            .Select(s => new
            {
                Subject = s,
                UnitCount = s.Units.Count,
                TopicCount = s.Units.SelectMany(u => u.Topics).Count()
            })
            .ToListAsync(cancellationToken);

        var stats = await _db.ContentItems.AsNoTracking()
            .ListedForEveryone()
            .Where(i => i.Topic!.Unit!.Subject!.LevelId == level.Id)
            .GroupBy(i => i.Topic!.Unit!.SubjectId)
            .Select(g => new
            {
                SubjectId = g.Key,
                Count = g.Count(),
                VideoSeconds = g.Sum(i => i.Type == ContentItemType.Video || i.Type == ContentItemType.SolvedQuestionVideo
                    ? (i.DurationSeconds ?? 0)
                    : 0)
            })
            .ToDictionaryAsync(x => x.SubjectId, cancellationToken);

        var subjectStats = subjects
            .Select(s =>
            {
                var stat = stats.GetValueOrDefault(s.Subject.Id);
                return new PublicSubjectStatsDto(
                    s.Subject.Id,
                    s.Subject.Slug,
                    s.Subject.Name,
                    s.Subject.Color,
                    s.UnitCount,
                    s.TopicCount,
                    stat?.Count ?? 0,
                    (stat?.VideoSeconds ?? 0) / 60);
            })
            .ToList();

        var samples = await _db.ContentItems.AsNoTracking()
            .ListedForEveryone()
            .Where(i => i.AccessTier == ContentAccessTier.Free && i.Topic!.Unit!.Subject!.LevelId == level.Id)
            .OrderBy(i => i.Type == ContentItemType.Video || i.Type == ContentItemType.SolvedQuestionVideo ? 0 : 1)
            .ThenByDescending(i => i.PublishedAt)
            .Take(6)
            .Select(i => new PublicSampleItemDto(
                i.Id,
                i.Title,
                i.Type,
                i.Topic!.Unit!.Subject!.Name,
                i.Topic.Name,
                i.DurationSeconds))
            .ToListAsync(cancellationToken);

        var totalSeconds = stats.Values.Sum(s => (long)s.VideoSeconds);
        return new PublicLevelDto(
            level.ToDto(),
            subjectStats,
            stats.Values.Sum(s => s.Count),
            (int)(totalSeconds / 60),
            samples);
    }

    // ---- Helpers ----

    private static async Task<int> NextOrderAsync(IQueryable<int> orders, CancellationToken cancellationToken) =>
        (await orders.Select(o => (int?)o).MaxAsync(cancellationToken) ?? 0) + 1;

    private static CurriculumUnitDto ToDto(CurriculumUnit unit) => new(unit.Id, unit.SubjectId, unit.Name, unit.Order);

    private static TopicDto ToDto(Topic topic) => new(topic.Id, topic.UnitId, topic.Slug, topic.Name, topic.Order);

    private Task AuditAsync(string action, Caller caller, string entityType, Guid id, CancellationToken cancellationToken) =>
        _audit.WriteAsync(new AuditRecord(action, caller.UserId, entityType, id.ToString()), cancellationToken);
}
