import { execFile } from 'node:child_process';

// Sends through the signed-in iMessage account in macOS's Messages app.
// The recipient and text are passed as arguments, never spliced into the script.
const SEND_SCRIPT = `
on run argv
  tell application "Messages"
    set imessageAccount to 1st account whose service type = iMessage
    send (item 2 of argv) to participant (item 1 of argv) of imessageAccount
  end tell
end run`;

export function sendIMessage(recipient, text) {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', SEND_SCRIPT, recipient, text], (err, _stdout, stderr) => {
      if (err) reject(new Error(`iMessage send failed: ${stderr.trim() || err.message}`));
      else resolve();
    });
  });
}
