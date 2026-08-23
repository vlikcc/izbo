using System.Collections.Concurrent;

namespace LiveSessionService.Hubs;

/// <summary>
/// Which connections are in which live session, and which of them joined as the classroom's instructor.
///
/// Group membership is the hub's record that a connection passed the classroom access check, so this is
/// consulted on every session-scoped call rather than trusting the session id in the message.
/// </summary>
public interface ISessionRegistry
{
    void Add(string sessionId, string connectionId, Guid userId, bool isModerator);

    void Remove(string sessionId, string connectionId);

    /// <summary>Drops a connection from every session and returns the sessions it was in.</summary>
    IReadOnlyCollection<string> RemoveConnection(string connectionId);

    bool Contains(string sessionId, string connectionId);

    bool IsModerator(string sessionId, string connectionId);

    int CountFor(string sessionId);

    IReadOnlyCollection<string> ConnectionsOf(string sessionId, Guid userId);
}

/// <summary>
/// Per-instance registry. A connection is always served by the instance that accepted it, so the
/// membership checks it backs are accurate; only the participant count is instance-local, and it
/// becomes approximate if the service is scaled out before this is moved behind the Redis backplane.
/// </summary>
public sealed class InMemorySessionRegistry : ISessionRegistry
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, Participant>> _sessions = new(StringComparer.Ordinal);

    public void Add(string sessionId, string connectionId, Guid userId, bool isModerator) =>
        _sessions
            .GetOrAdd(sessionId, _ => new ConcurrentDictionary<string, Participant>(StringComparer.Ordinal))
            [connectionId] = new Participant(userId, isModerator);

    public void Remove(string sessionId, string connectionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var participants))
        {
            return;
        }

        participants.TryRemove(connectionId, out _);

        // Keep the dictionary from growing without bound as sessions end.
        if (participants.IsEmpty)
        {
            _sessions.TryRemove(sessionId, out _);
        }
    }

    public IReadOnlyCollection<string> RemoveConnection(string connectionId)
    {
        var removedFrom = new List<string>();

        foreach (var (sessionId, participants) in _sessions)
        {
            if (participants.TryRemove(connectionId, out _))
            {
                removedFrom.Add(sessionId);

                if (participants.IsEmpty)
                {
                    _sessions.TryRemove(sessionId, out _);
                }
            }
        }

        return removedFrom;
    }

    public bool Contains(string sessionId, string connectionId) =>
        _sessions.TryGetValue(sessionId, out var participants) && participants.ContainsKey(connectionId);

    public bool IsModerator(string sessionId, string connectionId) =>
        _sessions.TryGetValue(sessionId, out var participants) &&
        participants.TryGetValue(connectionId, out var participant) &&
        participant.IsModerator;

    public int CountFor(string sessionId) =>
        _sessions.TryGetValue(sessionId, out var participants) ? participants.Count : 0;

    public IReadOnlyCollection<string> ConnectionsOf(string sessionId, Guid userId)
    {
        if (!_sessions.TryGetValue(sessionId, out var participants))
        {
            return [];
        }

        return participants
            .Where(entry => entry.Value.UserId == userId)
            .Select(entry => entry.Key)
            .ToList();
    }

    private readonly record struct Participant(Guid UserId, bool IsModerator);
}
