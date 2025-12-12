// Support controller for bug reports
// This is a stub implementation - in a real app, you'd have a BugReport model

export const getAllBugReports = async (req, res) => {
  try {
    // Mock data for now
    const bugReports = [
      {
        id: 1,
        title: "Login issue",
        description: "Users can't login with correct credentials",
        status: "open",
        priority: "high",
        createdAt: new Date()
      }
    ];

    res.json({ bugReports });
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    res.status(500).json({ error: 'Failed to fetch bug reports' });
  }
};

export const updateBugReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Mock update for now
    res.json({
      message: 'Bug report status updated successfully',
      bugReport: { id, status }
    });
  } catch (error) {
    console.error('Error updating bug report:', error);
    res.status(500).json({ error: 'Failed to update bug report' });
  }
};
