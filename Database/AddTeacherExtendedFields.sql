-- Adds the extended teacher profile fields (photo, qualification, DOB, etc.)
USE SchoolERP;
GO

IF COL_LENGTH('Teachers', 'PhotoUrl')         IS NULL ALTER TABLE Teachers ADD PhotoUrl         NVARCHAR(MAX) NULL;
IF COL_LENGTH('Teachers', 'Qualification')    IS NULL ALTER TABLE Teachers ADD Qualification    NVARCHAR(100) NULL;
IF COL_LENGTH('Teachers', 'DateOfBirth')      IS NULL ALTER TABLE Teachers ADD DateOfBirth      DATE          NULL;
IF COL_LENGTH('Teachers', 'ExperienceYears')  IS NULL ALTER TABLE Teachers ADD ExperienceYears  INT           NULL;
IF COL_LENGTH('Teachers', 'BloodGroup')       IS NULL ALTER TABLE Teachers ADD BloodGroup       NVARCHAR(10)  NULL;
IF COL_LENGTH('Teachers', 'MaritalStatus')    IS NULL ALTER TABLE Teachers ADD MaritalStatus    NVARCHAR(20)  NULL;
IF COL_LENGTH('Teachers', 'Religion')         IS NULL ALTER TABLE Teachers ADD Religion         NVARCHAR(30)  NULL;
IF COL_LENGTH('Teachers', 'Category')         IS NULL ALTER TABLE Teachers ADD Category         NVARCHAR(30)  NULL;
IF COL_LENGTH('Teachers', 'EmergencyContact') IS NULL ALTER TABLE Teachers ADD EmergencyContact NVARCHAR(20)  NULL;
IF COL_LENGTH('Teachers', 'AadharNo')         IS NULL ALTER TABLE Teachers ADD AadharNo         NVARCHAR(20)  NULL;
GO

PRINT 'Teacher extended fields ready.';
GO
