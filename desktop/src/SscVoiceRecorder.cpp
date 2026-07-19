#include "SscVoiceRecorder.h"

#include <QStandardPaths>
#include <QDir>
#include <QDateTime>
#include <QFile>
#include <QIODevice>

#ifdef Q_OS_WIN
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <mmsystem.h>
#pragma comment(lib, "winmm.lib")
#endif

#ifdef Q_OS_WIN
void CALLBACK sscWaveInProc(HWAVEIN, UINT uMsg, DWORD_PTR dwInstance, DWORD_PTR dwParam1, DWORD_PTR)
{
    if (uMsg != WIM_DATA || !dwInstance) return;
    auto *self = reinterpret_cast<SscVoiceRecorder *>(dwInstance);
    auto *hdr = reinterpret_cast<WAVEHDR *>(dwParam1);
    if (hdr && hdr->dwBytesRecorded > 0) {
        self->onBufferDone(hdr->lpData, static_cast<int>(hdr->dwBytesRecorded));
    }
    if (self->isRecordingAtomic() && hdr && self->waveInHandle()) {
        waveInAddBuffer(reinterpret_cast<HWAVEIN>(self->waveInHandle()), hdr, sizeof(WAVEHDR));
    }
}
#endif

SscVoiceRecorder::SscVoiceRecorder(QObject *parent)
    : QObject(parent)
{
}

SscVoiceRecorder::~SscVoiceRecorder()
{
    cancel();
}

void SscVoiceRecorder::onBufferDone(const char *data, int bytes)
{
    QMutexLocker lock(&m_mutex);
    if (m_recording && data && bytes > 0) {
        m_pcm.append(data, bytes);
    }
}

bool SscVoiceRecorder::start()
{
#ifndef Q_OS_WIN
    emit recordError(QStringLiteral("voice_record_windows_only"));
    return false;
#else
    if (m_recording) return true;
    cancel();
    {
        QMutexLocker lock(&m_mutex);
        m_pcm.clear();
    }

    WAVEFORMATEX fmt{};
    fmt.wFormatTag = WAVE_FORMAT_PCM;
    fmt.nChannels = kChannels;
    fmt.nSamplesPerSec = kSampleRate;
    fmt.wBitsPerSample = kBits;
    fmt.nBlockAlign = static_cast<WORD>((fmt.nChannels * fmt.wBitsPerSample) / 8);
    fmt.nAvgBytesPerSec = fmt.nSamplesPerSec * fmt.nBlockAlign;
    fmt.cbSize = 0;

    HWAVEIN h = nullptr;
    const MMRESULT openRes =
        waveInOpen(&h, WAVE_MAPPER, &fmt, reinterpret_cast<DWORD_PTR>(sscWaveInProc),
                   reinterpret_cast<DWORD_PTR>(this), CALLBACK_FUNCTION);
    if (openRes != MMSYSERR_NOERROR) {
        emit recordError(QStringLiteral("waveInOpen_failed:%1").arg(openRes));
        return false;
    }
    m_hWaveIn = h;

    const int bufBytes = (kSampleRate * kChannels * (kBits / 8) * kBufMs) / 1000;
    for (int i = 0; i < 2; ++i) {
        m_bufs[i] = new char[bufBytes];
        auto *hdr = new WAVEHDR{};
        hdr->lpData = m_bufs[i];
        hdr->dwBufferLength = static_cast<DWORD>(bufBytes);
        hdr->dwFlags = 0;
        m_hdrs[i] = hdr;
        waveInPrepareHeader(h, hdr, sizeof(WAVEHDR));
        waveInAddBuffer(h, hdr, sizeof(WAVEHDR));
    }

    if (waveInStart(h) != MMSYSERR_NOERROR) {
        emit recordError(QStringLiteral("waveInStart_failed"));
        cancel();
        return false;
    }
    m_recording = true;
    emit recordingChanged();
    return true;
#endif
}

