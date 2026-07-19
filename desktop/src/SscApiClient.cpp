#include "SscApiClient.h"

#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonArray>
#include <QUrlQuery>
#include <QUrl>
#include <QTimer>
#include <QDateTime>
#include <QRegularExpression>

SscApiClient::SscApiClient(SscSession *session, SscCryptoBridge *crypto, QObject *parent)
    : QObject(parent)
    , m_session(session)
    , m_crypto(crypto)
{
    connect(m_crypto, &SscCryptoBridge::prekeyBundleReady, this, [this](const QJsonObject &bundle) {
        if (bundle.isEmpty()) {
            setError(m_crypto->lastError());
            return;
        }
        uploadPrekeys(bundle);
    });
    connect(m_crypto, &SscCryptoBridge::encryptFinished, this,
            [this](bool ok, const QString &ciphertext, const QString &error) {
                setBusy(false);
                if (!ok) {
                    setError(error);
                    return;
                }
                // plaintext held in statusText temporarily when sending — use pending
            });
}

void SscApiClient::setError(const QString &e)
{
    m_lastError = e;
    emit lastErrorChanged();
}

void SscApiClient::setBusy(bool b)
{
    if (m_busy == b) {
        return;
    }
    m_busy = b;
    emit busyChanged();
}

void SscApiClient::setStatus(const QString &s)
{
    m_statusText = s;
    emit statusTextChanged();
}

QNetworkRequest SscApiClient::makeRequest(const QString &path) const
{
    QNetworkRequest req{QUrl(m_apiBase + path)};
    req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    req.setRawHeader("Accept", "application/json");
    req.setRawHeader("X-SSC-Client", "windows/0.4.0/15");
    req.setRawHeader("X-SSC-Native-Bridge", "v1");
    req.setRawHeader("X-SSC-Device-Id", m_session->deviceId().toUtf8());
    if (!m_session->accessToken().isEmpty()) {
        req.setRawHeader("Authorization", ("Bearer " + m_session->accessToken()).toUtf8());
    }
    return req;
}

void SscApiClient::loadPublicConfig()
{
    auto *reply = m_nam.get(makeRequest(QStringLiteral("/api/config")));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            m_captchaRequired = true;
            emit configChanged();
            return;
        }
        const auto obj = QJsonDocument::fromJson(reply->readAll()).object();
        m_captchaRequired = obj.value(QStringLiteral("captcha_required")).toBool(true);
        m_captchaSiteKey = obj.value(QStringLiteral("turnstile_site_key")).toString();
        emit configChanged();
    });
}

void SscApiClient::applyAuth(const QJsonObject &obj)
{
    const auto user = obj.value(QStringLiteral("user")).toObject();
    const auto token = obj.value(QStringLiteral("ws_token")).toString();
    if (token.isEmpty()) {
        setError(QStringLiteral("missing_ws_token"));
        emit loginFailed(m_lastError);
        return;
    }
    m_session->saveSession(
        token,
        user.value(QStringLiteral("id")).toString(user.value(QStringLiteral("_id")).toString()),
        user.value(QStringLiteral("display_name")).toString(),
        user.value(QStringLiteral("username")).toString());
    m_crypto->start(m_session->signalStorePath());
    m_crypto->configure(m_session->userId(), m_session->deviceId());
    emit loginSucceeded();
    QTimer::singleShot(300, this, [this]() {
        ensurePrekeys();
        refreshConversations();
    });
}

void SscApiClient::login(const QString &email, const QString &password)
{
    setBusy(true);
    setError({});
    QJsonObject body{{QStringLiteral("email"), email.trimmed()}, {QStringLiteral("password"), password}};
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/auth/login")),
                             QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setBusy(false);
        if (reply->error() != QNetworkReply::NoError) {
            const auto body = reply->readAll();
            const auto obj = QJsonDocument::fromJson(body).object();
            setError(obj.value(QStringLiteral("detail")).toString(reply->errorString()));
            emit loginFailed(m_lastError);
            return;
        }
        applyAuth(QJsonDocument::fromJson(reply->readAll()).object());
    });
}

