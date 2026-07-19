#include "SscCallEngine.h"

#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QJsonDocument>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QTimer>

SscCallEngine::SscCallEngine(SscSession *session, SscApiClient *api, SscCryptoBridge *crypto, QObject *parent)
    : QObject(parent)
    , m_session(session)
    , m_api(api)
    , m_crypto(crypto)
{
    connect(&m_proc, &QProcess::readyReadStandardOutput, this, [this]() {
        m_buf.append(m_proc.readAllStandardOutput());
        while (true) {
            const int nl = m_buf.indexOf('\n');
            if (nl < 0) break;
            const QByteArray line = m_buf.left(nl).trimmed();
            m_buf.remove(0, nl + 1);
            if (!line.isEmpty()) onMediaLine(line);
        }
    });
    connect(&m_proc, &QProcess::readyReadStandardError, this, [this]() {
        const auto err = m_proc.readAllStandardError();
        if (!err.isEmpty()) qWarning("media-worker: %s", err.constData());
    });
    startMediaWorker();
}

SscCallEngine::~SscCallEngine()
{
    hangup();
    stopMediaWorker();
}

void SscCallEngine::setState(const QString &s)
{
    if (m_callState == s) return;
    m_callState = s;
    emit callChanged();
}

void SscCallEngine::startMediaWorker()
{
    if (m_proc.state() != QProcess::NotRunning) return;
    const QString appDir = QCoreApplication::applicationDirPath();
    QString node = qEnvironmentVariable("SSC_NODE_PATH");
    if (node.isEmpty()) {
        const QStringList nodes = {
            appDir + QStringLiteral("/runtime/node/node.exe"),
            QStringLiteral("C:/Program Files/nodejs/node.exe"),
            QStringLiteral("node"),
        };
        for (const auto &n : nodes) {
            if (n == QLatin1String("node") || QFileInfo::exists(n)) {
                node = n;
                break;
            }
        }
    }
    QString worker;
    QStringList cands;
#ifdef SSC_MEDIA_WORKER_DIR
    cands << (QStringLiteral(SSC_MEDIA_WORKER_DIR) + QStringLiteral("/worker.js"));
#endif
    cands << appDir + QStringLiteral("/media-worker/worker.js")
          << appDir + QStringLiteral("/../media-worker/worker.js")
          << QDir(appDir).absoluteFilePath(QStringLiteral("../../../desktop/media-worker/worker.js"));
    for (const auto &c : cands) {
        if (QFileInfo::exists(c)) {
            worker = QFileInfo(c).absoluteFilePath();
            break;
        }
    }
    if (worker.isEmpty()) {
        emit callError(QStringLiteral("media_worker_not_found"));
        return;
    }
    m_proc.setProgram(node);
    m_proc.setArguments({worker});
    m_proc.setWorkingDirectory(QFileInfo(worker).absolutePath());
    m_proc.start();
    m_proc.waitForStarted(5000);
}

void SscCallEngine::stopMediaWorker()
{
    if (m_proc.state() != QProcess::NotRunning) {
        m_proc.kill();
        m_proc.waitForFinished(2000);
    }
    m_pending.clear();
}

void SscCallEngine::mediaCall(const QString &cmd, const QJsonObject &args, ReplyFn cb)
{
    if (m_proc.state() != QProcess::Running) {
        if (cb) cb(false, {}, QStringLiteral("media_worker_not_running"));
        return;
    }
    const int id = m_nextId++;
    m_pending.insert(id, std::move(cb));
    QJsonObject req{{QStringLiteral("id"), id}, {QStringLiteral("cmd"), cmd}, {QStringLiteral("args"), args}};
    m_proc.write(QJsonDocument(req).toJson(QJsonDocument::Compact) + '\n');
}

void SscCallEngine::onMediaLine(const QByteArray &line)
{
    const auto doc = QJsonDocument::fromJson(line);
    if (!doc.isObject()) return;
    const auto obj = doc.object();
    const int id = obj.value(QStringLiteral("id")).toInt();
    if (id == 0 && obj.value(QStringLiteral("ok")).toBool()) {
        m_mediaReady = obj.value(QStringLiteral("result")).toObject().value(QStringLiteral("wrtc")).toBool(true);
        emit mediaReadyChanged();
        return;
    }
    const auto cb = m_pending.take(id);
    if (!cb) return;
    if (obj.value(QStringLiteral("ok")).toBool()) {
        cb(true, obj.value(QStringLiteral("result")).toObject(), {});
    } else {
        cb(false, {}, obj.value(QStringLiteral("error")).toString());
    }
}

