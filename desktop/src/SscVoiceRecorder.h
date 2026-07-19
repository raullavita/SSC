#pragma once

#include <QObject>
#include <QString>
#include <QByteArray>
#include <QMutex>
#include <atomic>

/**
 * Windows mic capture to WAV (Android VoiceNoteRecorder analogue).
 * Uses WinMM waveIn — no Qt Multimedia dependency.
 */
class SscVoiceRecorder : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool recording READ recording NOTIFY recordingChanged)
    Q_PROPERTY(QString lastPath READ lastPath NOTIFY lastPathChanged)
public:
    explicit SscVoiceRecorder(QObject *parent = nullptr);
    ~SscVoiceRecorder() override;

    bool recording() const { return m_recording.load(); }
    QString lastPath() const { return m_lastPath; }

    Q_INVOKABLE bool start();
    /** Stop and return absolute path to WAV file (empty on failure). */
    Q_INVOKABLE QString stop();
    Q_INVOKABLE void cancel();

    // Used by waveIn callback (same translation unit)
    void onBufferDone(const char *data, int bytes);
    bool isRecordingAtomic() const { return m_recording.load(); }
    void *waveInHandle() const { return m_hWaveIn; }

signals:
    void recordingChanged();
    void lastPathChanged();
    void recordError(const QString &detail);

private:
    bool writeWav(const QString &path, const QByteArray &pcm) const;

    std::atomic<bool> m_recording{false};
    QString m_lastPath;
    QByteArray m_pcm;
    mutable QMutex m_mutex;
    void *m_hWaveIn = nullptr;
    void *m_hdrs[2] = {nullptr, nullptr};
    char *m_bufs[2] = {nullptr, nullptr};
    static constexpr int kSampleRate = 16000;
    static constexpr int kChannels = 1;
    static constexpr int kBits = 16;
    static constexpr int kBufMs = 200;
};
