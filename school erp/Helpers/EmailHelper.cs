using System.Net;
using System.Net.Mail;

namespace school_erp.Helpers;

// Sends email via Gmail SMTP. If credentials aren't configured it no-ops
// (so the app keeps working; email just won't go out until you add them).
public class EmailHelper
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailHelper> _logger;

    public EmailHelper(IConfiguration config, ILogger<EmailHelper> logger)
    {
        _config = config;
        _logger = logger;
    }

    private (string host, int port, string from, string fromName, string pass) GetSettings()
    {
        var s = _config.GetSection("EmailSettings");
        var host = Environment.GetEnvironmentVariable("SCHOOLERP_SMTP_HOST") ?? s["SmtpHost"] ?? "smtp.gmail.com";
        var port = int.TryParse(Environment.GetEnvironmentVariable("SCHOOLERP_SMTP_PORT") ?? s["SmtpPort"], out var p) ? p : 587;
        var from = Environment.GetEnvironmentVariable("SCHOOLERP_SMTP_FROM") ?? s["FromEmail"] ?? "";
        var fromName = s["FromName"] ?? "School ERP";
        var pass = Environment.GetEnvironmentVariable("SCHOOLERP_SMTP_PASSWORD") ?? s["AppPassword"] ?? "";
        return (host, port, from, fromName, pass);
    }

    public bool IsConfigured()
    {
        var (_, _, from, _, pass) = GetSettings();
        return !string.IsNullOrWhiteSpace(from) && !string.IsNullOrWhiteSpace(pass);
    }

    // Sends a single email to one recipient. Returns true if sent.
    // Best-effort: no-ops (returns false) if SMTP isn't configured or on error.
    public async Task<bool> SendAsync(string toEmail, string subject, string htmlBody)
    {
        if (string.IsNullOrWhiteSpace(toEmail)) return false;
        if (!IsConfigured())
        {
            _logger.LogWarning("Email not sent — SMTP credentials are not configured (EmailSettings).");
            return false;
        }

        var (host, port, from, fromName, pass) = GetSettings();
        try
        {
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(from, pass)
            };
            using var msg = new MailMessage
            {
                From = new MailAddress(from, fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            msg.To.Add(toEmail);
            await client.SendMailAsync(msg);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}.", toEmail);
            return false;
        }
    }

    // Sends one email to many recipients (BCC so addresses stay private).
    // Returns how many were sent (0 if not configured / on failure).
    public async Task<int> SendBulkAsync(IEnumerable<string> toEmails, string subject, string htmlBody)
    {
        var recipients = toEmails.Where(e => !string.IsNullOrWhiteSpace(e)).Distinct().ToList();
        if (recipients.Count == 0) return 0;

        if (!IsConfigured())
        {
            _logger.LogWarning("Email not sent — SMTP credentials are not configured (EmailSettings).");
            return 0;
        }

        var (host, port, from, fromName, pass) = GetSettings();
        try
        {
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(from, pass)
            };
            using var msg = new MailMessage
            {
                From = new MailAddress(from, fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            // send to self in "To", everyone else BCC
            msg.To.Add(from);
            foreach (var r in recipients) msg.Bcc.Add(r);

            await client.SendMailAsync(msg);
            return recipients.Count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send notice email.");
            return 0;
        }
    }
}
