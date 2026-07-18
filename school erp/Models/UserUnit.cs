namespace school_erp.Models;

// Which units a user is allowed to access. A user can belong to (see & manage
// the data of) MANY units. One row per (user, unit).
//
// The user's "home" unit stays on User.UnitId (where they were created / where
// new records they make are stamped). This table lists EVERY unit whose data
// they may view and act on — their home unit is always included here too.
public class UserUnit
{
    public int UserUnitId { get; set; }
    public int UserId { get; set; }
    public int UnitId { get; set; }

    // Navigation
    public User? User { get; set; }
    public Unit? Unit { get; set; }
}