void SscCallEngine::fetchIceThen(const std::function<void(QJsonArray)> &cb)
{
    // Use API client network via temporary NAM to avoid expanding SscApiClient further
    auto *nam = new QNetworkAccessManager(this);
    QNetworkRequest req{QUrl(QStringLiteral("https://api.supersecurechat.com/api/calls/ice-servers"))};
    req.setRawHeader("Accept", "application/json");
    req.setRawHeader("X-SSC-Client", "windows/0.4.0/15");
    req.setRawHeader("X-SSC-Native-Bridge", "v1");
    req.setRawHeader("X-SSC-Device-Id", m_session->deviceId().toUtf8());
    if (!m_session->accessToken().isEmpty()) {
        req.setRawHeader("Authorization", ("Bearer " + m_session->accessToken()).toUtf8());
    }
    auto *reply = nam->get(req);
    connect(reply, &QNetworkReply::finished, this, [this, reply, nam, cb]() {
        reply->deleteLater();
        nam->deleteLater();
        QJsonArray ice;
        if (reply->error() == QNetworkReply::NoError) {
            const auto obj = QJsonDocument::fromJson(reply->readAll()).object();
            ice = obj.value(QStringLiteral("iceServers")).toArray();
            if (ice.isEmpty()) ice = obj.value(QStringLiteral("ice_servers")).toArray();
        }
        if (ice.isEmpty()) {
            ice.append(QJsonObject{{QStringLiteral("urls"), QStringLiteral("stun:stun.l.google.com:19302")}});
        }
        m_iceServers = ice;
        cb(ice);
    });
}

void SscCallEngine::encryptAndPostSignal(const QString &signalType, const QJsonObject &payload)
{
    const QString plain = QString::fromUtf8(QJsonDocument(payload).toJson(QJsonDocument::Compact));
    m_crypto->call(QStringLiteral("encryptMessage"),
                   QJsonObject{{QStringLiteral("plaintext"), plain},
                               {QStringLiteral("peerId"), m_peerId},
                               {QStringLiteral("deviceId"), QStringLiteral("1")}},
                   [this, signalType](bool ok, const QJsonObject &result, const QString &err) {
                       if (!ok) {
                           emit callError(err);
                           return;
                       }
                       // Delegate HTTP through a one-shot using same headers pattern as API
                       auto *nam = new QNetworkAccessManager(this);
                       QNetworkRequest req{QUrl(QStringLiteral("https://api.supersecurechat.com/api/calls/signal"))};
                       req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
                       req.setRawHeader("X-SSC-Client", "windows/0.4.0/15");
                       req.setRawHeader("X-SSC-Native-Bridge", "v1");
                       req.setRawHeader("X-SSC-Device-Id", m_session->deviceId().toUtf8());
                       req.setRawHeader("Authorization", ("Bearer " + m_session->accessToken()).toUtf8());
                       QJsonObject body{{QStringLiteral("call_id"), m_callId},
                                        {QStringLiteral("signal_type"), signalType},
                                        {QStringLiteral("ciphertext"), result.value(QStringLiteral("ciphertext")).toString()},
                                        {QStringLiteral("protocol"), QStringLiteral("signal_v1")}};
                       if (!m_peerId.isEmpty()) body.insert(QStringLiteral("target_peer_id"), m_peerId);
                       auto *reply = nam->post(req, QJsonDocument(body).toJson(QJsonDocument::Compact));
                       connect(reply, &QNetworkReply::finished, this, [reply, nam]() {
                           reply->deleteLater();
                           nam->deleteLater();
                       });
                   });
}

