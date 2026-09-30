# Remote login recovery (DSH 0.1.7-rc.2)

- Gate sessions are persisted through the host CredentialProvider, storing SHA-256 token digests only, not bearer cookies. The credential key is `dsh-access-gate/sessions`.
- Successful login, logout and administrative revocation wait for persistence. Password-generation binding prevents old sessions being restored after a password change, including interruption between updating the password and clearing sessions.
- Activity timestamps are batched every five seconds and flushed on orderly shutdown. An abrupt process loss can lose up to the last five seconds of activity; this can expire a session slightly early, never extend its lifetime. Storage failure is reported and retried; login does not report success if its session could not be stored.
- TTL, idle timeout, optional IP binding and the 64-session cap remain enforced. A stricter TTL/IP policy applies on restore. Invalid records are ignored; credential read failures prevent the gateway from starting rather than bypassing authentication.
- Browser recovery observes the official connection state. Only an explicit gate status response indicating expired authentication displays a login link. Network errors, native-port responses and server failures do not trigger that message. Checks do not extend idle expiry and stop in hidden tabs.
- Login opens in a new tab so the current conversation/draft is not navigated away. The message clears and the official reconnect method is invoked once authentication is restored. The plugin does not replace WebSocket, alter native retry/heartbeat settings, or take ownership of the host connection loop.
- Existing pre-upgrade in-memory sessions cannot be recovered after installing this fix; sign in once after upgrading. Subsequently issued sessions survive restarts until their configured expiry.

This fixes restart-related 401 recovery. It does not establish or fix every cause of network disconnection.
