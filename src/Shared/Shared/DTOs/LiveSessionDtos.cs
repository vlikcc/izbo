namespace Shared.DTOs;

// Live Session DTOs
public record LiveSessionDto(
    Guid Id,
    Guid ClassSessionId,
    string ClassroomName,
    string Title,
    string HostName,
    string MeetingUrl,
    int ParticipantCount,
    string Status,
    DateTime StartedAt);

public record CreateLiveSessionRequest(Guid ClassSessionId);
public record JoinLiveSessionRequest(Guid SessionId);

public record ParticipantDto(
    Guid UserId,
    string Name,
    string Role,
    bool IsMuted,
    bool IsVideoOn,
    bool IsHandRaised,
    DateTime JoinedAt);

// WebRTC Signaling
public record SignalMessage(string Type, string SdpOrCandidate, Guid FromUserId, Guid? ToUserId);
