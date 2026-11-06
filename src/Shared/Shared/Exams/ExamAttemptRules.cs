using System.Buffers.Binary;

namespace Shared.Exams;

/// <summary>
/// Rules for a single student's attempt at an exam: when it stops accepting answers and how its
/// questions and options are ordered.
/// </summary>
public static class ExamAttemptRules
{
    /// <summary>Allowance for network latency and the client's auto-submit after the timer reaches zero.</summary>
    public static readonly TimeSpan SubmissionGrace = TimeSpan.FromSeconds(30);

    /// <summary>
    /// When the attempt's time is up: the student's own duration, cut short by the exam window closing.
    /// </summary>
    public static DateTime Deadline(DateTime startedAt, int durationMinutes, DateTime examEndTime)
    {
        var durationEnd = startedAt.AddMinutes(durationMinutes);
        return durationEnd < examEndTime ? durationEnd : examEndTime;
    }

    /// <summary>True while answers may still be recorded: up to the deadline plus <see cref="SubmissionGrace"/>.</summary>
    public static bool AcceptsAnswersAt(DateTime now, DateTime startedAt, int durationMinutes, DateTime examEndTime) =>
        now <= Deadline(startedAt, durationMinutes, examEndTime) + SubmissionGrace;

    /// <summary>
    /// Shuffles <paramref name="items"/> in an order fixed by the session (and, for per-question option
    /// lists, the question), so a resumed attempt sees the same order it started with.
    /// </summary>
    /// <remarks>
    /// The seeded <see cref="Random"/> sequence is stable across .NET versions. This is about
    /// presentation order only, not security, so a non-cryptographic generator is fine.
    /// </remarks>
    public static List<T> Shuffle<T>(IEnumerable<T> items, Guid sessionId, Guid scopeId = default)
    {
        ArgumentNullException.ThrowIfNull(items);

        var result = items.ToList();
#pragma warning disable CA5394 // Deterministic presentation order, not a security decision.
        var random = new Random(Seed(sessionId, scopeId));
        for (var i = result.Count - 1; i > 0; i--)
        {
            var j = random.Next(i + 1);
            (result[i], result[j]) = (result[j], result[i]);
        }
#pragma warning restore CA5394

        return result;
    }

    private static int Seed(Guid sessionId, Guid scopeId)
    {
        Span<byte> session = stackalloc byte[16];
        Span<byte> scope = stackalloc byte[16];
        sessionId.TryWriteBytes(session);
        scopeId.TryWriteBytes(scope);

        // Fold both ids into 32 bits. Not HashCode.Combine: that is randomised per process.
        var seed = 17;
        for (var offset = 0; offset < 16; offset += 4)
        {
            seed = unchecked(seed * 31 + BinaryPrimitives.ReadInt32LittleEndian(session[offset..]));
            seed = unchecked(seed * 31 + BinaryPrimitives.ReadInt32LittleEndian(scope[offset..]));
        }

        return seed;
    }
}
