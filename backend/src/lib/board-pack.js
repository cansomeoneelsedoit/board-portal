/**
 * Naming convention for a meeting's board-pack folder in SharePoint.
 *
 * "2026-08-19 August Ordinary Meeting" — the date first so the library sorts
 * chronologically on its own, without anyone maintaining an index.
 *
 * Shared by the uploader (which creates these folders) and the reader (which
 * finds an existing one), so the two can never drift apart.
 */
function meetingFolderName(meeting) {
  if (!meeting) return 'General';
  const date = meeting.date ? new Date(meeting.date).toISOString().slice(0, 10) : '';
  // Characters SharePoint and Windows reject in item names.
  const safeTitle = String(meeting.title || 'Meeting')
    .replace(/[\\/:*?"<>|#%]/g, '-')
    .trim();
  return date ? `${date} ${safeTitle}` : safeTitle;
}

module.exports = { meetingFolderName };
