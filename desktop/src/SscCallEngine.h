#pragma once

#include <QObject>
#include <QProcess>
#include <QJsonObject>
#include <QJsonArray>
#include <QHash>
#include <functional>
#include "SscApiClient.h"
#include "SscCryptoBridge.h"
#include "SscSession.h"

/**
 * 1:1 call orchestration: ICE servers + /api/calls + encrypted signaling
 * + media-worker WebRTC (audio). Parity with Android WebRtcCallSession path.
 */
class SscCallEngine : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString callId READ callId NOTIFY callChanged)
    Q_PROPERTY(QString callState READ callState NOTIFY callChanged)
    Q_PROPERTY(bool inCall READ inCall NOTIFY callChanged)
    Q_PROPERTY(bool mediaReady READ mediaReady NOTIFY mediaReadyChanged)
public:
    explicit SscCallEngine(SscSession *session, SscApiClient *api, SscCryptoBridge *crypto,
                           QObject *parent = nullptr);
    ~SscCallEngine() override;

    QString callId() const { return m_callId; }
    QString callState() const { return m_callState; }
    bool inCall() const { return !m_callId.isEmpty(); }
    bool mediaReady() const { return m_mediaReady; }

    Q_INVOKABLE void startOutgoing(const QString &conversationId, const QString &peerId, bool video = false);
    Q_INVOKABLE void acceptIncoming(const QString &callId, const QString &peerId, bool video = false);
    Q_INVOKABLE void hangup();
    Q_INVOKABLE void onSignalPayload(const QString &signalType, const QString &plaintextJson);

signals:
    void callChanged();
    void mediaReadyChanged();
    void callError(const QString &detail);

private:
    using ReplyFn = std::function<void(bool, QJsonObject, QString)>;
    void mediaCall(const QString &cmd, const QJsonObject &args, ReplyFn cb);
    void startMediaWorker();
    void stopMediaWorker();
    void setState(const QString &s);
    void fetchIceThen(const std::function<void(QJsonArray)> &cb);
    void postSignal(const QString &signalType, const QJsonObject &payload);
    void encryptAndPostSignal(const QString &signalType, const QJsonObject &payload);
    void onMediaLine(const QByteArray &line);

    SscSession *m_session = nullptr;
    SscApiClient *m_api = nullptr;
    SscCryptoBridge *m_crypto = nullptr;
    QProcess m_proc;
    QByteArray m_buf;
    QHash<int, ReplyFn> m_pending;
    int m_nextId = 1;
    QString m_callId;
    QString m_peerId;
    QString m_conversationId;
    QString m_callState;
    QJsonArray m_iceServers;
    bool m_mediaReady = false;
    bool m_isCaller = false;
    bool m_video = false;
};
