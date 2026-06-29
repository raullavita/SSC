/**
 * Bundled offline FAQ — Q.39 (no network required).
 */

const EN = [
  {
    id: 'getting-started',
    title: 'Getting started',
    body: `## Create your account
Register with email and choose a **username** (4–12 characters). Your username is permanent.

## Add contacts
Search by username or display name. If they are not a contact yet, SSC sends a friend request automatically when you start a chat.

## Display name & bio
Set a friendly **display name** and optional **bio** in Settings → Profile. Your @username stays locked.`,
  },
  {
    id: 'messaging',
    title: 'Messaging & retention',
    body: `## End-to-end encryption
Direct messages use Signal-style encryption when both devices are ready. The server relays ciphertext only.

## Auto-delete
Messages expire based on your retention setting (1h up to 30 days). Shorter retention means less data on devices and servers.

## Groups
Create a group from your contacts list. Group titles are derived locally from member names unless you set a local label.`,
  },
  {
    id: 'privacy-security',
    title: 'Privacy & security',
    body: `## Two-factor authentication
Enable 2FA in Settings → Security for password accounts.

## Panic wipe
The panic button instantly wipes local data and deletes your account on the server. Use only in an emergency.

## Privacy controls
Adjust read receipts, typing indicators, last seen, and profile photo visibility in Settings → Privacy.`,
  },
  {
    id: 'calls',
    title: 'Voice & video calls',
    body: `## 1:1 calls
Start a voice or video call from a chat header. Signaling is encrypted when Signal sessions are active.

## Group calls
Small groups use mesh WebRTC. Larger groups may use the SFU path when enabled on the server.

## Permissions
Allow camera and microphone when prompted. On desktop, check system privacy settings if calls fail to connect.`,
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    body: `## Messages stuck on "decrypting"
Wait a few seconds, then tap retry. Ensure both users completed setup and have network access.

## Cannot add a user
They may have blocked you, or a friend request is already pending.

## Still need help?
Email [contact@supersecurechat.com](mailto:contact@supersecurechat.com) — we read every message.`,
  },
];

const ES = [
  {
    id: 'getting-started',
    title: 'Primeros pasos',
    body: `## Crear cuenta
Regístrate con email y elige un **usuario** (4–12 caracteres). El usuario es permanente.

## Añadir contactos
Busca por usuario o nombre. Si aún no son contacto, SSC envía una solicitud al iniciar un chat.

## Nombre y biografía
Configura **nombre para mostrar** y **biografía** en Ajustes → Perfil. Tu @usuario no cambia.`,
  },
  {
    id: 'messaging',
    title: 'Mensajes y retención',
    body: `## Cifrado de extremo a extremo
Los chats directos usan cifrado estilo Signal cuando ambos dispositivos están listos.

## Auto-borrado
Los mensajes expiran según tu retención (1h hasta 30 días).

## Grupos
Crea grupos desde contactos. Los títulos se derivan localmente de los miembros.`,
  },
  {
    id: 'privacy-security',
    title: 'Privacidad y seguridad',
    body: `## Autenticación en dos pasos
Activa 2FA en Ajustes → Seguridad para cuentas con contraseña.

## Borrado de pánico
El botón de pánico borra datos locales y elimina la cuenta en el servidor.

## Controles de privacidad
Ajusta recibos de lectura, escritura, última conexión y foto de perfil en Ajustes → Privacidad.`,
  },
  {
    id: 'calls',
    title: 'Llamadas de voz y video',
    body: `## Llamadas 1:1
Inicia una llamada desde el encabezado del chat. La señalización se cifra cuando las sesiones Signal están activas.

## Llamadas de grupo
Grupos pequeños usan mesh WebRTC. Grupos grandes pueden usar SFU si el servidor lo permite.

## Permisos
Permite cámara y micrófono cuando se solicite.`,
  },
  {
    id: 'troubleshooting',
    title: 'Solución de problemas',
    body: `## Mensajes en "descifrando"
Espera unos segundos y reintenta. Ambos usuarios deben haber completado la configuración.

## No puedo añadir a alguien
Puede que te haya bloqueado o ya haya una solicitud pendiente.

## ¿Más ayuda?
Escribe a [contact@supersecurechat.com](mailto:contact@supersecurechat.com).`,
  },
];

const RO = [
  {
    id: 'getting-started',
    title: 'Primii pași',
    body: `## Creează cont
Înregistrează-te cu email și alege un **utilizator** (4–12 caractere). Utilizatorul este permanent.

## Adaugă contacte
Caută după utilizator sau nume. Dacă nu sunt încă contact, SSC trimite o cerere când deschizi un chat.

## Nume afișat și biografie
Setează **numele afișat** și **biografia** în Setări → Profil. @utilizatorul rămâne blocat.`,
  },
  {
    id: 'messaging',
    title: 'Mesaje și retenție',
    body: `## Criptare end-to-end
Mesajele directe folosesc criptare Signal când ambele dispozitive sunt gata.

## Ștergere automată
Mesajele expiră conform retenției (1h până la 30 zile).

## Grupuri
Creează grupuri din contacte. Titlurile se derivă local din membri.`,
  },
  {
    id: 'privacy-security',
    title: 'Confidențialitate și securitate',
    body: `## Autentificare în doi pași
Activează 2FA în Setări → Securitate pentru conturi cu parolă.

## Ștergere de panică
Butonul de panică șterge datele locale și contul de pe server.

## Setări de confidențialitate
Ajustează confirmările de citire, tastarea, ultima conexiune și fotografia în Setări → Confidențialitate.`,
  },
  {
    id: 'calls',
    title: 'Apeluri vocale și video',
    body: `## Apeluri 1:1
Pornește un apel din antetul chatului. Semnalizarea este criptată când sesiunile Signal sunt active.

## Apeluri de grup
Grupurile mici folosesc mesh WebRTC. Grupurile mari pot folosi SFU dacă serverul permite.

## Permisiuni
Permite camera și microfonul când ți se cere.`,
  },
  {
    id: 'troubleshooting',
    title: 'Depanare',
    body: `## Mesaje blocate la „decriptare”
Așteaptă câteva secunde și reîncearcă. Ambii utilizatori trebuie să fi terminat configurarea.

## Nu pot adăuga pe cineva
Te-ar fi putut bloca sau există deja o cerere în așteptare.

## Mai ai nevoie de ajutor?
Scrie la [contact@supersecurechat.com](mailto:contact@supersecurechat.com).`,
  },
];

export const FAQ_BY_LOCALE = { en: EN, es: ES, ro: RO };

export function getFaqArticles(locale) {
  const code = (locale || 'en').toLowerCase().slice(0, 2);
  return FAQ_BY_LOCALE[code] || FAQ_BY_LOCALE.en;
}