void SscApiClient::registerAccount(const QString &email, const QString &password, const QString &displayName,
                                   const QString &captchaToken)
{
    setBusy(true);
    setError({});
    QJsonObject body{
        {QStringLiteral("email"), email.trimmed()},
        {QStringLiteral("password"), password},
        {QStringLiteral("display_name"), displayName.trimmed()},
    };
    if (!captchaToken.isEmpty()) {
        body.insert(QStringLiteral("captcha_token"), captchaToken);
    }
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/auth/register")),
                             QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setBusy(false);
        if (reply->error() != QNetworkReply::NoError) {
            const auto body = reply->readAll();
            const auto obj = QJsonDocument::fromJson(body).object();
            QString detail = obj.value(QStringLiteral("detail")).toString(reply->errorString());
            if (detail.isEmpty()) {
                detail = QString::fromUtf8(body);
            }
            setError(detail);
            emit loginFailed(m_lastError);
            return;
        }
        applyAuth(QJsonDocument::fromJson(reply->readAll()).object());
        emit registered();
    });
}

void SscApiClient::logout()
{
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/auth/logout")), QByteArray("{}"));
    connect(reply, &QNetworkReply::finished, reply, &QObject::deleteLater);
    m_session->clear();
    m_conversations = {};
    m_messages = {};
    m_activeConversationId.clear();
    m_activePeerId.clear();
    emit conversationsChanged();
    emit messagesChanged();
    emit activeConversationChanged();
}

void SscApiClient::ensurePrekeys()
{
    if (!m_session->loggedIn()) {
        return;
    }
    setStatus(QStringLiteral("Uploading prekeys…"));
    m_crypto->generateAndUploadReady();
}

void SscApiClient::uploadPrekeys(const QJsonObject &bundle)
{
    // Map libsignal-client JS shape → server snake_case (Android toServerPrekeyPayload)
    const auto signedPk = bundle.value(QStringLiteral("signedPreKey")).toObject();
    const auto preKeys = bundle.value(QStringLiteral("preKeys")).toArray();
    QJsonArray mappedPrekeys;
    for (const auto &v : preKeys) {
        const auto pk = v.toObject();
        mappedPrekeys.append(QJsonObject{
            {QStringLiteral("key_id"), pk.value(QStringLiteral("keyId")).toInt()},
            {QStringLiteral("public_key"), pk.value(QStringLiteral("publicKey")).toString()},
        });
    }
    QJsonObject payload{
        {QStringLiteral("device_id"), m_session->deviceId()},
        {QStringLiteral("registration_id"), bundle.value(QStringLiteral("registrationId")).toInt(1)},
        {QStringLiteral("identity_key"), bundle.value(QStringLiteral("identityKey")).toString()},
        {QStringLiteral("signed_prekey"),
         QJsonObject{
             {QStringLiteral("key_id"), signedPk.value(QStringLiteral("keyId")).toInt(1)},
             {QStringLiteral("public_key"), signedPk.value(QStringLiteral("publicKey")).toString()},
             {QStringLiteral("signature"), signedPk.value(QStringLiteral("signature")).toString()},
         }},
        {QStringLiteral("prekeys"), mappedPrekeys},
    };
    const auto kyber = bundle.value(QStringLiteral("kyberPreKey")).toObject();
    if (!kyber.isEmpty()) {
        payload.insert(
            QStringLiteral("kyber_prekey"),
            QJsonObject{
                {QStringLiteral("key_id"), kyber.value(QStringLiteral("keyId")).toInt(1)},
                {QStringLiteral("public_key"), kyber.value(QStringLiteral("publicKey")).toString()},
                {QStringLiteral("signature"), kyber.value(QStringLiteral("signature")).toString()},
            });
    }

    auto *reply = m_nam.put(makeRequest(QStringLiteral("/api/prekeys/bundle")),
                            QJsonDocument(payload).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            const auto body = reply->readAll();
            setStatus(QStringLiteral("Prekey upload issue - messaging may need retry"));
            qWarning("prekeys: %s %s", qPrintable(reply->errorString()), body.constData());
            return;
        }
        setStatus(QStringLiteral("Secure keys ready"));
    });
}

void SscApiClient::refreshConversations()
{
    auto *reply = m_nam.get(makeRequest(QStringLiteral("/api/conversations")));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            setError(reply->errorString());
            return;
        }
        const auto doc = QJsonDocument::fromJson(reply->readAll());
        m_conversations = doc.object().value(QStringLiteral("conversations")).toArray();
        emit conversationsChanged();
    });
}

