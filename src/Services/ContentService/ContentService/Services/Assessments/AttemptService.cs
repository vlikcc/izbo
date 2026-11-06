using ContentService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Services.Assessments;

public interface IAttemptService
{
    /// <summary>Starts a generated topic or unit test, or resumes the one already running for it.</summary>
    Task<ContentResult<AttemptDto>> StartPracticeAsync(StartPracticeRequest request, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>Starts a published mock exam or placement test; a second call returns the same sitting.</summary>
    Task<ContentResult<AttemptDto>> StartAssessmentAsync(Guid assessmentId, Caller caller, CancellationToken cancellationToken = default);

    Task<ContentResult<AttemptDto>> GetAsync(Guid attemptId, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<bool>> SaveAnswerAsync(Guid attemptId, int order, SaveAnswerRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<AttemptSummaryDto>> SubmitAsync(Guid attemptId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>Whose attempt this is, so the controller can apply the guardian check. Null when it does not exist.</summary>
    Task<Guid?> FindOwnerAsync(Guid attemptId, CancellationToken cancellationToken = default);

    /// <summary>The full report. The caller must already have checked who may read it.</summary>
    Task<AttemptReportDto?> GetReportAsync(Guid attemptId, CancellationToken cancellationToken = default);

    Task<List<AttemptSummaryDto>> ListForUserAsync(Guid userId, int take, CancellationToken cancellationToken = default);
    Task<MasteryDto> GetMasteryAsync(Guid userId, Guid? subjectId, int days, CancellationToken cancellationToken = default);

    /// <summary>Closes and grades attempts whose time ran out. Returns how many were closed.</summary>
    Task<int> ExpireOverdueAsync(CancellationToken cancellationToken = default);

    /// <summary>Ranks every mock exam whose window has closed and was not ranked yet. Returns how many were ranked.</summary>
    Task<int> RankClosedAssessmentsAsync(CancellationToken cancellationToken = default);
}

public class AttemptService : IAttemptService
{
    public const int DefaultTopicQuestions = 10;
    public const int DefaultUnitQuestions = 20;
    public const int MinPracticeQuestions = 5;
    public const int MaxPracticeQuestions = 30;

    /// <summary>Minutes per question in a generated test (LGS gives about 1.5 minutes per question).</summary>
    public const double MinutesPerQuestion = 1.5;

    private const int MasteryWeakMinimum = 3;
    private const int ReportWeakMinimum = 2;
    private const decimal WeakBelowPercent = 50m;
    private const int MaxRecommendations = 5;

    private readonly ContentDbContext _db;
    private readonly TimeProvider _clock;
    private readonly ILogger<AttemptService> _logger;

    public AttemptService(ContentDbContext db, TimeProvider clock, ILogger<AttemptService> logger)
    {
        _db = db;
        _clock = clock;
        _logger = logger;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;

    // ---- Starting ----

    public async Task<ContentResult<AttemptDto>> StartPracticeAsync(StartPracticeRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        if (request.TopicId.HasValue == request.UnitId.HasValue)
        {
            return ContentResult.Invalid<AttemptDto>("Choose a topic or a unit");
        }

        var now = Now;
        Level level;
        string title;
        List<Guid> topicIds;
        AttemptScope scope;

        if (request.TopicId is { } topicId)
        {
            var topic = await _db.Topics.AsNoTracking()
                .Include(t => t.Unit!).ThenInclude(u => u.Subject!).ThenInclude(s => s.Level)
                .FirstOrDefaultAsync(t => t.Id == topicId, cancellationToken);
            if (topic is null)
            {
                return ContentResult.NotFound<AttemptDto>("Topic not found");
            }

            scope = AttemptScope.Topic;
            level = topic.Unit!.Subject!.Level!;
            title = $"{topic.Name} — konu testi";
            topicIds = [topic.Id];
        }
        else
        {
            var unit = await _db.Units.AsNoTracking()
                .Include(u => u.Subject!).ThenInclude(s => s.Level)
                .Include(u => u.Topics)
                .FirstOrDefaultAsync(u => u.Id == request.UnitId!.Value, cancellationToken);
            if (unit is null)
            {
                return ContentResult.NotFound<AttemptDto>("Unit not found");
            }

            scope = AttemptScope.Unit;
            level = unit.Subject!.Level!;
            title = $"{unit.Name} — ünite testi";
            topicIds = unit.Topics.Select(t => t.Id).ToList();
        }

        // A test already running for the same topic or unit is resumed rather than duplicated.
        var running = await _db.Attempts
            .Include(a => a.Items)
            .Include(a => a.Assessment)
            .Where(a => a.UserId == caller.UserId
                && a.Status == AttemptStatus.InProgress
                && a.Scope == scope
                && (scope == AttemptScope.Topic ? a.TopicId == request.TopicId : a.UnitId == request.UnitId))
            .OrderByDescending(a => a.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (running is not null)
        {
            if (!IsOverdue(running, now))
            {
                return ContentResult.Ok(await ToAttemptDtoAsync(running, now, cancellationToken));
            }

            Grade(running, AttemptStatus.Expired, now);
            await _db.SaveChangesAsync(cancellationToken);
        }

        var count = Math.Clamp(
            request.Count ?? (scope == AttemptScope.Topic ? DefaultTopicQuestions : DefaultUnitQuestions),
            MinPracticeQuestions,
            MaxPracticeQuestions);

        var reserved = AssessmentQueries.ReservedQuestionIds(_db, now);
        var candidates = await _db.BankQuestions.AsNoTracking()
            .Where(q => topicIds.Contains(q.TopicId) && q.Status == ContentStatus.Published && !reserved.Contains(q.Id))
            .Select(q => new { q.Id, q.Difficulty })
            .ToListAsync(cancellationToken);
        if (candidates.Count == 0)
        {
            return ContentResult.Invalid<AttemptDto>("There are no questions for this yet");
        }

        var candidateIds = candidates.Select(c => c.Id).ToList();
        var seen = (await _db.AttemptItems.AsNoTracking()
                .Where(i => i.Attempt!.UserId == caller.UserId && candidateIds.Contains(i.QuestionId))
                .Select(i => i.QuestionId)
                .Distinct()
                .ToListAsync(cancellationToken))
            .ToHashSet();

        var picked = PracticeSelector.Select(
            candidates.Select(c => (c.Id, c.Difficulty)).ToList(), seen, count, Random.Shared);
        var questions = await _db.BankQuestions.AsNoTracking()
            .Where(q => picked.Contains(q.Id))
            .ToDictionaryAsync(q => q.Id, cancellationToken);

        var attempt = new Attempt
        {
            Id = Guid.NewGuid(),
            UserId = caller.UserId,
            Scope = scope,
            TopicId = request.TopicId,
            UnitId = request.UnitId,
            Title = title,
            ScoringRule = ScoringCalculator.DefaultFor(level),
            StartedAt = now,
            Deadline = now.AddMinutes(Math.Ceiling(picked.Count * MinutesPerQuestion)),
            Status = AttemptStatus.InProgress,
        };

        var order = 1;
        foreach (var id in picked)
        {
            attempt.Items.Add(NewItem(attempt.Id, order++, questions[id], sectionId: null));
        }

        _db.Attempts.Add(attempt);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Practice attempt {AttemptId} ({Count} questions) started by {UserId}", attempt.Id, picked.Count, caller.UserId);
        return ContentResult.Ok(await ToAttemptDtoAsync(attempt, now, cancellationToken));
    }

    public async Task<ContentResult<AttemptDto>> StartAssessmentAsync(Guid assessmentId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var now = Now;
        // Tracked on purpose: the new attempt points at it, and an untracked copy would clash on the next save.
        var assessment = await _db.Assessments
            .FirstOrDefaultAsync(a => a.Id == assessmentId && a.Status == AssessmentStatus.Published, cancellationToken);
        if (assessment is null)
        {
            return ContentResult.NotFound<AttemptDto>("Test not found");
        }

        var existing = await LoadAttemptAsync(a => a.UserId == caller.UserId && a.AssessmentId == assessmentId, cancellationToken);
        if (existing is not null)
        {
            return ContentResult.Ok(await ResumeAsync(existing, now, cancellationToken));
        }

        var ranked = false;
        var deadline = now.AddMinutes(assessment.DurationMinutes);
        if (assessment.Kind == AssessmentKind.MockExam)
        {
            if (assessment.WindowStart is { } start && now < start)
            {
                return ContentResult.Conflict<AttemptDto>("This mock exam has not started yet");
            }

            // Inside the window the sitting is ranked and ends with the window at the latest.
            if (assessment.WindowEnd is { } end && now < end)
            {
                ranked = true;
                if (end < deadline)
                {
                    deadline = end;
                }
            }
        }

        var entries = await _db.AssessmentQuestions.AsNoTracking()
            .Where(aq => aq.AssessmentId == assessmentId)
            .Include(aq => aq.Question)
            .OrderBy(aq => aq.Section!.Order).ThenBy(aq => aq.Order)
            .ToListAsync(cancellationToken);
        if (entries.Count == 0)
        {
            return ContentResult.Invalid<AttemptDto>("This test has no questions");
        }

        var attempt = new Attempt
        {
            Id = Guid.NewGuid(),
            UserId = caller.UserId,
            Scope = AttemptScope.Assessment,
            AssessmentId = assessmentId,
            Title = assessment.Title,
            ScoringRule = assessment.ScoringRule,
            StartedAt = now,
            Deadline = deadline,
            IsRanked = ranked,
            Status = AttemptStatus.InProgress,
        };

        var order = 1;
        foreach (var entry in entries)
        {
            attempt.Items.Add(NewItem(attempt.Id, order++, entry.Question!, entry.SectionId));
        }

        _db.Attempts.Add(attempt);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Two tabs started at once; the unique (user, assessment) index kept one. Return that one.
            _db.ChangeTracker.Clear();
            var winner = await LoadAttemptAsync(a => a.UserId == caller.UserId && a.AssessmentId == assessmentId, cancellationToken);
            if (winner is null)
            {
                throw;
            }

            return ContentResult.Ok(await ResumeAsync(winner, now, cancellationToken));
        }

        _logger.LogInformation("Assessment attempt {AttemptId} for {AssessmentId} started by {UserId} (ranked: {Ranked})",
            attempt.Id, assessmentId, caller.UserId, ranked);
        return ContentResult.Ok(await ToAttemptDtoAsync(attempt, now, cancellationToken));
    }

    // ---- Answering ----

    public async Task<ContentResult<AttemptDto>> GetAsync(Guid attemptId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var attempt = await LoadAttemptAsync(a => a.Id == attemptId, cancellationToken);
        if (attempt is null || (attempt.UserId != caller.UserId && !caller.IsPlatformAdmin))
        {
            return ContentResult.NotFound<AttemptDto>("Attempt not found");
        }

        return ContentResult.Ok(await ResumeAsync(attempt, Now, cancellationToken));
    }

    public async Task<ContentResult<bool>> SaveAnswerAsync(Guid attemptId, int order, SaveAnswerRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        var now = Now;
        var attempt = await LoadAttemptAsync(a => a.Id == attemptId, cancellationToken);
        if (attempt is null || attempt.UserId != caller.UserId)
        {
            return ContentResult.NotFound<bool>("Attempt not found");
        }

        if (attempt.Status != AttemptStatus.InProgress)
        {
            return ContentResult.Conflict<bool>("This test is already finished");
        }

        if (IsOverdue(attempt, now))
        {
            Grade(attempt, AttemptStatus.Expired, now);
            await _db.SaveChangesAsync(cancellationToken);
            return ContentResult.Conflict<bool>("Time is up; the test was closed with the answers saved so far");
        }

        var item = attempt.Items.FirstOrDefault(i => i.Order == order);
        if (item is null)
        {
            return ContentResult.NotFound<bool>("Question not found");
        }

        var key = string.IsNullOrWhiteSpace(request.SelectedKey) ? null : request.SelectedKey.Trim().ToUpperInvariant();
        if (key is not null && (key.Length != 1 || key[0] < 'A' || key[0] >= 'A' + item.OptionCount))
        {
            return ContentResult.Invalid<bool>("That option does not exist");
        }

        item.SelectedKey = key;
        item.AnsweredAt = key is null ? null : now;
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(true);
    }

    public async Task<ContentResult<AttemptSummaryDto>> SubmitAsync(Guid attemptId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var now = Now;
        var attempt = await LoadAttemptAsync(a => a.Id == attemptId, cancellationToken);
        if (attempt is null || attempt.UserId != caller.UserId)
        {
            return ContentResult.NotFound<AttemptSummaryDto>("Attempt not found");
        }

        if (attempt.Status == AttemptStatus.InProgress)
        {
            Grade(attempt, IsOverdue(attempt, now) ? AttemptStatus.Expired : AttemptStatus.Submitted, now);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return ContentResult.Ok(AssessmentQueries.ToSummary(attempt, now));
    }

    // ---- Results ----

    public async Task<Guid?> FindOwnerAsync(Guid attemptId, CancellationToken cancellationToken = default) =>
        await _db.Attempts.AsNoTracking()
            .Where(a => a.Id == attemptId)
            .Select(a => (Guid?)a.UserId)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<AttemptReportDto?> GetReportAsync(Guid attemptId, CancellationToken cancellationToken = default)
    {
        var now = Now;
        var attempt = await LoadAttemptAsync(a => a.Id == attemptId, cancellationToken);
        if (attempt is null)
        {
            return null;
        }

        if (attempt.Status == AttemptStatus.InProgress && IsOverdue(attempt, now))
        {
            Grade(attempt, AttemptStatus.Expired, now);
            await _db.SaveChangesAsync(cancellationToken);
        }

        var summary = AssessmentQueries.ToSummary(attempt, now);
        if (!summary.ResultsVisible)
        {
            return new AttemptReportDto(summary, [], [], [], [], [], []);
        }

        var items = attempt.Items.OrderBy(i => i.Order).ToList();
        var questionIds = items.Select(i => i.QuestionId).Distinct().ToList();
        var questions = await _db.BankQuestions.AsNoTracking()
            .Where(q => questionIds.Contains(q.Id))
            .ToDictionaryAsync(q => q.Id, cancellationToken);
        var topicIds = items.Select(i => i.TopicId).Distinct().ToList();
        var topics = await _db.Topics.AsNoTracking()
            .Where(t => topicIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name, cancellationToken);
        var outcomeIds = items.Where(i => i.LearningOutcomeId != null).Select(i => i.LearningOutcomeId!.Value).Distinct().ToList();
        var outcomes = await _db.LearningOutcomes.AsNoTracking()
            .Where(o => outcomeIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, cancellationToken);
        var sections = attempt.AssessmentId is { } assessmentId
            ? await _db.AssessmentSections.AsNoTracking()
                .Where(s => s.AssessmentId == assessmentId)
                .ToDictionaryAsync(s => s.Id, cancellationToken)
            : new Dictionary<Guid, AssessmentSection>();

        var sectionResults = items
            .Where(i => i.SectionId != null && sections.ContainsKey(i.SectionId.Value))
            .GroupBy(i => i.SectionId!.Value)
            .Select(g =>
            {
                var section = sections[g.Key];
                var score = ScoreOf(attempt.ScoringRule, g);
                return (section.Order, Result: new SectionResultDto(section.Title, section.SubjectId, score.Correct, score.Wrong, score.Blank, score.Net));
            })
            .OrderBy(x => x.Order)
            .Select(x => x.Result)
            .ToList();

        var topicRows = items
            .GroupBy(i => i.TopicId)
            .Select(g => Row(g.Key, topics.GetValueOrDefault(g.Key, string.Empty), null, g))
            .OrderBy(r => r.Percent).ThenBy(r => r.TopicName, StringComparer.Ordinal)
            .ToList();

        var outcomeRows = items
            .Where(i => i.LearningOutcomeId != null && outcomes.ContainsKey(i.LearningOutcomeId.Value))
            .GroupBy(i => i.LearningOutcomeId!.Value)
            .Select(g =>
            {
                var outcome = outcomes[g.Key];
                return Row(outcome.TopicId, topics.GetValueOrDefault(outcome.TopicId, string.Empty), outcome, g);
            })
            .OrderBy(r => r.Percent).ThenBy(r => r.OutcomeCode, StringComparer.Ordinal)
            .ToList();

        // Weak outcomes first; a weak topic is added when none of its outcomes already says so.
        var weak = outcomeRows.Where(IsWeakInReport).ToList();
        var coveredTopics = weak.Select(r => r.TopicId).ToHashSet();
        weak.AddRange(topicRows.Where(r => IsWeakInReport(r) && !coveredTopics.Contains(r.TopicId)));

        var recommendations = await RecommendAsync(attempt.UserId, weak, topics, cancellationToken);

        var review = items.Select(i =>
        {
            questions.TryGetValue(i.QuestionId, out var q);
            sections.TryGetValue(i.SectionId ?? Guid.Empty, out var section);
            return new ReviewQuestionDto(
                i.Order,
                i.QuestionId,
                section?.Title,
                q?.Type ?? BankQuestionType.MultipleChoice,
                q?.Stem ?? string.Empty,
                q?.StemAssetId,
                q?.Options.Select(o => new QuestionOptionDto(o.Key, o.Text, o.AssetId)).ToList() ?? [],
                i.SelectedKey,
                i.CorrectKey,
                i.IsCorrect,
                q?.Explanation ?? string.Empty,
                q?.SolutionVideoItemId,
                topics.GetValueOrDefault(i.TopicId, string.Empty),
                i.LearningOutcomeId is { } oid && outcomes.TryGetValue(oid, out var o) ? o.Code : null);
        }).ToList();

        return new AttemptReportDto(summary, sectionResults, topicRows, outcomeRows, weak, recommendations, review);
    }

    public async Task<List<AttemptSummaryDto>> ListForUserAsync(Guid userId, int take, CancellationToken cancellationToken = default)
    {
        var now = Now;
        var attempts = await _db.Attempts.AsNoTracking()
            .Include(a => a.Items)
            .Include(a => a.Assessment)
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.StartedAt)
            .Take(Math.Clamp(take, 1, 50))
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return attempts.Select(a => AssessmentQueries.ToSummary(a, now)).ToList();
    }

    public async Task<MasteryDto> GetMasteryAsync(Guid userId, Guid? subjectId, int days, CancellationToken cancellationToken = default)
    {
        var now = Now;
        var since = now.AddDays(-Math.Clamp(days, 1, 365));

        var query = _db.AttemptItems.AsNoTracking()
            .Where(i => i.Attempt!.UserId == userId
                && i.Attempt.Status != AttemptStatus.InProgress
                && i.Attempt.StartedAt >= since
                // A ranked deneme's answers stay secret until its window closes.
                && !(i.Attempt.IsRanked && i.Attempt.Assessment!.WindowEnd > now));

        var rows = await query
            .Join(_db.Topics, i => i.TopicId, t => t.Id, (i, t) => new
            {
                i.TopicId,
                TopicName = t.Name,
                t.Unit!.SubjectId,
                SubjectName = t.Unit.Subject!.Name,
                Correct = i.IsCorrect == true,
                i.Attempt!.StartedAt
            })
            .Where(r => subjectId == null || r.SubjectId == subjectId)
            .GroupBy(r => new { r.TopicId, r.TopicName, r.SubjectId, r.SubjectName })
            .Select(g => new
            {
                g.Key.TopicId,
                g.Key.TopicName,
                g.Key.SubjectId,
                g.Key.SubjectName,
                Correct = g.Count(r => r.Correct),
                Total = g.Count(),
                Last = g.Max(r => r.StartedAt)
            })
            .ToListAsync(cancellationToken);

        var topics = rows
            .Select(r => new TopicMasteryDto(
                r.TopicId, r.TopicName, r.SubjectId, r.SubjectName, r.Correct, r.Total,
                ScoringCalculator.PercentOf(r.Correct, r.Total), r.Last))
            .OrderBy(t => t.SubjectName, StringComparer.Ordinal).ThenBy(t => t.TopicName, StringComparer.Ordinal)
            .ToList();

        var weak = topics
            .Where(t => t.Total >= MasteryWeakMinimum && t.Percent < WeakBelowPercent)
            .OrderBy(t => t.Percent).ThenByDescending(t => t.LastAttemptAt)
            .Take(5)
            .ToList();

        return new MasteryDto(userId, since, topics, weak);
    }

    // ---- Maintenance ----

    public async Task<int> ExpireOverdueAsync(CancellationToken cancellationToken = default)
    {
        var now = Now;
        var cutoff = now - AssessmentQueries.Grace;
        var closed = 0;

        while (true)
        {
            var batch = await _db.Attempts
                .Include(a => a.Items)
                .Where(a => a.Status == AttemptStatus.InProgress && a.Deadline < cutoff)
                .OrderBy(a => a.Deadline)
                .Take(100)
                .ToListAsync(cancellationToken);
            if (batch.Count == 0)
            {
                return closed;
            }

            foreach (var attempt in batch)
            {
                Grade(attempt, AttemptStatus.Expired, now);
            }

            await _db.SaveChangesAsync(cancellationToken);
            _db.ChangeTracker.Clear();
            closed += batch.Count;
            _logger.LogInformation("Closed {Count} attempts whose time ran out", batch.Count);
        }
    }

    public async Task<int> RankClosedAssessmentsAsync(CancellationToken cancellationToken = default)
    {
        await ExpireOverdueAsync(cancellationToken);

        var now = Now;
        var cutoff = now - AssessmentQueries.Grace;
        var due = await _db.Assessments
            .Where(a => a.Kind == AssessmentKind.MockExam
                && a.Status == AssessmentStatus.Published
                && a.RankedAt == null
                && a.WindowEnd != null
                && a.WindowEnd < cutoff)
            .ToListAsync(cancellationToken);

        var ranked = 0;
        foreach (var assessment in due)
        {
            var attempts = await _db.Attempts
                .Where(a => a.AssessmentId == assessment.Id && a.IsRanked)
                .ToListAsync(cancellationToken);
            if (attempts.Any(a => a.Status == AttemptStatus.InProgress))
            {
                continue;
            }

            var placements = RankingCalculator.Rank(attempts.Select(a => (a.Id, a.Net)).ToList());
            foreach (var attempt in attempts)
            {
                var placement = placements[attempt.Id];
                attempt.Rank = placement.Rank;
                attempt.ParticipantCount = placement.ParticipantCount;
                attempt.TopPercent = placement.TopPercent;
            }

            assessment.RankedAt = now;
            await _db.SaveChangesAsync(cancellationToken);
            ranked++;
            _logger.LogInformation("Ranked {Count} sittings of mock exam {AssessmentId}", attempts.Count, assessment.Id);
        }

        return ranked;
    }

    // ---- Helpers ----

    private Task<Attempt?> LoadAttemptAsync(System.Linq.Expressions.Expression<Func<Attempt, bool>> predicate, CancellationToken cancellationToken) =>
        _db.Attempts
            .Include(a => a.Items)
            .Include(a => a.Assessment)
            .AsSplitQuery()
            .FirstOrDefaultAsync(predicate, cancellationToken);

    /// <summary>Returns the attempt as it stands, closing it first if its time ran out meanwhile.</summary>
    private async Task<AttemptDto> ResumeAsync(Attempt attempt, DateTime now, CancellationToken cancellationToken)
    {
        if (attempt.Status == AttemptStatus.InProgress && IsOverdue(attempt, now))
        {
            Grade(attempt, AttemptStatus.Expired, now);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return await ToAttemptDtoAsync(attempt, now, cancellationToken);
    }

    private static bool IsOverdue(Attempt attempt, DateTime now) => now > attempt.Deadline + AssessmentQueries.Grace;

    private static AttemptItem NewItem(Guid attemptId, int order, BankQuestion question, Guid? sectionId) => new()
    {
        AttemptId = attemptId,
        Order = order,
        QuestionId = question.Id,
        SectionId = sectionId,
        TopicId = question.TopicId,
        LearningOutcomeId = question.LearningOutcomeId,
        OptionCount = question.Options.Count,
        CorrectKey = question.CorrectKey,
    };

    private static void Grade(Attempt attempt, AttemptStatus status, DateTime now)
    {
        foreach (var item in attempt.Items)
        {
            item.IsCorrect = item.SelectedKey is null ? null : item.SelectedKey == item.CorrectKey;
        }

        var score = ScoreOf(attempt.ScoringRule, attempt.Items);
        attempt.Correct = score.Correct;
        attempt.Wrong = score.Wrong;
        attempt.Blank = score.Blank;
        attempt.Net = score.Net;
        attempt.Percent = score.Percent;
        attempt.Status = status;
        attempt.SubmittedAt = now;
    }

    private static Score ScoreOf(ScoringRule rule, IEnumerable<AttemptItem> items)
    {
        int correct = 0, wrong = 0, blank = 0;
        foreach (var item in items)
        {
            if (item.SelectedKey is null) blank++;
            else if (item.SelectedKey == item.CorrectKey) correct++;
            else wrong++;
        }

        return ScoringCalculator.Compute(rule, correct, wrong, blank);
    }

    private static MasteryRowDto Row(Guid topicId, string topicName, LearningOutcome? outcome, IEnumerable<AttemptItem> items)
    {
        var list = items.ToList();
        var correct = list.Count(i => i.SelectedKey != null && i.SelectedKey == i.CorrectKey);
        return new MasteryRowDto(
            topicId, topicName, outcome?.Id, outcome?.Code, outcome?.Description,
            correct, list.Count, ScoringCalculator.PercentOf(correct, list.Count));
    }

    private static bool IsWeakInReport(MasteryRowDto row) => row.Total >= ReportWeakMinimum && row.Percent < WeakBelowPercent;

    /// <summary>
    /// Published content that teaches the weak outcomes (through the content–outcome links), falling back to
    /// content of the weak topics. Content the student already finished is left out; videos come first.
    /// </summary>
    private async Task<List<RecommendedContentDto>> RecommendAsync(
        Guid userId, List<MasteryRowDto> weak, Dictionary<Guid, string> topicNames, CancellationToken cancellationToken)
    {
        if (weak.Count == 0)
        {
            return [];
        }

        var weakOutcomes = weak.Where(w => w.OutcomeId != null).Select(w => w.OutcomeId!.Value).ToList();
        var weakTopics = weak.Where(w => w.OutcomeId == null).Select(w => w.TopicId).Distinct().ToList();

        var candidates = await RecommendationCandidatesAsync(userId, weakOutcomes, weakTopics, cancellationToken);
        if (candidates.Count == 0 && weakOutcomes.Count > 0)
        {
            // Nothing is linked to the weak outcomes yet: offer what the rest of their topics teach.
            var outcomeTopics = weak.Where(w => w.OutcomeId != null).Select(w => w.TopicId).Distinct().ToList();
            candidates = await RecommendationCandidatesAsync(userId, weakOutcomes, outcomeTopics, cancellationToken);
        }

        return candidates
            .OrderBy(c => c.OutcomeCode == null ? 1 : 0)
            .ThenBy(c => c.Item.IsVideo ? 0 : 1)
            .ThenBy(c => c.Item.Order)
            .Take(MaxRecommendations)
            .Select(c => new RecommendedContentDto(
                c.Item.ToSummary(null),
                c.Item.TopicId,
                topicNames.GetValueOrDefault(c.Item.TopicId, c.TopicName),
                c.OutcomeCode))
            .ToList();
    }

    private sealed record Candidate(ContentItem Item, string TopicName, string? OutcomeCode);

    private async Task<List<Candidate>> RecommendationCandidatesAsync(
        Guid userId, List<Guid> outcomeIds, List<Guid> topicIds, CancellationToken cancellationToken)
    {
        var finished = _db.Progress.Where(p => p.UserId == userId && p.Completed).Select(p => p.ContentItemId);

        var rows = await _db.ContentItems.AsNoTracking()
            .ListedForEveryone()
            .Where(i => !finished.Contains(i.Id)
                && (topicIds.Contains(i.TopicId) || i.Outcomes.Any(o => outcomeIds.Contains(o.LearningOutcomeId))))
            .Select(i => new
            {
                Item = i,
                TopicName = i.Topic!.Name,
                OutcomeCode = i.Outcomes
                    .Where(o => outcomeIds.Contains(o.LearningOutcomeId))
                    .Select(o => o.LearningOutcome!.Code)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        return rows.Select(r => new Candidate(r.Item, r.TopicName, r.OutcomeCode)).ToList();
    }

    private async Task<AttemptDto> ToAttemptDtoAsync(Attempt attempt, DateTime now, CancellationToken cancellationToken)
    {
        var items = attempt.Items.OrderBy(i => i.Order).ToList();
        var questionIds = items.Select(i => i.QuestionId).Distinct().ToList();
        var questions = await _db.BankQuestions.AsNoTracking()
            .Where(q => questionIds.Contains(q.Id))
            .ToDictionaryAsync(q => q.Id, cancellationToken);
        var sections = attempt.AssessmentId is { } assessmentId
            ? await _db.AssessmentSections.AsNoTracking()
                .Where(s => s.AssessmentId == assessmentId)
                .ToDictionaryAsync(s => s.Id, s => s.Title, cancellationToken)
            : new Dictionary<Guid, string>();

        var dtos = items.Select(i =>
        {
            var q = questions[i.QuestionId];
            return new AttemptQuestionDto(
                i.Order,
                i.QuestionId,
                i.SectionId is { } sid ? sections.GetValueOrDefault(sid) : null,
                q.Type,
                q.Stem,
                q.StemAssetId,
                q.Options.Select(o => new QuestionOptionDto(o.Key, o.Text, o.AssetId)).ToList(),
                i.SelectedKey);
        }).ToList();

        return new AttemptDto(AssessmentQueries.ToSummary(attempt, now), now, dtos);
    }
}
