package expo.modules.pcmstream

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.atomic.AtomicReference

class StartOptions : Record {
  @Field
  val windowSize: Int = 2048

  @Field
  val hopSize: Int = 1024

  @Field
  val minFrequency: Double = 65.0

  @Field
  val maxFrequency: Double = 1500.0

  @Field
  val silenceThreshold: Double = 0.002
}

class ExpoPcmStreamModule : Module() {
  private val lock = Any()
  private val range = AtomicReference(FrequencyRange(65.0, 1500.0))
  private var capture: PitchCapture? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoPcmStream")

    Events(PITCH_EVENT, ERROR_EVENT)

    OnDestroy {
      synchronized(lock) { stopCapture() }
    }

    AsyncFunction("start") { startOptions: StartOptions? ->
      val options = startOptions ?: StartOptions()
      if (!isValid(options)) {
        throw CodedException("ERR_PITCH_STREAM_OPTIONS", "Invalid pitch stream options", null)
      }
      val context = appContext.reactContext
        ?: throw CodedException("ERR_AUDIO_START", "React context is not available", null)
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        throw CodedException("ERR_MIC_PERMISSION", "RECORD_AUDIO permission not granted", null)
      }
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

      synchronized(lock) {
        stopCapture()
        range.set(FrequencyRange(options.minFrequency, options.maxFrequency))
        try {
          val newCapture = PitchCapture(
            audioManager,
            options.windowSize,
            options.hopSize,
            options.silenceThreshold,
            range,
            onResult = { result ->
              sendEvent(
                PITCH_EVENT,
                mapOf(
                  "frequency" to if (result.frequency.isNaN()) null else result.frequency,
                  "clarity" to result.clarity,
                  "rms" to result.rms,
                ),
              )
            },
            onError = { message ->
              sendEvent(ERROR_EVENT, mapOf("code" to "ERR_AUDIO_CAPTURE", "message" to message))
            },
          )
          newCapture.start()
          capture = newCapture
          mapOf("sampleRate" to newCapture.sampleRate.toDouble())
        } catch (e: CaptureException) {
          throw CodedException(e.code, e.message, e)
        }
      }
    }

    AsyncFunction("stop") {
      synchronized(lock) { stopCapture() }
    }

    // Lets JS switch tuner modes without restarting the recorder.
    Function("setFrequencyRange") { minFrequency: Double, maxFrequency: Double ->
      if (!(minFrequency > 0 && maxFrequency > minFrequency)) {
        throw CodedException("ERR_PITCH_STREAM_OPTIONS", "Invalid frequency range", null)
      }
      range.set(FrequencyRange(minFrequency, maxFrequency))
    }
  }

  private fun stopCapture() {
    capture?.stop()
    capture = null
  }

  private fun isValid(options: StartOptions): Boolean {
    return options.windowSize in 256..16384 &&
      options.hopSize in 1..options.windowSize &&
      options.minFrequency > 0 &&
      options.maxFrequency > options.minFrequency &&
      options.silenceThreshold >= 0
  }

  private companion object {
    // Distinct from the generic "onError" so the events can't collide with other modules'.
    const val PITCH_EVENT = "onPitch"
    const val ERROR_EVENT = "onPitchStreamError"
  }
}