void SscApiClient::openConversation(const QString &conversationId, const QString &peerId)
{
    m_activeConversationId = conversationId;
    m_activePeerId = peerId;
    emit activeConversationChanged();
    setBusy(true);
    auto *reply = m_nam.get(
        makeRequest(QStringLiteral("/api/conversations/%1/messages").arg(conversationId)));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setBusy(false);
        if (reply->error() != QNetworkReply::NoError) {
            setError(reply->errorString());
            return;
        }
        const auto doc = QJsonDocument::fromJson(reply->readAll());
        m_rawMessages = doc.object().value(QStringLiteral("messages")).toArray();
        m_messages = QJsonArray();
        emit messagesChanged();
        m_decryptIndex = 0;
        decryptNext(0);
    });
}

void SscApiClient::decryptNext(int index)
{
    if (index >= m_rawMessages.size()) {
        emit messagesChanged();
        return;
    }
    m_decryptIndex = index;
    QJsonObject m = m_rawMessages.at(index).toObject();
    const QString ct = m.value(QStringLiteral("ciphertext")).toString();
    const QString sender = m.value(QStringLiteral("sender_id")).toString();
    const QString myId = m_session->userId();

    if (ct.isEmpty()) {
        m.insert(QStringLiteral("plaintext"), QStringLiteral(""));
        m_messages.append(m);
        decryptNext(index + 1);
        return;
    }
    if (sender == myId) {
        m.insert(QStringLiteral("plaintext"), QStringLiteral("[sent]"));
        m.insert(QStringLiteral("mine"), true);
        m_messages.append(m);
        decryptNext(index + 1);
        return;
    }
    const QString peer = sender.isEmpty() ? m_activePeerId : sender;
    m_crypto->call(
        QStringLiteral("decryptMessage"),
        QJsonObject{
            {QStringLiteral("ciphertext"), ct},
            {QStringLiteral("peerId"), peer},
            {QStringLiteral("deviceId"), QStringLiteral("1")},
        },
        [this, m, index](bool ok, const QJsonObject &result, const QString &err) mutable {
            if (ok) {
                m.insert(QStringLiteral("plaintext"), result.value(QStringLiteral("plaintext")).toString());
            } else {
                m.insert(QStringLiteral("plaintext"), QStringLiteral("[unable to decrypt]"));
                m.insert(QStringLiteral("decrypt_error"), err);
            }
            m_messages.append(m);
            decryptNext(index + 1);
        });
}

void SscApiClient::sendMessage(const QString &conversationId, const QString &plaintext)
{
    if (conversationId.isEmpty() || plaintext.trimmed().isEmpty()) {
        return;
    }
    setBusy(true);
    setError({});
    QString peerId = m_activePeerId;
    if (peerId.isEmpty()) {
        // find peer from conversations list
        for (const auto &v : m_conversations) {
            const auto c = v.toObject();
            if (c.value(QStringLiteral("id")).toString() == conversationId
                || c.value(QStringLiteral("_id")).toString() == conversationId) {
                peerId = c.value(QStringLiteral("peer_id")).toString();
                break;
            }
        }
    }
    if (peerId.isEmpty()) {
        setBusy(false);
        setError(QStringLiteral("peer_id_unknown"));
        return;
    }
    m_statusText = plaintext; // temporary hold for post after encrypt
    fetchPeerBundleAndEncrypt(conversationId, peerId, plaintext);
}

