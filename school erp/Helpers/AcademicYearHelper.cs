namespace school_erp.Helpers;

// Academic year runs April → March. E.g. any date from 2025-04-01 to 2026-03-31
// belongs to academic year "2025-26".
public static class AcademicYearHelper
{
    // Derive "YYYY-YY" from a date.
    public static string FromDate(DateOnly date)
    {
        int startYear = date.Month >= 4 ? date.Year : date.Year - 1;
        return $"{startYear}-{(startYear + 1) % 100:D2}";
    }

    public static string FromDate(DateTime date) => FromDate(DateOnly.FromDateTime(date));

    // The academic year for "now" (UTC).
    public static string Current() => FromDate(DateTime.UtcNow);
}
