namespace school_erp.DTOs;

// ── Subject ───────────────────────────────────────────────────
public class SubjectDto
{
    public int    SubjectId   { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public int    ClassId     { get; set; }
}

public class CreateSubjectDto
{
    public string SubjectName { get; set; } = string.Empty;
    public int    ClassId     { get; set; }
}

// ── Exam ──────────────────────────────────────────────────────
public class ExamSubjectItemDto
{
    public int      ExamSubjectId { get; set; }
    public int      SubjectId     { get; set; }
    public string?  SubjectName   { get; set; }
    public string?  ExamDate      { get; set; }
    public decimal  MaxMarks      { get; set; } = 100;
    public decimal  PassingMarks  { get; set; } = 35;
}

public class ExamDto
{
    public int    ExamId    { get; set; }
    public string ExamName  { get; set; } = string.Empty;
    public int    ClassId   { get; set; }
    public string? ClassName { get; set; }
    public string? Section   { get; set; }
    public List<ExamSubjectItemDto> Subjects { get; set; } = new();
}

public class CreateExamDto
{
    public string ExamName { get; set; } = string.Empty;
    public int    ClassId  { get; set; }
    public List<CreateExamSubjectDto> Subjects { get; set; } = new();
}

public class CreateExamSubjectDto
{
    public int     SubjectId    { get; set; }
    public string? ExamDate     { get; set; }
    public decimal MaxMarks     { get; set; } = 100;
    public decimal PassingMarks { get; set; } = 35;
}

// ── Results ───────────────────────────────────────────────────
// One row in the mark-entry grid: a student (with any existing mark).
public class ResultRowDto
{
    public int      StudentId     { get; set; }
    public string   StudentName   { get; set; } = string.Empty;
    public string?  AdmissionNo   { get; set; }
    public string?  RollNo        { get; set; }
    public decimal? MarksObtained { get; set; }
    public bool     IsAbsent      { get; set; }
}

public class MarkEntryDto
{
    public int StudentId { get; set; }
    public decimal? MarksObtained { get; set; }
    public bool IsAbsent { get; set; }
}

public class SaveResultsDto
{
    public int ExamSubjectId { get; set; }
    public List<MarkEntryDto> Rows { get; set; } = new();
}

// Per-student marksheet — results grouped by exam.
public class MarksheetExamDto
{
    public int     ExamId   { get; set; }
    public string  ExamName { get; set; } = string.Empty;
    public decimal TotalMax { get; set; }
    public decimal TotalObtained { get; set; }
    public decimal Percentage { get; set; }
    public string  Grade { get; set; } = "";
    public List<MarksheetSubjectDto> Subjects { get; set; } = new();
}

public class MarksheetSubjectDto
{
    public string  SubjectName   { get; set; } = string.Empty;
    public string? ExamDate      { get; set; }
    public decimal MaxMarks      { get; set; }
    public decimal PassingMarks  { get; set; }
    public decimal? MarksObtained { get; set; }
    public bool     IsAbsent      { get; set; }
    public string   Result        { get; set; } = "";  // Pass / Fail / Absent
}
