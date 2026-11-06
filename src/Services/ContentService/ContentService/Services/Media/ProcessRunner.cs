using System.Diagnostics;
using System.Text;

namespace ContentService.Services.Media;

public sealed record ProcessOutcome(int ExitCode, string StandardOutput, string ErrorTail);

/// <summary>Runs a tool without a shell, with a timeout, keeping stdout and the tail of stderr.</summary>
public static class ProcessRunner
{
    private const int ErrorTailLength = 4000;

    public static async Task<ProcessOutcome> RunAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(arguments);

        var startInfo = new ProcessStartInfo(fileName)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        using var process = new Process { StartInfo = startInfo };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        var stderrLock = new object();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                lock (stdout)
                {
                    stdout.AppendLine(e.Data);
                }
            }
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is null)
            {
                return;
            }

            lock (stderrLock)
            {
                stderr.AppendLine(e.Data);
                if (stderr.Length > ErrorTailLength * 2)
                {
                    stderr.Remove(0, stderr.Length - ErrorTailLength);
                }
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutSource.CancelAfter(timeout);

        try
        {
            await process.WaitForExitAsync(timeoutSource.Token);
        }
        catch (OperationCanceledException)
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (InvalidOperationException)
            {
                // Already exited.
            }

            if (cancellationToken.IsCancellationRequested)
            {
                throw;
            }

            throw new TimeoutException($"{Path.GetFileName(fileName)} did not finish within {timeout}.");
        }

        string errorTail;
        lock (stderrLock)
        {
            var text = stderr.ToString();
            errorTail = text.Length > ErrorTailLength ? text[^ErrorTailLength..] : text;
        }

        string output;
        lock (stdout)
        {
            output = stdout.ToString();
        }

        return new ProcessOutcome(process.ExitCode, output, errorTail.Trim());
    }
}
