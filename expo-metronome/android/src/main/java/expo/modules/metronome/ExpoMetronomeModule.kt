package expo.modules.metronome

import android.content.Context
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

class ExpoMetronomeModule : Module() {
  // Opening/closing the audio track happens here, off the JS thread, in call order.
  private val control = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "MetronomeControl") }
  private val lock = Any()

  // Settings persist between plays: JS sets the subdivision before calling start().
  private var params = ClickParams(tempo = 120.0, beats = 4, subdivision = 1, soundEnabled = true, accentEnabled = true)
  private var player: ClickTrackPlayer? = null

  @Volatile
  private var isPlaying = false

  override fun definition() = ModuleDefinition {
    Name("ExpoMetronome")

    Events("onBeat")

    OnDestroy {
      isPlaying = false
      control.execute { stopPlayer() }
      control.shutdown()
    }

    Function("start") { bpm: Double, beats: Int, sound: Boolean, accent: Boolean ->
      update { it.copy(tempo = bpm, beats = beats, soundEnabled = sound, accentEnabled = accent) }
      isPlaying = true
      control.execute {
        stopPlayer()
        val context = appContext.reactContext ?: return@execute
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        try {
          val newPlayer = ClickTrackPlayer(audioManager, synchronized(lock) { params }) { beat ->
            sendEvent(
              "onBeat",
              mapOf(
                "beat" to beat.index,
                "isAccent" to beat.isAccent,
                "tempo" to beat.tempo,
                "subBeat" to 0,
              ),
            )
          }
          synchronized(lock) { player = newPlayer }
          newPlayer.start()
        } catch (e: Exception) {
          // e.g. the audio track couldn't be created; report not playing rather than crash.
          stopPlayer()
          isPlaying = false
        }
      }
    }

    Function("stop") {
      isPlaying = false
      control.execute { stopPlayer() }
    }

    Function("setTempo") { bpm: Double ->
      update { it.copy(tempo = bpm) }
    }

    Function("setBeats") { beats: Int ->
      update { it.copy(beats = beats) }
    }

    Function("setSubdivision") { sub: Int ->
      update { it.copy(subdivision = sub) }
    }

    Function("setSoundEnabled") { enabled: Boolean ->
      update { it.copy(soundEnabled = enabled) }
    }

    Function("setAccentEnabled") { enabled: Boolean ->
      update { it.copy(accentEnabled = enabled) }
    }

    Function("isPlaying") {
      isPlaying
    }
  }

  private fun update(change: (ClickParams) -> ClickParams) {
    synchronized(lock) {
      params = change(params)
      // The playing track picks the change up at its next audio block.
      player?.update { params }
    }
  }

  private fun stopPlayer() {
    val current = synchronized(lock) { player.also { player = null } }
    current?.stop()
  }
}