void SscCallEngine::startOutgoing(const QString &conversationId, const QString &peerId, bool video)
{
    hangup();
    m_conversationId = conversationId;
    m_peerId = peerId;
    m_video = video;
    m_isCaller = true;
    setState(QStringLiteral("starting"));
    fetchIceThen([this, conversationId, peerId, video](QJsonArray ice) {
        // create call on API
        auto *nam = new QNetworkAccessManager(this);
        QNetworkRequest req{QUrl(QStringLiteral("https://api.supersecurechat.com/api/calls"))};
        req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
        req.setRawHeader("X-SSC-Client", "windows/0.4.0/15");
        req.setRawHeader("X-SSC-Native-Bridge", "v1");
        req.setRawHeader("X-SSC-Device-Id", m_session->deviceId().toUtf8());
        req.setRawHeader("Authorization", ("Bearer " + m_session->accessToken()).toUtf8());
        QJsonObject body{{QStringLiteral("conversation_id"), conversationId},
                         {QStringLiteral("video"), video},
                         {QStringLiteral("callee_id"), peerId}};
        auto *reply = nam->post(req, QJsonDocument(body).toJson(QJsonDocument::Compact));
        connect(reply, &QNetworkReply::finished, this, [this, reply, nam, ice, video]() {
            reply->deleteLater();
            nam->deleteLater();
            if (reply->error() != QNetworkReply::NoError) {
                emit callError(reply->errorString());
                setState(QStringLiteral("failed"));
                return;
            }
            const auto obj = QJsonDocument::fromJson(reply->readAll()).object();
            auto call = obj.value(QStringLiteral("call")).toObject();
            if (call.isEmpty()) call = obj;
            m_callId = call.value(QStringLiteral("id")).toString(call.value(QStringLiteral("_id")).toString());
            emit callChanged();
            setState(QStringLiteral("connecting"));
            mediaCall(QStringLiteral("create"),
                      QJsonObject{{QStringLiteral("callId"), m_callId},
                                  {QStringLiteral("iceServers"), ice},
                                  {QStringLiteral("video"), video}},
                      [this](bool ok, QJsonObject, QString err) {
                          if (!ok) {
                              emit callError(err);
                              return;
                          }
                          mediaCall(QStringLiteral("createOffer"),
                                    QJsonObject{{QStringLiteral("callId"), m_callId},
                                                {QStringLiteral("video"), m_video}},
                                    [this](bool ok2, QJsonObject result, QString err2) {
                                        if (!ok2) {
                                            emit callError(err2);
                                            return;
                                        }
                                        encryptAndPostSignal(QStringLiteral("offer"),
                                                             QJsonObject{{QStringLiteral("sdp"),
                                                                          QJsonObject{{QStringLiteral("type"),
                                                                                       result.value(QStringLiteral("type"))},
                                                                                      {QStringLiteral("sdp"),
                                                                                       result.value(QStringLiteral("sdp"))}}},
                                                                         {QStringLiteral("ice"),
                                                                          result.value(QStringLiteral("ice"))}});
                                        setState(QStringLiteral("ringing"));
                                    });
                      });
        });
    });
}

void SscCallEngine::acceptIncoming(const QString &callId, const QString &peerId, bool video)
{
    m_callId = callId;
    m_peerId = peerId;
    m_video = video;
    m_isCaller = false;
    emit callChanged();
    setState(QStringLiteral("connecting"));
    fetchIceThen([this, callId, video](QJsonArray ice) {
        mediaCall(QStringLiteral("create"),
                  QJsonObject{{QStringLiteral("callId"), callId},
                              {QStringLiteral("iceServers"), ice},
                              {QStringLiteral("video"), video}},
                  [this](bool ok, QJsonObject, QString err) {
                      if (!ok) emit callError(err);
                      else setState(QStringLiteral("ready_for_offer"));
                  });
    });
}

