package expo.modules.metronome

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
import java.util.concurrent.atomic.AtomicReference

internal data class ClickParams(
  val tempo: Double,
  val beats: Int,
  val subdivision: Int,
  val soundEnabled: Boolean,
  val accentEnabled: Boolean,
)

/**
 * Streams a [ClickSequencer] into one continuously playing AudioTrack from an urgent-audio
 * thread, so every click lands on an exact sample. (Re-arming a timer with postDelayed after
 * each tick let the tempo drift slow, and stop/flush/write/play on a static track per click added
 * a different start latency to every click.)
 *
 * Beats are reported when their click is actually heard, using the track's playback timestamps.
 */
internal class ClickTrackPlayer(
  audioManager: AudioManager,
  initial: ClickParams,
  private val onBeat: (ClickSequencer.Beat) -> Unit,
) {
  private val sampleRate: Int =
    audioManager.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)?.toIntOrNull() ?: 48000
  // The device's native burst size, so each write maps onto whole mixer buffers.
  private val framesPerWrite: Int =
    (audioManager.getProperty(AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)?.toIntOrNull() ?: 256)
      .coerceIn(64, 2048)

  private val params = AtomicReference(initial)
  private val track: AudioTrack = buildTrack()
  private val sequencer = ClickSequencer(sampleRate.toDouble())
  private val events = HandlerThread("MetronomeBeats").apply { start() }
  private val eventHandler = Handler(events.looper)
  private val timestamp = AudioTimestamp()

  @Volatile
  private var running = false
  private var writer: Thread? = null

  fun update(change: (ClickParams) -> ClickParams) {
    params.updateAndGet(change)
  }

  fun start() {
    val p = params.get()
    sequencer.start(p.tempo, p.beats, p.subdivision, p.soundEnabled, p.accentEnabled)
    running = true
    track.play()
    writer = Thread(::writeLoop, "MetronomeAudio").apply { start() }
  }

  /** Stops right away (queued audio is dropped) and releases everything; not reusable after. */
  fun stop() {
    running = false
    eventHandler.removeCallbacksAndMessages(null)
    try {
      track.pause()
      track.flush() // also unblocks a write waiting for buffer space
    } catch (_: IllegalStateException) {
    }
    writer?.join(500)
    writer = null
    track.release()
    events.quitSafely()
  }

  private fun writeLoop() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
    val floats = FloatArray(framesPerWrite)
    val shorts = ShortArray(framesPerWrite)
    var applied = params.get()
    try {
      while (running) {
        val p = params.get()
        if (p !== applied) {
          if (p.tempo != applied.tempo) sequencer.setTempo(p.tempo)
          if (p.subdivision != applied.subdivision) sequencer.setSubdivision(p.subdivision)
          if (p.beats != applied.beats) sequencer.setBeatsPerMeasure(p.beats)
          sequencer.soundEnabled = p.soundEnabled
          sequencer.accentEnabled = p.accentEnabled
          applied = p
        }

        sequencer.render(floats, framesPerWrite, ::scheduleBeat)
        for (i in 0 until framesPerWrite) {
          shorts[i] = (floats[i].coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort()
        }

        var written = 0
        while (written < framesPerWrite && running) {
          val result = track.write(shorts, written, framesPerWrite - written)
          if (result < 0) return
          written += result
        }
      }
    } catch (_: Exception) {
      // An exception escaping this thread would crash the app; the metronome just goes quiet.
    }
  }

  private fun scheduleBeat(beat: ClickSequencer.Beat) {
    val nowNanos = System.nanoTime()
    val heardAtNanos = if (track.getTimestamp(timestamp)) {
      timestamp.nanoTime + (beat.frame - timestamp.framePosition) * 1_000_000_000L / sampleRate
    } else {
      // No timestamp yet (the first few buffers): estimate from the playback head.
      nowNanos + (beat.frame - track.playbackHeadPosition.toLong()) * 1_000_000_000L / sampleRate
    }
    val delayMs = ((heardAtNanos - nowNanos) / 1_000_000L).coerceAtLeast(0)
    eventHandler.postAtTime({ if (running) onBeat(beat) }, SystemClock.uptimeMillis() + delayMs)
  }

  private fun buildTrack(): AudioTrack {
    val minBufferBytes = AudioTrack.getMinBufferSize(
      sampleRate,
      AudioFormat.CHANNEL_OUT_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    val builder = AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(sampleRate)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build(),
      )
      .setTransferMode(AudioTrack.MODE_STREAM)
      // A few bursts of headroom: low latency, but room for scheduling hiccups.
      .setBufferSizeInBytes(maxOf(minBufferBytes, framesPerWrite * 2 * 4))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder.setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
    }
    return builder.build()
  }
}
