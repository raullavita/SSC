package chat.ssc.secure.plugins;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.signal.libsignal.protocol.IdentityKeyPair;
import org.signal.libsignal.protocol.SignalProtocolAddress;
import org.signal.libsignal.protocol.ecc.ECKeyPair;
import org.signal.libsignal.protocol.kem.KEMKeyPair;
import org.signal.libsignal.protocol.kem.KEMKeyType;
import org.signal.libsignal.protocol.state.KyberPreKeyRecord;
import org.signal.libsignal.protocol.state.PreKeyRecord;
import org.signal.libsignal.protocol.state.SessionRecord;
import org.signal.libsignal.protocol.state.SignedPreKeyRecord;
import org.signal.libsignal.protocol.groups.state.SenderKeyRecord;
import org.signal.libsignal.protocol.groups.state.SenderKeyStore;
import org.signal.libsignal.protocol.state.impl.InMemorySignalProtocolStore;
import org.signal.libsignal.protocol.util.KeyHelper;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Persistent libsignal protocol store — Engine 8.4.
 * Identity, prekeys, and X3DH session records stay on device only.
 */
public class SscSignalStore implements SenderKeyStore {

    private static final String PREFS_NAME = "ssc_signal_store_v1";
    private static final int ONE_TIME_PREKEY_COUNT = 20;

    private static SscSignalStore instance;

    private final SharedPreferences prefs;
    private final InMemorySignalProtocolStore protocolStore;
    private int signedPreKeyId = 1;
    private int kyberPreKeyId = 1;

    private SscSignalStore(Context context) throws Exception {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        IdentityKeyPair identity;
        int registrationId;
        if (prefs.contains("identity_key_pair")) {
            identity = new IdentityKeyPair(decode(prefs.getString("identity_key_pair", "")));
            registrationId = prefs.getInt("registration_id", KeyHelper.generateRegistrationId(false));
        } else {
            identity = IdentityKeyPair.generate();
            registrationId = KeyHelper.generateRegistrationId(false);
        }
        protocolStore = new InMemorySignalProtocolStore(identity, registrationId);
        signedPreKeyId = prefs.getInt("signed_prekey_id", 1);
        kyberPreKeyId = prefs.getInt("kyber_prekey_id", 1);
        loadPreKeysAndSessions();
    }

    public static synchronized SscSignalStore getInstance(Context context) throws Exception {
        if (instance == null) {
            instance = new SscSignalStore(context);
        }
        return instance;
    }

    public InMemorySignalProtocolStore getProtocolStore() {
        return protocolStore;
    }

    public boolean hasLocalMaterial() {
        return prefs.contains("signed_prekey");
    }

    public synchronized void ensureLocalKeys() throws Exception {
        if (hasLocalMaterial()) {
            return;
        }
        IdentityKeyPair identityKeyPair = protocolStore.getIdentityKeyPair();
        int registrationId = protocolStore.getLocalRegistrationId();

        ECKeyPair signedPreKeyPair = ECKeyPair.generate();
        byte[] signedPreKeySignature = identityKeyPair
                .getPrivateKey()
                .calculateSignature(signedPreKeyPair.getPublicKey().serialize());
        SignedPreKeyRecord signedPreKey = new SignedPreKeyRecord(
                signedPreKeyId,
                System.currentTimeMillis(),
                signedPreKeyPair,
                signedPreKeySignature
        );
        protocolStore.storeSignedPreKey(signedPreKeyId, signedPreKey);

        KEMKeyPair kyberPair = KEMKeyPair.generate(KEMKeyType.KYBER_1024);
        byte[] kyberSignature = identityKeyPair
                .getPrivateKey()
                .calculateSignature(kyberPair.getPublicKey().serialize());
        KyberPreKeyRecord kyberPreKey = new KyberPreKeyRecord(
                kyberPreKeyId,
                System.currentTimeMillis(),
                kyberPair,
                kyberSignature
        );
        protocolStore.storeKyberPreKey(kyberPreKeyId, kyberPreKey);

        for (int i = 0; i < ONE_TIME_PREKEY_COUNT; i++) {
            int id = i + 1;
            PreKeyRecord preKey = new PreKeyRecord(id, ECKeyPair.generate());
            protocolStore.storePreKey(id, preKey);
        }

        persist(identityKeyPair, registrationId, signedPreKey, kyberPreKey);
    }

    public synchronized void persistSessions() throws JSONException {
        Set<String> peerIds = new HashSet<>(prefs.getStringSet("session_peer_ids", new HashSet<>()));
        SharedPreferences.Editor editor = prefs.edit();
        Set<String> active = new HashSet<>();
        for (String peerId : peerIds) {
            SignalProtocolAddress address = new SignalProtocolAddress(peerId, 1);
            if (!protocolStore.containsSession(address)) {
                editor.remove(sessionKey(peerId));
                continue;
            }
            SessionRecord session = protocolStore.loadSession(address);
            editor.putString(sessionKey(peerId), encode(session.serialize()));
            active.add(peerId);
        }
        editor.putStringSet("session_peer_ids", active);
        editor.apply();
    }

