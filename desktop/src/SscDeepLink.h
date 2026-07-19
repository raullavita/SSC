#pragma once

#include <QObject>
#include <QString>
#include <QLocalServer>
#include <QLocalSocket>

/**
 * Single-instance + deep link (ssc://auth/google?oauth_code=...).
 * Second process forwards the URL to the first, then exits.
 */
class SscDeepLink : public QObject
{
    Q_OBJECT
public:
    explicit SscDeepLink(QObject *parent = nullptr);
    ~SscDeepLink() override;

    /** Returns false if another instance is already running (this process should exit). */
    bool claimPrimaryInstance(const QStringList &args);
    static QString extractOAuthCode(const QString &raw);
    static QString findDeepLinkArg(const QStringList &args);

signals:
    void oauthCodeReceived(const QString &code);
    void deepLinkReceived(const QString &url);

private:
    void onNewConnection();
    void handlePayload(const QByteArray &payload);

    QLocalServer m_server;
    static constexpr const char *kServerName = "SuperSecureChat.SSC.Desktop.v1";
};
