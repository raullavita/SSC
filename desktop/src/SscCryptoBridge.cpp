#include "SscCryptoBridge.h"

#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QJsonDocument>
#include <QStandardPaths>
#include <QProcessEnvironment>

SscCryptoBridge::SscCryptoBridge(QObject *parent)
    : QObject(parent)
{
    connect(&m_proc, &QProcess::readyReadStandardOutput, this, &SscCryptoBridge::onReadyRead);
    connect(&m_proc, &QProcess::errorOccurred, this, [this](QProcess::ProcessError) { onProcessError(); });
    connect(&m_proc, &QProcess::readyReadStandardError, this, [this]() {
        const QByteArray err = m_proc.readAllStandardError();
        if (!err.isEmpty()) {
            qWarning("crypto-worker stderr: %s", err.constData());
        }
    });
}

SscCryptoBridge::~SscCryptoBridge()
{
    stop();
}

QString SscCryptoBridge::resolveNode() const
{
    const QString fromEnv = qEnvironmentVariable("SSC_NODE_PATH");
    if (!fromEnv.isEmpty() && QFileInfo::exists(fromEnv)) {
        return fromEnv;
    }
    const QString appDir = QCoreApplication::applicationDirPath();
    // Prefer bundled portable Node next to the EXE (no system install required)
    const QStringList bundled = {
        appDir + QStringLiteral("/runtime/node/node.exe"),
        appDir + QStringLiteral("/node/node.exe"),
        appDir + QStringLiteral("/runtime/node.exe"),
    };
    for (const auto &c : bundled) {
        if (QFileInfo::exists(c)) {
            return c;
        }
    }
#ifdef Q_OS_WIN
    const QStringList candidates = {
        QStringLiteral("C:/Program Files/nodejs/node.exe"),
        QStringLiteral("C:/Program Files (x86)/nodejs/node.exe"),
    };
    for (const auto &c : candidates) {
        if (QFileInfo::exists(c)) {
            return c;
        }
    }
#endif
    return QStringLiteral("node");
}

QString SscCryptoBridge::resolveWorkerScript() const
{
    const QString fromEnv = qEnvironmentVariable("SSC_CRYPTO_WORKER");
    if (!fromEnv.isEmpty() && QFileInfo::exists(fromEnv)) {
        return fromEnv;
    }
    // Dev: <repo>/desktop/crypto-worker/worker.js next to app or source
    const QString appDir = QCoreApplication::applicationDirPath();
    const QStringList candidates = {
        appDir + QStringLiteral("/crypto-worker/worker.js"),
        appDir + QStringLiteral("/../crypto-worker/worker.js"),
        appDir + QStringLiteral("/../../crypto-worker/worker.js"),
        QDir(appDir).absoluteFilePath(QStringLiteral("../../../desktop/crypto-worker/worker.js")),
    };
    for (const auto &c : candidates) {
        if (QFileInfo::exists(c)) {
            return QFileInfo(c).absoluteFilePath();
        }
    }
    // Source tree relative to CMAKE_SOURCE_DIR baked at compile time if defined
#ifdef SSC_CRYPTO_WORKER_DIR
    const QString src = QStringLiteral(SSC_CRYPTO_WORKER_DIR) + QStringLiteral("/worker.js");
    if (QFileInfo::exists(src)) {
        return src;
    }
#endif
    return {};
}

void SscCryptoBridge::start(const QString &userDataDir)
{
    stop();
    m_userDataDir = userDataDir;
    QDir().mkpath(userDataDir);

    const QString worker = resolveWorkerScript();
    if (worker.isEmpty()) {
        setError(QStringLiteral("crypto_worker_not_found"));
        return;
    }
    const QString node = resolveNode();
    m_proc.setProgram(node);
    m_proc.setArguments({worker});
    m_proc.setWorkingDirectory(QFileInfo(worker).absolutePath());
    m_proc.setProcessChannelMode(QProcess::SeparateChannels);
    m_proc.start();
    if (!m_proc.waitForStarted(8000)) {
        setError(QStringLiteral("crypto_worker_start_failed: ") + m_proc.errorString());
        return;
    }
}

void SscCryptoBridge::stop()
{
    if (m_proc.state() != QProcess::NotRunning) {
        m_proc.kill();
        m_proc.waitForFinished(2000);
    }
    m_pending.clear();
    m_buf.clear();
    if (m_ready) {
        m_ready = false;
        emit readyChanged();
    }
}

void SscCryptoBridge::setError(const QString &e)
{
    m_lastError = e;
    emit lastErrorChanged();
}