    private void persist(
            IdentityKeyPair identityKeyPair,
            int registrationId,
            SignedPreKeyRecord signedPreKey,
            KyberPreKeyRecord kyberPreKey
    ) throws JSONException {
        JSONArray preKeyIds = new JSONArray();
        for (int i = 1; i <= ONE_TIME_PREKEY_COUNT; i++) {
            preKeyIds.put(i);
        }
        prefs.edit()
                .putString("identity_key_pair", encode(identityKeyPair.serialize()))
                .putInt("registration_id", registrationId)
                .putInt("signed_prekey_id", signedPreKeyId)
                .putString("signed_prekey", encode(signedPreKey.serialize()))
                .putInt("kyber_prekey_id", kyberPreKeyId)
                .putString("kyber_prekey", encode(kyberPreKey.serialize()))
                .putString("prekey_ids", preKeyIds.toString())
                .apply();
        for (int i = 1; i <= ONE_TIME_PREKEY_COUNT; i++) {
            try {
                PreKeyRecord record = protocolStore.loadPreKey(i);
                prefs.edit().putString(preKeyKey(i), encode(record.serialize())).apply();
            } catch (Exception ignored) {
                // best-effort during first persist
            }
        }
    }

    private void loadPreKeysAndSessions() throws Exception {
        if (prefs.contains("signed_prekey")) {
            SignedPreKeyRecord signedPreKey = new SignedPreKeyRecord(decode(prefs.getString("signed_prekey", "")));
            protocolStore.storeSignedPreKey(signedPreKeyId, signedPreKey);
        }
        if (prefs.contains("kyber_prekey")) {
            KyberPreKeyRecord kyberPreKey = new KyberPreKeyRecord(decode(prefs.getString("kyber_prekey", "")));
            protocolStore.storeKyberPreKey(kyberPreKeyId, kyberPreKey);
        }
        String preKeyIdsRaw = prefs.getString("prekey_ids", "[]");
        JSONArray preKeyIds = new JSONArray(preKeyIdsRaw);
        for (int i = 0; i < preKeyIds.length(); i++) {
            int id = preKeyIds.getInt(i);
            String serialized = prefs.getString(preKeyKey(id), null);
            if (serialized != null) {
                protocolStore.storePreKey(id, new PreKeyRecord(decode(serialized)));
            }
        }
        Set<String> peerSet = new HashSet<>(prefs.getStringSet("session_peer_ids", new HashSet<>()));
        for (String peerId : peerSet) {
            String serialized = prefs.getString(sessionKey(peerId), null);
            if (serialized == null) {
                continue;
            }
            SignalProtocolAddress address = new SignalProtocolAddress(peerId, 1);
            protocolStore.storeSession(address, new SessionRecord(decode(serialized)));
        }
    }

    public synchronized void trackSessionPeer(String peerUserId) throws JSONException {
        Set<String> peers = new HashSet<>(prefs.getStringSet("session_peer_ids", new HashSet<>()));
        peers.add(peerUserId);
        prefs.edit().putStringSet("session_peer_ids", peers).apply();
        persistSessions();
    }

    @Override
    public void storeSenderKey(SignalProtocolAddress sender, UUID distributionId, SenderKeyRecord record) {
        prefs.edit()
                .putString(senderKeyKey(sender.getName(), distributionId), encode(record.serialize()))
                .apply();
    }

    @Override
    public SenderKeyRecord loadSenderKey(SignalProtocolAddress sender, UUID distributionId) {
        String raw = prefs.getString(senderKeyKey(sender.getName(), distributionId), null);
        if (raw == null) {
            return null;
        }
        try {
            return new SenderKeyRecord(decode(raw));
        } catch (Exception e) {
            return null;
        }
    }

    public boolean hasSenderKey(String senderUserId, UUID distributionId) {
        return loadSenderKey(new SignalProtocolAddress(senderUserId, 1), distributionId) != null;
    }

    public List<Integer> getPreKeyIds() throws JSONException {
        String raw = prefs.getString("prekey_ids", "[]");
        JSONArray arr = new JSONArray(raw);
        List<Integer> ids = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            ids.add(arr.getInt(i));
        }
        return ids;
    }

    private static String sessionKey(String peerId) {
        return "session_" + peerId;
    }

    private static String preKeyKey(int id) {
        return "prekey_" + id;
    }

    private static String senderKeyKey(String senderId, UUID distributionId) {
        return "sender_key_" + senderId + "_" + distributionId.toString();
    }

    private static String encode(byte[] data) {
        return Base64.encodeToString(data, Base64.NO_WRAP);
    }

    private static byte[] decode(String data) {
        return Base64.decode(data, Base64.NO_WRAP);
    }

    /** Panic wipe — clear local Signal material so X3DH can rebuild cleanly. */
    public static synchronized void wipeAll(Context context) {
        context.getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply();
        instance = null;
    }
}