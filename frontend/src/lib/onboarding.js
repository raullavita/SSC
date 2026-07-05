/** Post-auth routing — new users must pick a @username before chat. */

export function needsUsernameSetup(user) {
  return Boolean(user && !user.username);
}

export function postAuthPath(user, fallback = '/chat') {
  if (needsUsernameSetup(user)) return '/setup-username';
  return fallback;
}