void SscApiClient::fetchPeerBundleAndEncrypt(const QString &conversationId, const QString &peerId,
                                             const QString &plaintext)
{
    const QString path = QStringLiteral("/api/prekeys/users/%1/devices/1").arg(peerId);
    auto *reply = m_nam.get(makeRequest(path));
    connect(reply, &QNetworkReply::finished, this,
            [this, reply, conversationId, peerId, plaintext]() {
                reply->deleteLater();
                if (reply->error() != QNetworkReply::NoError) {
                    // session may already exist — try encrypt directly
                    m_crypto->call(
                        QStringLiteral("encryptMessage"),
                        QJsonObject{
                            {QStringLiteral("plaintext"), plaintext},
                            {QStringLiteral("peerId"), peerId},
                            {QStringLiteral("deviceId"), QStringLiteral("1")},
                        },
                        [this, conversationId, plaintext](bool ok, const QJsonObject &result, const QString &err) {
                            if (!ok) {
                                setBusy(false);
                                setError(err);
                                return;
                            }
                            postCiphertext(conversationId, result.value(QStringLiteral("ciphertext")).toString(),
                                           plaintext);
                        });
                    return;
                }
                auto body = QJsonDocument::fromJson(reply->readAll()).object();
                auto bundle = body.value(QStringLiteral("bundle")).toObject();
                if (bundle.isEmpty()) {
                    bundle = body;
                }
                m_crypto->call(
                    QStringLiteral("establishSession"),
                    QJsonObject{
                        {QStringLiteral("peerId"), peerId},
                        {QStringLiteral("deviceId"), QStringLiteral("1")},
                        {QStringLiteral("bundle"), bundle},
                    },
                    [this, conversationId, peerId, plaintext](bool ok, const QJsonObject &, const QString &err) {
                        if (!ok) {
                            // still try encrypt if session already ok
                            qWarning("establishSession: %s", qPrintable(err));
                        }
                        m_crypto->call(
                            QStringLiteral("encryptMessage"),
                            QJsonObject{
                                {QStringLiteral("plaintext"), plaintext},
                                {QStringLiteral("peerId"), peerId},
                                {QStringLiteral("deviceId"), QStringLiteral("1")},
                            },
                            [this, conversationId, plaintext](bool ok2, const QJsonObject &result,
                                                              const QString &err2) {
                                if (!ok2) {
                                    setBusy(false);
                                    setError(err2);
                                    return;
                                }
                                postCiphertext(conversationId,
                                               result.value(QStringLiteral("ciphertext")).toString(), plaintext);
                            });
                    });
            });
}

void SscApiClient::postCiphertext(const QString &conversationId, const QString &ciphertext,
                                  const QString &plaintext)
{
    QJsonObject body{
        {QStringLiteral("ciphertext"), ciphertext},
        {QStringLiteral("protocol"), QStringLiteral("signal_v1")},
    };
    auto *reply = m_nam.post(
        makeRequest(QStringLiteral("/api/conversations/%1/messages").arg(conversationId)),
        QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply, conversationId, plaintext]() {
        reply->deleteLater();
        setBusy(false);
        if (reply->error() != QNetworkReply::NoError) {
            const auto b = reply->readAll();
            const auto obj = QJsonDocument::fromJson(b).object();
            setError(obj.value(QStringLiteral("detail")).toString(reply->errorString()));
            return;
        }
        // optimistic local echo
        QJsonObject local{
            {QStringLiteral("id"), QStringLiteral("local-") + QString::number(QDateTime::currentMSecsSinceEpoch())},
            {QStringLiteral("plaintext"), plaintext},
            {QStringLiteral("mine"), true},
            {QStringLiteral("sender_id"), m_session->userId()},
        };
        m_messages.append(local);
        emit messagesChanged();
        openConversation(conversationId, m_activePeerId);
    });
}

void SscApiClient::startNewDirect(const QString &peerUserId)
{
    if (peerUserId.trimmed().isEmpty()) {
        return;
    }
    setBusy(true);
    QJsonObject body{{QStringLiteral("participant_id"), peerUserId.trimmed()}};
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/conversations")),
                             QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply, peerUserId]() {
        reply->deleteLater();
        setBusy(false);
        if (reply->error() != QNetworkReply::NoError) {
            setError(reply->errorString());
            return;
        }
        auto obj = QJsonDocument::fromJson(reply->readAll()).object();
        auto conv = obj.value(QStringLiteral("conversation")).toObject();
        if (conv.isEmpty()) {
            conv = obj;
        }
        const QString id = conv.value(QStringLiteral("id")).toString(conv.value(QStringLiteral("_id")).toString());
        refreshConversations();
        openConversation(id, peerUserId.trimmed());
    });
}

