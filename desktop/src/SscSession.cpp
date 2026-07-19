#include "SscSession.h"

#include <QStandardPaths>
#include <QDir>
#include <QUuid>

SscSession::SscSession(QObject *parent)
    : QObject(parent)
    , m_settings(QStringLiteral("SuperSecureChat"), QStringLiteral("SSC"))
{
    m_userId = m_settings.value(QStringLiteral("user_id")).toString();
    m_displayName = m_settings.value(QStringLiteral("display_name")).toString();
    m_username = m_settings.value(QStringLiteral("username")).toString();
    if (!m_settings.contains(QStringLiteral("device_id"))) {
        m_settings.setValue(QStringLiteral("device_id"), QStringLiteral("1"));
    }
    // Never persist access token (audit H3)
    if (m_settings.contains(QStringLiteral("access_token"))) {
        m_settings.remove(QStringLiteral("access_token"));
    }
}

bool SscSession::loggedIn() const
{
    return !m_token.isEmpty() && !m_userId.isEmpty();
}

QString SscSession::userId() const { return m_userId; }
QString SscSession::displayName() const { return m_displayName; }
QString SscSession::username() const { return m_username; }
QString SscSession::accessToken() const { return m_token; }

QString SscSession::deviceId() const
{
    return m_settings.value(QStringLiteral("device_id"), QStringLiteral("1")).toString();
}

QString SscSession::signalStorePath() const
{
    const QString base = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(base);
    // libsignalSession nests ssc-signal under this path
    return base;
}

bool SscSession::sealedSenderEnabled() const
{
    return m_settings.value(QStringLiteral("sealed_sender"), true).toBool();
}

void SscSession::setSealedSenderEnabled(bool on)
{
    m_settings.setValue(QStringLiteral("sealed_sender"), on);
    emit changed();
}

void SscSession::saveSession(const QString &token, const QString &userId, const QString &displayName,
                             const QString &username)
{
    m_token = token;
    m_userId = userId;
    m_displayName = displayName;
    if (!username.isEmpty()) {
        m_username = username;
        m_settings.setValue(QStringLiteral("username"), username);
    }
    m_settings.setValue(QStringLiteral("user_id"), userId);
    m_settings.setValue(QStringLiteral("display_name"), displayName);
    m_settings.remove(QStringLiteral("access_token"));
    emit changed();
}

void SscSession::clear()
{
    m_token.clear();
    m_userId.clear();
    m_displayName.clear();
    m_username.clear();
    m_settings.remove(QStringLiteral("access_token"));
    m_settings.remove(QStringLiteral("user_id"));
    m_settings.remove(QStringLiteral("display_name"));
    m_settings.remove(QStringLiteral("username"));
    emit changed();
}
