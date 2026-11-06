using Shared.Models;

namespace ContentService.Services.Assessments;

public sealed record Score(int Correct, int Wrong, int Blank, decimal Net, decimal Percent);

/// <summary>Turns right/wrong/blank counts into a net and a percentage under a <see cref="ScoringRule"/>.</summary>
public static class ScoringCalculator
{
    public static Score Compute(ScoringRule rule, int correct, int wrong, int blank)
    {
        var total = correct + wrong + blank;
        var penalty = rule switch
        {
            ScoringRule.NetThird => wrong / 3m,
            ScoringRule.NetQuarter => wrong / 4m,
            _ => 0m
        };

        var net = Math.Round(correct - penalty, 2, MidpointRounding.AwayFromZero);
        var percent = total == 0 ? 0m : Math.Round(Math.Max(0m, net) * 100m / total, 2, MidpointRounding.AwayFromZero);
        return new Score(correct, wrong, blank, net, percent);
    }

    /// <summary>LGS levels lose a third per wrong answer, YKS levels a quarter; school years nothing.</summary>
    public static ScoringRule DefaultFor(Level level)
    {
        ArgumentNullException.ThrowIfNull(level);

        if (level.Slug == "lgs")
        {
            return ScoringRule.NetThird;
        }

        return level.Slug.StartsWith("yks", StringComparison.Ordinal) ? ScoringRule.NetQuarter : ScoringRule.Plain;
    }

    public static decimal PercentOf(int correct, int total) =>
        total == 0 ? 0m : Math.Round(correct * 100m / total, 2, MidpointRounding.AwayFromZero);
}

public sealed record Placement(int Rank, int ParticipantCount, decimal TopPercent);

public static class RankingCalculator
{
    /// <summary>
    /// Ranks by net, highest first. Equal nets share a rank (1, 2, 2, 4). TopPercent is the share of
    /// participants who scored at least as well, so the leader of 200 is in the top 0.5%.
    /// </summary>
    public static Dictionary<Guid, Placement> Rank(IReadOnlyCollection<(Guid Id, decimal Net)> results)
    {
        ArgumentNullException.ThrowIfNull(results);

        var count = results.Count;
        var nets = results.Select(r => r.Net).OrderByDescending(n => n).ToArray();
        var placements = new Dictionary<Guid, Placement>(count);

        foreach (var (id, net) in results)
        {
            var above = nets.Count(n => n > net);
            var atLeast = nets.Count(n => n >= net);
            placements[id] = new Placement(
                above + 1,
                count,
                Math.Round(atLeast * 100m / count, 2, MidpointRounding.AwayFromZero));
        }

        return placements;
    }
}

public static class PracticeSelector
{
    /// <summary>
    /// Picks <paramref name="count"/> questions, preferring ones the student has not met yet and drawing at
    /// random within each group, then orders the pick from easy to hard.
    /// </summary>
    public static List<Guid> Select(
        IReadOnlyCollection<(Guid Id, QuestionDifficulty Difficulty)> candidates,
        IReadOnlySet<Guid> seen,
        int count,
        Random random)
    {
        ArgumentNullException.ThrowIfNull(candidates);
        ArgumentNullException.ThrowIfNull(seen);
        ArgumentNullException.ThrowIfNull(random);

        var unseen = candidates.Where(c => !seen.Contains(c.Id)).ToArray();
        var repeat = candidates.Where(c => seen.Contains(c.Id)).ToArray();
        random.Shuffle(unseen);
        random.Shuffle(repeat);

        return unseen.Concat(repeat)
            .Take(count)
            .OrderBy(c => c.Difficulty)
            .Select(c => c.Id)
            .ToList();
    }
}