void SscApiClient::searchUsers(const QString &query)
{
    const QString q = query.trimmed();
    m_userSearchResults = {};
    emit userSearchResultsChanged();
    if (q.isEmpty()) {
        return;
    }
    // Prefer username lookup; falls back to treating input as user id for chat open
    const QString path = QStringLiteral("/api/users/lookup/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(q)));
    auto *reply = m_nam.get(makeRequest(path));
    connect(reply, &QNetworkReply::finished, this, [this, reply, q]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            // try by-username path
            auto *r2 = m_nam.get(makeRequest(QStringLiteral("/api/users/by-username/%1").arg(q)));
            connect(r2, &QNetworkReply::finished, this, [this, r2, q]() {
                r2->deleteLater();
                if (r2->error() != QNetworkReply::NoError) {
                    // still allow direct id usage
                    m_userSearchResults = QJsonArray{QJsonObject{
                        {QStringLiteral("id"), q},
                        {QStringLiteral("display_name"), q},
                        {QStringLiteral("username"), QString()},
                    }};
                    emit userSearchResultsChanged();
                    return;
                }
                auto obj = QJsonDocument::fromJson(r2->readAll()).object();
                auto user = obj.value(QStringLiteral("user")).toObject();
                if (user.isEmpty()) {
                    user = obj;
                }
                m_userSearchResults = QJsonArray{user};
                emit userSearchResultsChanged();
            });
            return;
        }
        auto obj = QJsonDocument::fromJson(reply->readAll()).object();
        auto user = obj.value(QStringLiteral("user")).toObject();
        if (user.isEmpty()) {
            user = obj;
        }
        m_userSearchResults = QJsonArray{user};
        emit userSearchResultsChanged();
    });
}

void SscApiClient::createGroup(const QString &name, const QString &memberIdsCsv)
{
    setBusy(true);
    QJsonArray members;
    const auto parts = memberIdsCsv.split(QRegularExpression(QStringLiteral("[,\\s]+")), Qt::SkipEmptyParts);
    for (const auto &p : parts) {
        members.append(p.trimmed());
    }
    QJsonObject body{
        {QStringLiteral("name"), name.trimmed()},
        {QStringLiteral("member_ids"), members},
    };
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/groups")),
                             QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setBusy(false);
        if (reply->error() != QNetworkReply::NoError) {
            const auto b = reply->readAll();
            const auto obj = QJsonDocument::fromJson(b).object();
            setError(obj.value(QStringLiteral("detail")).toString(reply->errorString()));
            return;
        }
        setStatus(QStringLiteral("Group created"));
        refreshConversations();
    });
}

void SscApiClient::verifyRecovery(const QString &email, const QString &passphrase, const QString &captchaToken)
{
    setBusy(true);
    setError({});
    QJsonObject body{
        {QStringLiteral("email"), email.trimmed()},
        {QStringLiteral("recovery_passphrase"), passphrase},
    };
    if (!captchaToken.isEmpty()) {
        body.insert(QStringLiteral("captcha_token"), captchaToken);
    }
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/auth/recovery/verify")),
                             QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setBusy(false);
        if (reply->error() != QNetworkReply::NoError) {
            const auto b = reply->readAll();
            const auto obj = QJsonDocument::fromJson(b).object();
            setError(obj.value(QStringLiteral("detail")).toString(reply->errorString()));
            return;
        }
        const auto obj = QJsonDocument::fromJson(reply->readAll()).object();
        m_recoveryToken = obj.value(QStringLiteral("recovery_token")).toString();
        if (m_recoveryToken.isEmpty()) {
            setError(QStringLiteral("missing_recovery_token"));
            return;
        }
        emit recoveryTokenReady(m_recoveryToken);
        setStatus(QStringLiteral("Recovery verified — set a new password"));
    });
}

void SscApiClient::resetPassword(const QString &recoveryToken, const QString &newPassword)
{
    setBusy(true);
    QJsonObject body{
        {QStringLiteral("recovery_token"), recoveryToken},
        {QStringLiteral("new_password"), newPassword},
    };
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/auth/recovery/reset-password")),
                             QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setBusy(false);
        if (reply->error() != QNetworkReply::NoError) {
            const auto b = reply->readAll();
            const auto obj = QJsonDocument::fromJson(b).object();
            setError(obj.value(QStringLiteral("detail")).toString(reply->errorString()));
            return;
        }
        const auto obj = QJsonDocument::fromJson(reply->readAll()).object();
        if (obj.contains(QStringLiteral("ws_token"))) {
            applyAuth(obj);
        } else {
            setStatus(QStringLiteral("Password reset — please sign in"));
            emit loginFailed(QStringLiteral("reset_ok_login_required"));
        }
    });
}
