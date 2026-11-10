using System.Globalization;
using System.Text.Json;
using ContentService.Kampus.Catalog;
using ContentService.Kampus.Data;
using ContentService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace ContentService.Kampus.Services;

/// <summary>
/// A student's own work in YZ Kampüs: path stops, mini tests, the topic player, books and games — and the
/// rewards each earns, written to the ledger in the same transaction as the work itself.
/// </summary>
public sealed class KampusLearnerService
{
    private const int BadgeTarget = 3;

    private readonly KampusDbContext _db;
    private readonly KampusCatalog _catalog;
    private readonly KampusClock _clock;
    private readonly IKampusDirectory _directory;
    private readonly KampusCupService _cup;

    public KampusLearnerService(KampusDbContext db, KampusCatalog catalog, KampusClock clock, IKampusDirectory directory, KampusCupService cup)
    {
        _db = db;
        _catalog = catalog;
        _clock = clock;
        _directory = directory;
        _cup = cup;
    }

    private CatalogKpRules Kp => _catalog.Data.KpRules;

    // ---- Patika durakları ----

    public async Task<ContentResult<StopResultDto>> SaveStopAsync(
        Caller caller, string topicId, string stopId, Dictionary<string, JsonElement>? answers, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<StopResultDto>("Durakları yalnızca öğrenciler tamamlar.");
        }

        var topic = _catalog.Topic(topicId);
        if (topic is null)
        {
            return ContentResult.NotFound<StopResultDto>("Konu bulunamadı.");
        }

        if (stopId == "minitest")
        {
            return ContentResult.Invalid<StopResultDto>("Mini test, testin kendisi bitince tamamlanır.");
        }

        var isSheet = stopId == "calisma" && !topic.Meeting;
        if (!topic.Stops.Contains(stopId) && !isSheet)
        {
            return ContentResult.Invalid<StopResultDto>("Bu konuda böyle bir durak yok.");
        }

        var classrooms = await _directory.GetOwnClassroomIdsAsync(caller, cancellationToken);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var session = await KampusRewardSession.BeginAsync(_db, _clock, _catalog, caller.UserId, cancellationToken);
        var result = await CompleteStopAsync(session, topicId, topic, stopId, answers ?? new(), classrooms, cancellationToken);
        var daily = await CheckDailyAsync(session, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return ContentResult.Ok(result with { Daily = daily.Daily, Bonus = daily.Bonus });
    }

    public async Task<ContentResult<bool>> StartStopAsync(Caller caller, string topicId, string stopId, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<bool>("Yalnızca öğrenciler.");
        }

        var topic = _catalog.Topic(topicId);
        if (topic is null || !topic.Stops.Contains(stopId))
        {
            return ContentResult.NotFound<bool>("Durak bulunamadı.");
        }

        if (await _db.StopCompletions.AnyAsync(c => c.StudentId == caller.UserId && c.TopicId == topicId && c.StopId == stopId, cancellationToken))
        {
            return ContentResult.Ok(false);
        }

        var now = _clock.UtcNow;
        var row = await _db.InProgress.FirstOrDefaultAsync(p => p.StudentId == caller.UserId, cancellationToken);
        var added = row is null;
        if (row is null)
        {
            row = new KampusInProgress { StudentId = caller.UserId };
            _db.InProgress.Add(row);
        }