void SscCallEngine::onSignalPayload(const QString &signalType, const QString &plaintextJson)
{
    if (m_callId.isEmpty()) return;
    const auto payload = QJsonDocument::fromJson(plaintextJson.toUtf8()).object();
    if (signalType == QLatin1String("offer")) {
        const auto sdp = payload.value(QStringLiteral("sdp")).toObject();
        mediaCall(QStringLiteral("setRemote"),
                  QJsonObject{{QStringLiteral("callId"), m_callId},
                              {QStringLiteral("type"), sdp.value(QStringLiteral("type")).toString(QStringLiteral("offer"))},
                              {QStringLiteral("sdp"), sdp.value(QStringLiteral("sdp")).toString()}},
                  [this, payload](bool ok, QJsonObject, QString err) {
                      if (!ok) {
                          emit callError(err);
                          return;
                      }
                      // add remote ice
                      const auto ice = payload.value(QStringLiteral("ice")).toArray();
                      for (const auto &v : ice) {
                          mediaCall(QStringLiteral("addIce"),
                                    QJsonObject{{QStringLiteral("callId"), m_callId},
                                                {QStringLiteral("candidate"), v.toObject()}},
                                    {});
                      }
                      mediaCall(QStringLiteral("createAnswer"),
                                QJsonObject{{QStringLiteral("callId"), m_callId}, {QStringLiteral("video"), m_video}},
                                [this](bool ok2, QJsonObject result, QString err2) {
                                    if (!ok2) {
                                        emit callError(err2);
                                        return;
                                    }
                                    encryptAndPostSignal(
                                        QStringLiteral("answer"),
                                        QJsonObject{{QStringLiteral("sdp"),
                                                     QJsonObject{{QStringLiteral("type"), result.value(QStringLiteral("type"))},
                                                                 {QStringLiteral("sdp"), result.value(QStringLiteral("sdp"))}}},
                                                    {QStringLiteral("ice"), result.value(QStringLiteral("ice"))}});
                                    setState(QStringLiteral("connected"));
                                });
                  });
    } else if (signalType == QLatin1String("answer")) {
        const auto sdp = payload.value(QStringLiteral("sdp")).toObject();
        mediaCall(QStringLiteral("setRemote"),
                  QJsonObject{{QStringLiteral("callId"), m_callId},
                              {QStringLiteral("type"), sdp.value(QStringLiteral("type")).toString(QStringLiteral("answer"))},
                              {QStringLiteral("sdp"), sdp.value(QStringLiteral("sdp")).toString()}},
                  [this, payload](bool ok, QJsonObject, QString err) {
                      if (!ok) {
                          emit callError(err);
                          return;
                      }
                      const auto ice = payload.value(QStringLiteral("ice")).toArray();
                      for (const auto &v : ice) {
                          mediaCall(QStringLiteral("addIce"),
                                    QJsonObject{{QStringLiteral("callId"), m_callId},
                                                {QStringLiteral("candidate"), v.toObject()}},
                                    {});
                      }
                      setState(QStringLiteral("connected"));
                  });
    } else if (signalType == QLatin1String("ice") || signalType == QLatin1String("candidate")) {
        mediaCall(QStringLiteral("addIce"),
                  QJsonObject{{QStringLiteral("callId"), m_callId},
                              {QStringLiteral("candidate"), payload.value(QStringLiteral("candidate")).toObject()}},
                  {});
    }
}

void SscCallEngine::hangup()
{
    if (!m_callId.isEmpty()) {
        m_api->endCall(m_callId, QStringLiteral("ended"));
        mediaCall(QStringLiteral("close"), QJsonObject{{QStringLiteral("callId"), m_callId}}, {});
    }
    m_callId.clear();
    m_peerId.clear();
    m_video = false;
    setState(QStringLiteral("idle"));
    emit callChanged();
}

void SscCallEngine::joinSfuRoom(const QString &wsUrl, const QString &roomId, const QString &joinToken)
{
    if (roomId.isEmpty() || wsUrl.isEmpty()) {
        emit callError(QStringLiteral("sfu_join_missing_params"));
        return;
    }
    if (m_proc.state() != QProcess::Running) startMediaWorker();
    m_sfuRoomId = roomId;
    m_sfuState = QStringLiteral("joining…");
    emit sfuChanged();
    const QString peerId = QStringLiteral("win-%1").arg(m_session->deviceId().left(8));
    mediaCall(QStringLiteral("sfuJoin"),
              QJsonObject{{QStringLiteral("wsUrl"), wsUrl},
                          {QStringLiteral("roomId"), roomId},
                          {QStringLiteral("joinToken"), joinToken},
                          {QStringLiteral("peerId"), peerId}},
              [this, roomId](bool ok, QJsonObject result, QString err) {
                  if (!ok) {
                      m_sfuState = QStringLiteral("join_failed: ") + err;
                      emit sfuChanged();
                      emit callError(err);
                      return;
                  }
                  m_sfuRoomId = roomId;
                  const int existing = result.value(QStringLiteral("existingProducers")).toInt();
                  m_sfuState = QStringLiteral("joined (peers producers: %1)").arg(existing);
                  emit sfuChanged();
                  emit sfuJoined(roomId, existing);
              });
}

void SscCallEngine::leaveSfuRoom()
{
    if (m_sfuRoomId.isEmpty()) return;
    const QString rid = m_sfuRoomId;
    mediaCall(QStringLiteral("sfuLeave"), QJsonObject{{QStringLiteral("roomId"), rid}},
              [this](bool, QJsonObject, QString) {
                  m_sfuRoomId.clear();
                  m_sfuState = QStringLiteral("left");
                  emit sfuChanged();
              });
}