QString SscVoiceRecorder::stop()
{
#ifndef Q_OS_WIN
    return {};
#else
    if (!m_recording) return m_lastPath;
    m_recording = false;
    emit recordingChanged();

    HWAVEIN h = reinterpret_cast<HWAVEIN>(m_hWaveIn);
    if (h) {
        waveInStop(h);
        waveInReset(h);
    }

    QByteArray pcm;
    {
        QMutexLocker lock(&m_mutex);
        pcm = m_pcm;
        m_pcm.clear();
    }

    // teardown headers
    if (h) {
        for (int i = 0; i < 2; ++i) {
            if (m_hdrs[i]) {
                auto *hdr = reinterpret_cast<WAVEHDR *>(m_hdrs[i]);
                waveInUnprepareHeader(h, hdr, sizeof(WAVEHDR));
                delete hdr;
                m_hdrs[i] = nullptr;
            }
            delete[] m_bufs[i];
            m_bufs[i] = nullptr;
        }
        waveInClose(h);
        m_hWaveIn = nullptr;
    }

    if (pcm.isEmpty()) {
        emit recordError(QStringLiteral("empty_recording"));
        return {};
    }

    const QString dir = QStandardPaths::writableLocation(QStandardPaths::TempLocation);
    const QString path = dir + QStringLiteral("/ssc_voice_%1.wav")
                                    .arg(QDateTime::currentMSecsSinceEpoch());
    if (!writeWav(path, pcm)) {
        emit recordError(QStringLiteral("wav_write_failed"));
        return {};
    }
    m_lastPath = path;
    emit lastPathChanged();
    return path;
#endif
}

void SscVoiceRecorder::cancel()
{
#ifdef Q_OS_WIN
    const bool was = m_recording;
    m_recording = false;
    if (was) emit recordingChanged();
    HWAVEIN h = reinterpret_cast<HWAVEIN>(m_hWaveIn);
    if (h) {
        waveInStop(h);
        waveInReset(h);
        for (int i = 0; i < 2; ++i) {
            if (m_hdrs[i]) {
                auto *hdr = reinterpret_cast<WAVEHDR *>(m_hdrs[i]);
                waveInUnprepareHeader(h, hdr, sizeof(WAVEHDR));
                delete hdr;
                m_hdrs[i] = nullptr;
            }
            delete[] m_bufs[i];
            m_bufs[i] = nullptr;
        }
        waveInClose(h);
        m_hWaveIn = nullptr;
    }
    QMutexLocker lock(&m_mutex);
    m_pcm.clear();
#else
    m_recording = false;
#endif
}

bool SscVoiceRecorder::writeWav(const QString &path, const QByteArray &pcm) const
{
    QFile f(path);
    if (!f.open(QIODevice::WriteOnly)) return false;
    const quint32 dataSize = static_cast<quint32>(pcm.size());
    const quint32 byteRate = kSampleRate * kChannels * (kBits / 8);
    const quint16 blockAlign = kChannels * (kBits / 8);
    const quint32 riffSize = 36 + dataSize;

    QByteArray header;
    QDataStream ds(&header, QIODevice::WriteOnly);
    ds.setByteOrder(QDataStream::LittleEndian);
    // RIFF header via raw bytes for simplicity
    f.write("RIFF", 4);
    quint32 leRiff = riffSize;
    f.write(reinterpret_cast<const char *>(&leRiff), 4);
    f.write("WAVEfmt ", 8);
    quint32 fmtSize = 16;
    f.write(reinterpret_cast<const char *>(&fmtSize), 4);
    quint16 audioFormat = 1;
    f.write(reinterpret_cast<const char *>(&audioFormat), 2);
    quint16 ch = kChannels;
    f.write(reinterpret_cast<const char *>(&ch), 2);
    quint32 sr = kSampleRate;
    f.write(reinterpret_cast<const char *>(&sr), 4);
    f.write(reinterpret_cast<const char *>(&byteRate), 4);
    f.write(reinterpret_cast<const char *>(&blockAlign), 2);
    quint16 bits = kBits;
    f.write(reinterpret_cast<const char *>(&bits), 2);
    f.write("data", 4);
    f.write(reinterpret_cast<const char *>(&dataSize), 4);
    f.write(pcm);
    f.close();
    return true;
}