        row.TopicId = topicId;
        row.StopId = stopId;
        row.At = now;
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException) when (added)
        {
            // Aynı anda gelen başka bir istek satırı önce ekledi (ör. sayfanın iki kez açılması): onu güncelle.
            _db.Entry(row).State = EntityState.Detached;
            await _db.InProgress.Where(p => p.StudentId == caller.UserId).ExecuteUpdateAsync(s => s
                .SetProperty(p => p.TopicId, topicId)
                .SetProperty(p => p.StopId, stopId)
                .SetProperty(p => p.At, now), cancellationToken);
        }

        return ContentResult.Ok(true);
    }

    // ---- Mini test ----

    public async Task<ContentResult<MiniTestDto?>> GetMiniTestAsync(Caller caller, string topicId, CancellationToken cancellationToken = default)
    {
        if (_catalog.Topic(topicId) is null)
        {
            return ContentResult.NotFound<MiniTestDto?>("Konu bulunamadı.");
        }

        var state = await _db.MiniTests.AsNoTracking().FirstOrDefaultAsync(m => m.StudentId == caller.UserId && m.TopicId == topicId, cancellationToken);
        return ContentResult.Ok(state is null ? null : ToDto(state));
    }

    /// <summary>
    /// Opens a new attempt from questions not shown before; once the pool runs out a new round starts (the
    /// previous set still left out). The server picks the questions, so a set cannot be hand-chosen.
    /// </summary>
    public async Task<ContentResult<MiniTestDto>> NewMiniTestAsync(Caller caller, string topicId, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<MiniTestDto>("Yalnızca öğrenciler.");
        }

        var topic = _catalog.Topic(topicId);
        if (topic is null || !topic.Stops.Contains("minitest") || topic.TestPool.Count == 0)
        {
            return ContentResult.NotFound<MiniTestDto>("Bu konuda mini test yok.");
        }

        var pool = topic.TestPool.Select(q => q.Id).ToList();
        var n = Math.Min(_catalog.Data.MinitestSize, pool.Count);
        var old = await _db.MiniTests.FirstOrDefaultAsync(m => m.StudentId == caller.UserId && m.TopicId == topicId, cancellationToken);
        var prev = old?.Set ?? [];
        var shown = old is null ? new List<string>() : old.Shown.Concat(prev).Distinct().ToList();

        var fresh = pool.Where(id => !shown.Contains(id)).ToList();
        if (fresh.Count < n)
        {
            shown = [.. prev];
            fresh = pool.Where(id => !prev.Contains(id)).ToList();
        }

        var set = Shuffle(fresh).Take(n).ToList();
        if (set.Count < n)
        {
            set.AddRange(Shuffle(prev).Take(n - set.Count));
        }

        if (old is null)
        {
            old = new KampusMiniTest { StudentId = caller.UserId, TopicId = topicId };
            _db.MiniTests.Add(old);
        }

        old.Attempt += 1;
        old.Set = set;
        old.Idx = 0;
        old.Answers = new();
        old.Done = false;
        old.Prev = [.. prev];
        old.Shown = shown;
        old.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(ToDto(old));
    }

    /// <summary>Records one answer of the open attempt, graded here. An answered question cannot be changed.</summary>
    public async Task<ContentResult<AnswerResultDto>> AnswerMiniTestAsync(
        Caller caller, string topicId, string questionId, JsonElement? given, CancellationToken cancellationToken = default)
    {
        var topic = _catalog.Topic(topicId);
        var state = await _db.MiniTests.FirstOrDefaultAsync(m => m.StudentId == caller.UserId && m.TopicId == topicId, cancellationToken);
        if (topic is null || state is null)
        {
            return ContentResult.NotFound<AnswerResultDto>("Açık bir mini test yok.");
        }

        if (state.Done || !state.Set.Contains(questionId))
        {
            return ContentResult.Invalid<AnswerResultDto>("Bu soru açık denemede değil.");
        }

        if (state.Answers.TryGetValue(questionId, out var previous))
        {
            return ContentResult.Ok(new AnswerResultDto(previous.Ok, ToDto(state)));
        }

        var question = topic.TestPool.First(q => q.Id == questionId);
        var ok = KampusGrader.IsRight(question, given);
        state.Answers = new Dictionary<string, MiniTestAnswer>(state.Answers) { [questionId] = new MiniTestAnswer(given, ok) };
        state.Idx = state.Answers.Count;
        if (state.Idx >= state.Set.Count)
        {
            state.Done = true;
            state.Best = Math.Max(state.Best, state.Answers.Values.Count(a => a.Ok));
        }

        state.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(new AnswerResultDto(ok, ToDto(state)));
    }

    /// <summary>
    /// Finishes the Mini Test stop for a completed attempt: marks the stop, then rewards the set once
    /// (KP per new set, ⭐ per correct answer — each question once ever, within the daily limit).
    /// </summary>
    public async Task<ContentResult<StopResultDto>> CompleteMiniTestAsync(
        Caller caller, string topicId, Dictionary<string, JsonElement>? answers, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<StopResultDto>("Yalnızca öğrenciler.");
        }

        var topic = _catalog.Topic(topicId);
        if (topic is null)
        {
            return ContentResult.NotFound<StopResultDto>("Konu bulunamadı.");
        }

        var classrooms = await _directory.GetOwnClassroomIdsAsync(caller, cancellationToken);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var session = await KampusRewardSession.BeginAsync(_db, _clock, _catalog, caller.UserId, cancellationToken);
        var state = await _db.MiniTests.AsNoTracking().FirstOrDefaultAsync(m => m.StudentId == caller.UserId && m.TopicId == topicId, cancellationToken);
        if (state is null || !state.Done)
        {
            return ContentResult.Invalid<StopResultDto>("Önce mini testin bütün sorularını cevapla.");
        }

        var stop = await CompleteStopAsync(session, topicId, topic, "minitest", answers ?? new(), classrooms, cancellationToken);
        var gain = await session.AwardAsync("minitest", $"{topicId}#{state.Attempt}", Kp.Minitest, 0, cancellationToken);
        var okIds = state.Answers.Where(a => a.Value.Ok).Select(a => a.Key).ToList();
        var (stars, repeat, capped) = await StarForCorrectAsync(session, topicId, okIds, cancellationToken);
        var daily = await CheckDailyAsync(session, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var total = new KampusGain(stop.Kp, stop.Cup) + gain + stars + daily;
        return ContentResult.Ok(stop with { Kp = total.Kp, Cup = total.Cup, Daily = total.Daily, Bonus = total.Bonus, Repeat = repeat, Capped = capped });
    }

    // ---- Konu oynatıcısı (ödev ve örnek ders) ----

    public async Task<ContentResult<AttemptDto>> SaveAttemptAsync(Caller caller, SaveAttemptRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<AttemptDto>("Yalnızca öğrenciler.");
        }

        var topic = _catalog.Topic(request.TopicId);
        if (topic is null)
        {
            return ContentResult.NotFound<AttemptDto>("Konu bulunamadı.");
        }

        var classrooms = await _directory.GetOwnClassroomIdsAsync(caller, cancellationToken);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var session = await KampusRewardSession.BeginAsync(_db, _clock, _catalog, caller.UserId, cancellationToken);
        var attempt = await AddAttemptAsync(caller.UserId, request.TopicId, topic, Known(topic, request.Answers), viaStops: false, classrooms, cancellationToken);
        var daily = await CheckDailyAsync(session, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return ContentResult.Ok(new AttemptDto(attempt.Id, attempt.TopicId, attempt.AssignmentId, attempt.CompletedAt, false, daily.Daily, daily.Bonus));
    }

    // ---- E-Kütüphane ----

    public async Task<IReadOnlyList<BookStateDto>> BooksAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var states = await _db.Books.AsNoTracking().Where(b => b.StudentId == studentId).ToListAsync(cancellationToken);
        var kp = await BookKpAsync(studentId, cancellationToken);
        return _catalog.Data.Books
            .Select(b => ToDto(b.Id, states.FirstOrDefault(s => s.BookId == b.Id), kp.GetValueOrDefault(b.Id)))
            .ToList();
    }

    public async Task<ContentResult<GainDto>> FinishBookAsync(Caller caller, string bookId, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<GainDto>("Yalnızca öğrenciler.");
        }

        if (_catalog.Book(bookId) is null)
        {
            return ContentResult.NotFound<GainDto>("Kitap bulunamadı.");
        }

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var session = await KampusRewardSession.BeginAsync(_db, _clock, _catalog, caller.UserId, cancellationToken);
        var state = await BookStateAsync(caller.UserId, bookId, cancellationToken);
        state.FinishedAt ??= _clock.UtcNow;
        AddActivity(caller.UserId, "kitap-bitir", bookId);
        var gain = await session.AwardAsync("kitap", bookId, Kp.KitapBitir, 0, cancellationToken);
        gain += await CheckDailyAsync(session, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return ContentResult.Ok(ToDto(gain));
    }

    /// <summary>
    /// Grades a comprehension answer here. The first right answer earns KP and a ⭐; a wrong one leaves the
    /// question open to come back to.
    /// </summary>
    public async Task<ContentResult<BookAnswerResultDto>> AnswerBookAsync(
        Caller caller, string bookId, string questionId, string? given, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<BookAnswerResultDto>("Yalnızca öğrenciler.");
        }

        var book = _catalog.Book(bookId);
        var question = book?.Questions.FirstOrDefault(q => q.Id == questionId);
        if (book is null || question is null)
        {
            return ContentResult.NotFound<BookAnswerResultDto>("Soru bulunamadı.");
        }

        var ok = given == question.Answer;
        var now = _clock.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var session = await KampusRewardSession.BeginAsync(_db, _clock, _catalog, caller.UserId, cancellationToken);
        var state = await BookStateAsync(caller.UserId, bookId, cancellationToken);
        var previousOk = state.Answers.TryGetValue(questionId, out var prev) && prev.Ok;
        state.Answers = new Dictionary<string, BookAnswer>(state.Answers) { [questionId] = new BookAnswer(previousOk || ok, now) };

        var gain = ok ? await session.AwardAsync("kitap-soru", $"{bookId}:{questionId}", Kp.KitapSoru, 1, cancellationToken) : KampusGain.None;

        var week = _clock.ThisWeek;
        if (book.Questions.All(q => state.Answers.TryGetValue(q.Id, out var a) && a.Ok) && state.CompletedAt is null)
        {
            state.CompletedAt = now;
            AddActivity(caller.UserId, "kitap-tamam", bookId);
        }
        else if (book.Questions.All(q => state.Answers.ContainsKey(q.Id))
                 && !await _db.Activities.AnyAsync(a => a.StudentId == caller.UserId && a.Kind == "kitap-tamam" && a.Ref == bookId && a.Week == week, cancellationToken)
                 && !_db.ChangeTracker.Entries<KampusActivity>().Any(e => e.State == EntityState.Added && e.Entity.Kind == "kitap-tamam" && e.Entity.Ref == bookId))
        {
            AddActivity(caller.UserId, "kitap-tamam", bookId);
        }

        gain += await CheckDailyAsync(session, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var kp = (await BookKpAsync(caller.UserId, cancellationToken)).GetValueOrDefault(bookId);
        return ContentResult.Ok(new BookAnswerResultDto(ok, ToDto(gain), ToDto(bookId, state, kp)));
    }

    // ---- Oyunlar ----

    /// <summary>
    /// Records a finished round. The first round of a game each day earns KP and a ⭐ per right answer;
    /// the score is the client's and is clamped to the game's number of rounds.
    /// </summary>
    public async Task<ContentResult<GainDto>> FinishGameAsync(Caller caller, string gameId, int score, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<GainDto>("Yalnızca öğrenciler.");
        }

        var game = _catalog.Game(gameId);
        if (game is null)
        {
            return ContentResult.NotFound<GainDto>("Oyun bulunamadı.");
        }

        score = Math.Clamp(score, 0, game.Rounds);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var session = await KampusRewardSession.BeginAsync(_db, _clock, _catalog, caller.UserId, cancellationToken);
        AddActivity(caller.UserId, "oyun", gameId, score: score);
        var gain = await session.AwardAsync("oyun", $"{gameId}:{DayKey(_clock.Today)}", Kp.Oyun, score, cancellationToken);
        gain += await CheckDailyAsync(session, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return ContentResult.Ok(ToDto(gain));
    }

    // ---- Okuma uçları ----

    public async Task<OverviewDto> OverviewAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var wallet = await _db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.StudentId == studentId, cancellationToken);
        var today = _clock.Today;
        var stars = await _db.Rewards.Where(r => r.StudentId == studentId && r.Day == today).SumAsync(r => r.Star, cancellationToken);
        var level = await _db.Collection.CountAsync(c => c.StudentId == studentId, cancellationToken);
        return new OverviewDto(wallet?.KpBalance ?? 0, level, wallet?.PendingLevelUp ?? 0, stars, _catalog.Data.StarDailyMax,
            await DailyQuestAsync(studentId, cancellationToken), await InProgressAsync(studentId, cancellationToken));
    }

    public async Task<ProgressDto> ProgressAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var stops = await _db.StopCompletions.AsNoTracking().Where(c => c.StudentId == studentId)
            .OrderBy(c => c.CompletedAt).ToListAsync(cancellationToken);
        var collection = await _db.Collection.AsNoTracking().Where(c => c.StudentId == studentId)
            .OrderBy(c => c.At).Select(c => new CollectionEntryDto(c.TopicId, c.At)).ToListAsync(cancellationToken);
        var completed = await _db.TopicAttempts.Where(a => a.StudentId == studentId).Select(a => a.TopicId).Distinct().ToListAsync(cancellationToken);
        var best = await _db.MiniTests.Where(m => m.StudentId == studentId).ToDictionaryAsync(m => m.TopicId, m => m.Best, cancellationToken);
        var kp = await _db.Wallets.Where(w => w.StudentId == studentId).Select(w => w.KpBalance).FirstOrDefaultAsync(cancellationToken);

        return new ProgressDto(
            stops.GroupBy(s => s.TopicId).ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(s => s.StopId).ToList()),
            collection, collection.Count, completed, best, kp);
    }

    public async Task<DailyQuestDto> DailyQuestAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var done = await DailyDoneAsync(studentId, cancellationToken);
        return new DailyQuestDto("İki etkinlik tamamla", Math.Min(done, 2), 2, Kp.Gunluk);
    }

    public async Task<InProgressDto?> InProgressAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var row = await _db.InProgress.AsNoTracking().FirstOrDefaultAsync(p => p.StudentId == studentId, cancellationToken);
        if (row is null || _catalog.Topic(row.TopicId) is not { } topic || !topic.Stops.Contains(row.StopId))
        {
            return null;
        }

        var done = await _db.StopCompletions.AnyAsync(c => c.StudentId == studentId && c.TopicId == row.TopicId && c.StopId == row.StopId, cancellationToken);
        return done ? null : new InProgressDto(row.TopicId, row.StopId, row.At);
    }

    /// <summary>How many ⭐ this stop could still bring today, shown on the satellite card.</summary>
    public async Task<ContentResult<StarPreviewDto>> StarPreviewAsync(Guid studentId, string topicId, string stopId, CancellationToken cancellationToken = default)
    {
        var today = _clock.Today;
        var used = await _db.Rewards.Where(r => r.StudentId == studentId && r.Day == today).SumAsync(r => r.Star, cancellationToken);
        var left = Math.Max(0, _catalog.Data.StarDailyMax - used);
        var topic = _catalog.Topic(topicId);
        if (topic is null || stopId is not ("alistirma" or "minitest"))
        {
            return ContentResult.Ok(new StarPreviewDto(0, 0, left, "none"));
        }

        var prefix = topicId + ":";
        var starred = (await _db.Rewards
                .Where(r => r.StudentId == studentId && r.Kind == "yildiz" && r.Ref.StartsWith(prefix))
                .Select(r => r.Ref)
                .ToListAsync(cancellationToken))
            .Select(r => r[prefix.Length..])
            .ToHashSet();
        var open = stopId == "alistirma"
            ? topic.Exercises.Count(q => !starred.Contains(q.Id))
            : Math.Min(_catalog.Data.MinitestSize, topic.TestPool.Count(q => !starred.Contains(q.Id)));
        return ContentResult.Ok(new StarPreviewDto(Math.Min(open, left), open, left, stopId));
    }

    /// <summary>A course badge: one step per topic whose four stops are done; won at 3.</summary>
    public async Task<BadgeDto> BadgeAsync(Guid studentId, string courseId, CancellationToken cancellationToken = default)
    {
        var topics = _catalog.Data.Topics.Where(t => t.Value.Course == courseId && t.Value.Stops.Count > 0).ToList();
        var ids = topics.Select(t => t.Key).ToList();
        var done = await _db.StopCompletions.AsNoTracking()
            .Where(c => c.StudentId == studentId && ids.Contains(c.TopicId))
            .Select(c => new { c.TopicId, c.StopId })
            .ToListAsync(cancellationToken);
        var n = topics.Count(t => t.Value.Stops.All(s => done.Any(d => d.TopicId == t.Key && d.StopId == s)));
        return new BadgeDto(courseId, Math.Min(n, BadgeTarget), BadgeTarget, n >= BadgeTarget);
    }

    /// <summary>The level-up message is shown once: returns the pending level and clears it.</summary>
    public async Task<LevelUpDto> TakeLevelUpAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var wallet = await KampusRewardSession.LockWalletAsync(_db, _clock, caller.UserId, cancellationToken);
        var level = wallet.PendingLevelUp;
        wallet.PendingLevelUp = 0;
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return new LevelUpDto(level);
    }

    // ---- Ortak adımlar ----

    private async Task<StopResultDto> CompleteStopAsync(
        KampusRewardSession session, string topicId, CatalogTopic topic, string stopId, Dictionary<string, JsonElement> answers,
        IReadOnlyCollection<Guid> classrooms, CancellationToken cancellationToken)
    {
        var sid = session.Wallet.StudentId;
        var now = _clock.UtcNow;

        var first = !await _db.StopCompletions.AnyAsync(c => c.StudentId == sid && c.TopicId == topicId && c.StopId == stopId, cancellationToken);
        if (first)
        {
            _db.StopCompletions.Add(new KampusStopCompletion { StudentId = sid, TopicId = topicId, StopId = stopId, CompletedAt = now });
        }

        var known = Known(topic, answers);
        var merged = await _db.TopicAnswers.FirstOrDefaultAsync(a => a.StudentId == sid && a.TopicId == topicId, cancellationToken);
        if (merged is null)
        {
            merged = new KampusTopicAnswers { StudentId = sid, TopicId = topicId };
            _db.TopicAnswers.Add(merged);
        }

        merged.Answers = merged.Answers.Concat(known).GroupBy(kv => kv.Key).ToDictionary(g => g.Key, g => g.Last().Value);

        AddActivity(sid, "durak", topicId, stopId);
        await _db.InProgress.Where(p => p.StudentId == sid && p.TopicId == topicId && p.StopId == stopId).ExecuteDeleteAsync(cancellationToken);

        // Anlatım, alıştırma and özet reward the first completion only; mini test sets are rewarded separately.
        var gain = stopId == "minitest" || !first
            ? KampusGain.None
            : await session.AwardAsync("durak", $"{topicId}:{stopId}", _catalog.StopKp(stopId), 0, cancellationToken);

        int? repeat = null;
        bool? capped = null;
        if (stopId == "alistirma")
        {
            // A star for every exercise right at the first try. The try count is reported by the client;
            // the server only accepts ids of this topic's exercises.
            var exerciseIds = topic.Exercises.Select(q => q.Id).ToHashSet();
            var okIds = known.Where(kv => exerciseIds.Contains(kv.Key) && WrongCount(kv.Value) == 0).Select(kv => kv.Key).ToList();
            var (stars, r, c) = await StarForCorrectAsync(session, topicId, okIds, cancellationToken);
            gain += stars;
            repeat = r;
            capped = c;
        }

        await _db.SaveChangesAsync(cancellationToken);

        var levelBefore = await _db.Collection.CountAsync(c => c.StudentId == sid, cancellationToken);
        var done = await _db.StopCompletions.Where(c => c.StudentId == sid && c.TopicId == topicId).Select(c => c.StopId).ToListAsync(cancellationToken);
        var allDone = topic.Stops.Count > 0 && topic.Stops.All(done.Contains);

        // Konu Koleksiyonu: the four satellites done for the first time add the planet and a campus level.
        var levelAfter = levelBefore;
        if (allDone && !await _db.Collection.AnyAsync(c => c.StudentId == sid && c.TopicId == topicId, cancellationToken))
        {
            _db.Collection.Add(new KampusCollectionEntry { StudentId = sid, TopicId = topicId, At = now });
            levelAfter = levelBefore + 1;
            session.Wallet.PendingLevelUp = levelAfter;
        }

        // Teacher and parent reports read a topic record, written once when the path is finished.
        if (allDone && first)
        {
            await AddAttemptAsync(sid, topicId, topic, merged.Answers, viaStops: true, classrooms, cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return new StopResultDto(first, allDone, gain.Kp, gain.Cup, 0, 0, repeat, capped, levelAfter > levelBefore ? levelAfter : 0);
    }

    /// <summary>One ⭐ per right answer; a question earns its star once ever (a capped one may earn it another day).</summary>
    private static async Task<(KampusGain Gain, int Repeat, bool Capped)> StarForCorrectAsync(
        KampusRewardSession session, string topicId, List<string> okIds, CancellationToken cancellationToken)
    {
        var gain = KampusGain.None;
        foreach (var id in okIds)
        {
            gain += await session.AwardAsync("yildiz", $"{topicId}:{id}", 0, 1, cancellationToken);
        }

        return (gain, okIds.Count - gain.Cup, session.StarsLeftToday == 0);
    }

    /// <summary>The daily quest (+KP once a day after two activities) and the weekly bonus task (+KP once a week).</summary>
    private async Task<KampusGain> CheckDailyAsync(KampusRewardSession session, CancellationToken cancellationToken)
    {
        await _db.SaveChangesAsync(cancellationToken);
        var sid = session.Wallet.StudentId;

        var daily = 0;
        if (await DailyDoneAsync(sid, cancellationToken) >= 2)
        {
            daily = (await session.AwardAsync("gunluk", DayKey(_clock.Today), Kp.Gunluk, 0, cancellationToken)).Kp;
        }

        var bonus = 0;
        if ((await _cup.ProgressAsync(sid, cancellationToken)).Bonus.Done >= 1)
        {
            bonus = (await session.AwardAsync("bonus", KampusCupService.WeekKey(_clock.ThisWeek), Kp.Bonus, 0, cancellationToken)).Kp;
        }

        return new KampusGain(0, 0, daily, bonus);
    }

    private async Task<int> DailyDoneAsync(Guid studentId, CancellationToken cancellationToken)
    {
        var today = _clock.Today;
        var from = KampusClock.StartOf(today);
        var to = KampusClock.StartOf(today.AddDays(1));
        var attempts = await _db.TopicAttempts.CountAsync(a => a.StudentId == studentId && !a.ViaStops && a.CompletedAt >= from && a.CompletedAt < to, cancellationToken);
        var activities = await _db.Activities.CountAsync(a => a.StudentId == studentId && a.Day == today, cancellationToken);
        return attempts + activities;
    }

    private async Task<KampusTopicAttempt> AddAttemptAsync(
        Guid studentId, string topicId, CatalogTopic topic, Dictionary<string, JsonElement> answers, bool viaStops,
        IReadOnlyCollection<Guid> classrooms, CancellationToken cancellationToken)
    {
        var pending = await KampusAssignments.PendingAsync(_db, studentId, classrooms, cancellationToken);
        var attempt = new KampusTopicAttempt
        {
            Id = Guid.NewGuid(),
            StudentId = studentId,
            TopicId = topicId,
            AssignmentId = pending.FirstOrDefault(a => a.TopicId == topicId)?.Id,
            CompletedAt = _clock.UtcNow,
            Answers = new Dictionary<string, JsonElement>(answers),
            ViaStops = viaStops
        };
        _db.TopicAttempts.Add(attempt);
        await _db.SaveChangesAsync(cancellationToken);
        return attempt;
    }

    private void AddActivity(Guid studentId, string kind, string reference, string? stopId = null, int? score = null)
    {
        var now = _clock.UtcNow;
        _db.Activities.Add(new KampusActivity
        {
            StudentId = studentId,
            Kind = kind,
            Ref = reference,
            StopId = stopId,
            Score = score,
            At = now,
            Day = KampusClock.DayOf(now),
            Week = KampusClock.WeekOf(now)
        });
    }

    private async Task<KampusBookState> BookStateAsync(Guid studentId, string bookId, CancellationToken cancellationToken)
    {
        var state = await _db.Books.FirstOrDefaultAsync(b => b.StudentId == studentId && b.BookId == bookId, cancellationToken);
        if (state is null)
        {
            state = new KampusBookState { StudentId = studentId, BookId = bookId };
            _db.Books.Add(state);
        }

        return state;
    }

    private async Task<Dictionary<string, int>> BookKpAsync(Guid studentId, CancellationToken cancellationToken)
    {
        var rows = await _db.Rewards
            .Where(r => r.StudentId == studentId && (r.Kind == "kitap" || r.Kind == "kitap-soru"))
            .Select(r => new { r.Kind, r.Ref, r.Kp })
            .ToListAsync(cancellationToken);
        return rows
            .GroupBy(r => r.Kind == "kitap" ? r.Ref : r.Ref.Split(':')[0])
            .ToDictionary(g => g.Key, g => g.Sum(r => r.Kp));
    }

    /// <summary>Keeps only answers to this topic's own questions, so the stored record cannot be padded.</summary>
    private static Dictionary<string, JsonElement> Known(CatalogTopic topic, Dictionary<string, JsonElement>? answers)
    {
        if (answers is null || answers.Count == 0)
        {
            return new();
        }

        var ids = topic.Exercises.Concat(topic.TestPool).Concat(topic.Practice).Concat(topic.Check).Select(q => q.Id).ToHashSet();
        return answers.Where(kv => ids.Contains(kv.Key) && kv.Value.ValueKind == JsonValueKind.Object)
            .ToDictionary(kv => kv.Key, kv => kv.Value.Clone());
    }

    internal static int WrongCount(JsonElement answer) =>
        answer.ValueKind == JsonValueKind.Object && answer.TryGetProperty("wrong", out var w) && w.TryGetInt32(out var n) ? n : int.MaxValue;

    private static string DayKey(DateOnly day) => day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static List<string> Shuffle(IEnumerable<string> items)
    {
        var list = items.ToList();
        Random.Shared.Shuffle(System.Runtime.InteropServices.CollectionsMarshal.AsSpan(list));
        return list;
    }

    private static MiniTestDto ToDto(KampusMiniTest m) => new(
        m.TopicId, m.Attempt, m.Set, m.Idx,
        m.Answers.ToDictionary(kv => kv.Key, kv => new MiniTestAnswerDto(kv.Value.Given, kv.Value.Ok)),
        m.Done, m.Prev, m.Best);

    private static BookStateDto ToDto(string bookId, KampusBookState? s, int kp) => new(
        bookId, s?.FinishedAt is not null, s?.FinishedAt, s?.CompletedAt,
        (s?.Answers ?? new()).ToDictionary(kv => kv.Key, kv => new BookAnswerDto(kv.Value.Ok, kv.Value.At)), kp);

    private static GainDto ToDto(KampusGain g) => new(g.Kp, g.Cup, g.Daily, g.Bonus);
}