void SscCryptoBridge::call(const QString &cmd, const QJsonObject &args, ReplyFn cb)
{
    if (m_proc.state() != QProcess::Running) {
        if (cb) {
            cb(false, {}, QStringLiteral("crypto_worker_not_running"));
        }
        return;
    }
    const int id = m_nextId++;
    m_pending.insert(id, std::move(cb));
    QJsonObject req{{QStringLiteral("id"), id}, {QStringLiteral("cmd"), cmd}, {QStringLiteral("args"), args}};
    const QByteArray line = QJsonDocument(req).toJson(QJsonDocument::Compact) + '\n';
    m_proc.write(line);
}

void SscCryptoBridge::configure(const QString &localUserId, const QString &deviceId)
{
    QJsonObject args{
        {QStringLiteral("userDataPath"), m_userDataDir},
        {QStringLiteral("localUserId"), localUserId},
        {QStringLiteral("deviceId"), deviceId},
    };
    call(QStringLiteral("configure"), args, [this](bool ok, const QJsonObject &, const QString &err) {
        if (!ok) {
            setError(err);
        }
    });
}

void SscCryptoBridge::generateAndUploadReady()
{
    // Match Android: generatePreKeyBatch(50) then map to server payload
    call(QStringLiteral("generatePreKeyBatch"), QJsonObject{{QStringLiteral("count"), 50}},
         [this](bool ok, const QJsonObject &result, const QString &err) {
             if (!ok) {
                 setError(err);
                 emit prekeyBundleReady({});
                 return;
             }
             emit prekeyBundleReady(result);
         });
}

void SscCryptoBridge::encryptMessage(const QString &plaintext, const QString &peerId, const QString &deviceId)
{
    QJsonObject args{
        {QStringLiteral("plaintext"), plaintext},
        {QStringLiteral("peerId"), peerId},
        {QStringLiteral("deviceId"), deviceId},
    };
    call(QStringLiteral("encryptMessage"), args, [this](bool ok, const QJsonObject &result, const QString &err) {
        if (!ok) {
            emit encryptFinished(false, {}, err);
            return;
        }
        emit encryptFinished(true, result.value(QStringLiteral("ciphertext")).toString(), {});
    });
}

void SscCryptoBridge::decryptMessage(const QString &ciphertext, const QString &peerId, const QString &deviceId)
{
    QJsonObject args{
        {QStringLiteral("ciphertext"), ciphertext},
        {QStringLiteral("peerId"), peerId},
        {QStringLiteral("deviceId"), deviceId},
    };
    call(QStringLiteral("decryptMessage"), args, [this](bool ok, const QJsonObject &result, const QString &err) {
        if (!ok) {
            emit decryptFinished(false, {}, err);
            return;
        }
        emit decryptFinished(true, result.value(QStringLiteral("plaintext")).toString(), {});
    });
}

void SscCryptoBridge::establishSession(const QString &peerId, const QJsonObject &bundle, const QString &deviceId)
{
    QJsonObject args{
        {QStringLiteral("peerId"), peerId},
        {QStringLiteral("deviceId"), deviceId},
        {QStringLiteral("bundle"), bundle},
    };
    call(QStringLiteral("establishSession"), args, [this](bool ok, const QJsonObject &, const QString &err) {
        emit sessionEstablished(ok, err);
    });
}

void SscCryptoBridge::onReadyRead()
{
    m_buf.append(m_proc.readAllStandardOutput());
    while (true) {
        const int nl = m_buf.indexOf('\n');
        if (nl < 0) {
            break;
        }
        const QByteArray line = m_buf.left(nl).trimmed();
        m_buf.remove(0, nl + 1);
        if (line.isEmpty()) {
            continue;
        }
        const auto doc = QJsonDocument::fromJson(line);
        if (!doc.isObject()) {
            continue;
        }
        const auto obj = doc.object();
        const int id = obj.value(QStringLiteral("id")).toInt();
        if (id == 0 && obj.value(QStringLiteral("ok")).toBool()) {
            // ready banner
            if (!m_ready) {
                m_ready = true;
                emit readyChanged();
            }
            // auto-configure root
            if (!m_userDataDir.isEmpty()) {
                QJsonObject args{{QStringLiteral("userDataPath"), m_userDataDir}};
                call(QStringLiteral("configure"), args, {});
            }
            continue;
        }
        const auto cb = m_pending.take(id);
        if (!cb) {
            continue;
        }
        const bool ok = obj.value(QStringLiteral("ok")).toBool();
        if (ok) {
            cb(true, obj.value(QStringLiteral("result")).toObject(), {});
        } else {
            cb(false, {}, obj.value(QStringLiteral("error")).toString());
        }
    }
}

void SscCryptoBridge::onProcessError()
{
    setError(QStringLiteral("crypto_worker_process_error: ") + m_proc.errorString());
    if (m_ready) {
        m_ready = false;
        emit readyChanged();
    }
}
