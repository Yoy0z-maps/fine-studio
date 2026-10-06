package expo.modules.pcmstream

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Process
import java.util.concurrent.atomic.AtomicReference

internal class FrequencyRange(val minimum: Double, val maximum: Double)

internal class CaptureException(val code: String, message: String) : Exception(message)

/**
 * Records the microphone on a dedicated urgent-audio thread and runs a [PitchAnalyzer] on every
 * hop. Construction opens the recorder; [stop] must be called to release it.
 */
internal class PitchCapture(
  audioManager: AudioManager,
  windowSize: Int,
  private val hopSize: Int,
  silenceThreshold: Double,
  private val range: AtomicReference<FrequencyRange>,
  private val onResult: (PitchAnalyzer.Result) -> Unit,
  private val onError: (String) -> Unit,
) {
  private val record: AudioRecord = openRecord(audioManager, hopSize)
  val sampleRate: Int = record.sampleRate
  private val analyzer: PitchAnalyzer = try {
    PitchAnalyzer(windowSize, hopSize, sampleRate.toDouble(), silenceThreshold)
  } catch (e: IllegalArgumentException) {
    record.release() // don't leak the recorder this constructor already opened
    throw CaptureException("ERR_PITCH_STREAM_OPTIONS", e.message ?: "Invalid pitch stream options")
  }

  @Volatile
  private var running = false
  private var thread: Thread? = null

  fun start() {
    try {
      record.startRecording()
    } catch (_: IllegalStateException) {
    }
    if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
      record.release()
      throw CaptureException("ERR_AUDIO_START", "The microphone is in use by another app")
    }
    running = true
    thread = Thread(::readLoop, "expo.pcmstream.capture").apply { start() }
  }

  /** Stops recording and waits for the capture thread, so no result is reported after this returns. */
  fun stop() {
    running = false
    try {
      record.stop() // makes a blocking read() return
    } catch (_: IllegalStateException) {
    }
    thread?.join(1000)
    thread = null
    record.release()
  }

  private fun readLoop() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
    val pcm = ShortArray(hopSize)
    val hop = DoubleArray(hopSize)
    var filled = 0
    // An exception escaping a background thread would take the whole app down.
    try {
      while (running) {
        val read = record.read(pcm, filled, hopSize - filled)
        if (read < 0) {
          if (running) onError("AudioRecord read failed ($read)")
          return
        }
        if (read == 0) {
          Thread.sleep(2) // only seen transiently around stop(); don't spin
          continue
        }
        filled += read
        if (filled < hopSize) continue
        filled = 0

        for (i in 0 until hopSize) hop[i] = pcm[i] / 32768.0
        val current = range.get()
        val result = analyzer.process(hop, current.minimum, current.maximum)
        if (running) onResult(result)
      }
    } catch (e: Exception) {
      if (running) onError("Pitch capture failed: ${e.message}")
    }
  }

  private companion object {
    // The permission is checked by the module before a capture is created.
    @SuppressLint("MissingPermission")
    fun openRecord(audioManager: AudioManager, hopSize: Int): AudioRecord {
      // The Android CDD requires VOICE_RECOGNITION to have AGC and noise suppression disabled,
      // which the default MIC source applies on many devices - noise suppression in particular
      // treats a sustained string as noise and fades it out. (UNPROCESSED is calibrated ~18 dB
      // quieter, enough to push soft playing under the silence threshold.)
      val sources = listOf(MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC)
      // The device's native rate first: it avoids a resampler in the capture path.
      val nativeRate = audioManager.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)?.toIntOrNull()
      val sampleRates = listOfNotNull(nativeRate, 48000, 44100).distinct()

      for (source in sources) {
        for (rate in sampleRates) {
          val minBufferSize = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
          if (minBufferSize <= 0) continue
          val record = try {
            AudioRecord(
              source,
              rate,
              AudioFormat.CHANNEL_IN_MONO,
              AudioFormat.ENCODING_PCM_16BIT,
              maxOf(minBufferSize, hopSize * 2 * 4), // >= 4 hops of headroom
            )
          } catch (_: IllegalArgumentException) {
            continue
          }
          if (record.state == AudioRecord.STATE_INITIALIZED) return record
          record.release()
        }
      }
      throw CaptureException("ERR_AUDIO_START", "Unable to open the microphone")
    }
  }
}
