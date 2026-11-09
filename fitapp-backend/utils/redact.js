// Logs must never contain a user's email. redactEmail('dylan@example.com') -> 'd***@example.com'
function redactEmail(email) {
  if (!email || typeof email !== 'string') return email ? '[redacted]' : String(email);
  const at = email.indexOf('@');
  if (at < 1) return '[redacted]';
  return `${email[0]}***${email.slice(at)}`;
}
module.exports = { redactEmail };
