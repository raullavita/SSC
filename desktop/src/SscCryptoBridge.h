#pragma once

#include <QObject>
#include <QProcess>
#include <QJsonObject>
#include <QHash>
#include <functional>

/**
 * Spawns Node crypto-worker with @signalapp/libsignal-client 0.96.4
 * (same protocol version as Android libsignal-android).
 */
class SscCryptoBridge : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool ready READ ready NOTIFY readyChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)
public:
    explicit SscCryptoBridge(QObject *parent = nullptr);
    ~SscCryptoBridge() override;

    bool ready() const { return m_ready; }
    QString lastError() const { return m_lastError; }

    /** Start worker; userDataDir is where Signal store lives. */
    Q_INVOKABLE void start(const QString &userDataDir);
    Q_INVOKABLE void stop();

    Q_INVOKABLE void configure(const QString &localUserId, const QString &deviceId = QStringLiteral("1"));
    Q_INVOKABLE void generateAndUploadReady(); // signals prekeyBundleReady
    Q_INVOKABLE void encryptMessage(const QString &plaintext, const QString &peerId, const QString &deviceId = QStringLiteral("1"));
    Q_INVOKABLE void decryptMessage(const QString &ciphertext, const QString &peerId, const QString &deviceId = QStringLiteral("1"));
    Q_INVOKABLE void establishSession(const QString &peerId, const QJsonObject &bundle, const QString &deviceId = QStringLiteral("1"));

    using ReplyFn = std::function<void(bool ok, const QJsonObject &result, const QString &error)>;
    void call(const QString &cmd, const QJsonObject &args, ReplyFn cb);

signals:
    void readyChanged();
    void lastErrorChanged();
    void prekeyBundleReady(const QJsonObject &bundle);
    void encryptFinished(bool ok, const QString &ciphertext, const QString &error);
    void decryptFinished(bool ok, const QString &plaintext, const QString &error);
    void sessionEstablished(bool ok, const QString &error);

private:
    void setError(const QString &e);
    void onReadyRead();
    void onProcessError();
    QString resolveWorkerScript() const;
    QString resolveNode() const;

    QProcess m_proc;
    QByteArray m_buf;
    bool m_ready = false;
    QString m_lastError;
    QString m_userDataDir;
    int m_nextId = 1;
    QHash<int, ReplyFn> m_pending;
};
