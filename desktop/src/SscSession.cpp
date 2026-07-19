#include "SscSession.h"

#include <QSysInfo>

SscSession::SscSession(QObject *parent)
    : QObject(parent)
    , m_settings(QStringLiteral("SuperSecureChat"), QStringLiteral("SSC"))
{
    // Non-secret prefs only — access tokens stay in memory until Qt Keychain/libsignal FFI
    m_userId = m_settings.value(QStringLiteral("user_id")).toString();
    m_displayName = m_settings.value(QStringLiteral("display_name")).toString();
    if (!m_settings.contains(QStringLiteral("device_id"))) {
        m_settings.setValue(QStringLiteral("device_id"), QStringLiteral("1"));
    }
    // Purge any legacy plaintext token left by older scaffold builds
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
QString SscSession::accessToken() const { return m_token; }

QString SscSession::deviceId() const
{
    return m_settings.value(QStringLiteral("device_id"), QStringLiteral("1")).toString();
}

void SscSession::saveSession(const QString &token, const QString &userId, const QString &displayName)
{
    m_token = token;
    m_userId = userId;
    m_displayName = displayName;
    // Never write bearer token to disk (audit H3) — session is process-lifetime until Keychain lands
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
    m_settings.remove(QStringLiteral("access_token"));
    m_settings.remove(QStringLiteral("user_id"));
    m_settings.remove(QStringLiteral("display_name"));
    emit changed();
}
