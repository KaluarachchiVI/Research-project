# Exported Cursor chats

These Markdown files are exports of your Cursor agent chat transcripts from this project.

## Use in another window

- **Open in another Cursor window**: File → Open Folder → choose the `exported-chats` folder (or the whole Research project and open this folder in the sidebar). You can read and search all chats there.
- **Open elsewhere**: Open any `.md` file in Notepad, VS Code, browser, or any Markdown viewer.

## Re-export after new chats

From the project root (Research project):

```powershell
node scripts/export-chats-to-markdown.js
```

New chats will be added; existing files are overwritten with the latest content.

## Copy raw transcripts to another Cursor project (optional)

If you want to try having the same chat history in a different Cursor workspace:

1. In the other workspace, find its project folder:  
   `%USERPROFILE%\.cursor\projects\` — each folder is named by project (e.g. a hash of the folder path).
2. Copy the entire `agent-transcripts` folder from  
   `%USERPROFILE%\.cursor\projects\c-Users-ASUS-TUF-Desktop-Research-project\agent-transcripts`  
   into that other project’s folder.
3. Cursor may or may not show them in the UI (behavior is not guaranteed).

The Markdown export above is the reliable way to read and share these chats in any window or app.
