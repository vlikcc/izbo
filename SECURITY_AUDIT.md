# Security Audit Report: EduPlatform

**Date:** October 26, 2023
**Auditor:** Jules (AI Software Engineer)

## Executive Summary

A comprehensive security analysis of the EduPlatform codebase reveals several critical security vulnerabilities that pose significant risks to the confidentiality, integrity, and availability of the system. The most severe issues include hardcoded credentials, widespread Insecure Direct Object References (IDOR), and unrestricted file uploads. Immediate remediation is recommended before any production deployment.

## Vulnerability Findings

### 1. Hardcoded Secrets (Critical)

*   **Description:** Sensitive credentials, including the JWT signing secret and database credentials, are hardcoded in `appsettings.json` files.
*   **Location:**
    *   `src/Services/AuthService/AuthService/appsettings.json`
    *   `src/ApiGateway/ApiGateway/appsettings.json`
*   **Impact:** Attackers who gain access to the codebase or the server can sign their own JWT tokens (admin access), impersonate users, or access the database directly.
*   **Recommendation:** Move all secrets to environment variables or a secure vault (e.g., Azure Key Vault, AWS Secrets Manager). Use the "Secret Manager" tool for local development.

### 2. Insecure Direct Object Reference (IDOR) - File Service (Critical)

*   **Description:** The `FileService` allows users to download or delete files by providing the file ID. There is no check to ensure the user owns the file or has permission to access the related entity (e.g., classroom, homework).
*   **Location:** `src/Services/FileService/FileService/Controllers/FilesController.cs` (Methods: `DownloadFile`, `DeleteFile`)
*   **Impact:** Any authenticated user can delete files belonging to others or access private materials if they can guess or obtain the file UUID.
*   **Recommendation:** Implement ownership checks. Verify that `file.UploadedBy == userId` or that the user is enrolled in the `EntityId` (classroom/course) associated with the file.

### 3. Insecure Direct Object Reference (IDOR) - Exam Service (Critical)

*   **Description:** Students can view exam sessions and results of other students by manipulating the `sessionId` in the URL. There is no validation that the session belongs to the requesting user.
*   **Location:** `src/Services/ExamService/ExamService/Services/ExamSessionService.cs` (Methods: `GetSessionAsync`, `GetResultAsync`)
*   **Impact:** Violation of student privacy. Students can see each other's grades and answers.
*   **Recommendation:** In `GetSessionAsync` and `GetResultAsync`, pass the `userId` and verify `session.StudentId == userId` before returning data.

### 4. Malicious File Upload (High)

*   **Description:** The `FileService` does not validate the content of uploaded files. It relies on the `ContentType` header provided by the client.
*   **Location:** `src/Services/FileService/FileService/Services/FileManagementService.cs`
*   **Impact:** Attackers can upload malicious scripts (e.g., .php, .jsp, .html with XSS, .exe) which could be executed on the server or the victim's browser.
*   **Recommendation:** Validate file extensions against an allowlist (e.g., .pdf, .docx, .png, .jpg). Validate "Magic Numbers" (file signature) to ensure the content matches the extension.

### 5. Insecure Direct Object Reference (IDOR) - Classroom Service (High)

*   **Description:** Instructors can modify or delete classrooms they do not own. They can also generate moderator tokens for live sessions of other classes.
*   **Location:** `src/Services/ClassroomService/ClassroomService/Controllers/ClassroomsController.cs`
*   **Impact:** Unauthorized modification of course content, disruption of live classes.
*   **Recommendation:** Enforce ownership checks. Ensure the instructor requesting the action is the `InstructorId` of the classroom.

### 6. Path Traversal Risk (High)

*   **Description:** The `FileService` uses the user-provided `fileName` directly in the storage path construction.
*   **Location:** `src/Services/FileService/FileService/Services/FileManagementService.cs` (`var storagePath = $"{type.ToString().ToLower()}/{fileId}/{fileName}";`)
*   **Impact:** Although `fileId` (GUID) acts as a folder, malicious filenames containing `../` could theoretically attempt to write files outside the intended directory structure in the object storage.
*   **Recommendation:** Sanitize filenames before using them. Generate a safe, random filename on the server side and store the original filename in metadata only.

### 7. User Enumeration (Medium)

*   **Description:** The registration endpoint returns a specific error message ("Email already exists") if a user is already registered.
*   **Location:** `src/Services/AuthService/AuthService/Controllers/AuthController.cs`
*   **Impact:** Attackers can harvest valid email addresses from the system.
*   **Recommendation:** Return a generic message like "If the email is valid, a registration link has been sent" or ensure the response time and message are identical whether the user exists or not.

### 8. Overly Permissive CORS (Medium)

*   **Description:** The application allows requests from any origin or `localhost:3000` with all methods and headers allowed, including credentials.
*   **Location:** `src/ApiGateway/ApiGateway/Program.cs`, `src/Services/AuthService/AuthService/Program.cs`
*   **Impact:** Cross-Origin Resource Sharing (CORS) misconfiguration can allow malicious websites to read data from the application on behalf of the user.
*   **Recommendation:** Restrict `AllowedOrigins` to the specific production domain of the frontend application.

### 9. Lack of Rate Limiting (Medium)

*   **Description:** The API Gateway (Ocelot) does not have rate limiting configured.
*   **Location:** `src/ApiGateway/ApiGateway/ocelot.json`
*   **Impact:** Susceptibility to Denial of Service (DoS) attacks and brute-force attempts.
*   **Recommendation:** Configure Ocelot's `RateLimitOptions` to restrict the number of requests per second/minute for each endpoint.

## Conclusion

The EduPlatform project has a solid microservices foundation but lacks essential security controls in the application layer. The presence of Critical IDORs and Hardcoded Secrets makes it unsuitable for production in its current state. Addressing the recommendations above should be the immediate priority.
