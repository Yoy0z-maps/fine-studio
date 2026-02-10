package expo.modules.metronome

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Handler
import android.os.HandlerThread
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.PI
import kotlin.math.sin

class ExpoMetronomeModule : Module() {
    private val sampleRate = 44100
    private val nodeCount = 8

    private var audioTracks: MutableList<AudioTrack> = mutableListOf()
    private var currentTrackIndex = 0

    private var clickBuffer: ShortArray? = null
    private var accentBuffer: ShortArray? = null
    private var subClickBuffer: ShortArray? = null

    private var handlerThread: HandlerThread? = null
    private var handler: Handler? = null
    private var tickRunnable: Runnable? = null

    private var isPlaying = false
    private var tempo: Double = 120.0
    private var beatsPerMeasure: Int = 4
    private var subdivision: Int = 1  // 1=quarter, 2=eighth, 4=sixteenth
    private var currentBeat: Int = 0
    private var currentSubBeat: Int = 0
    private var soundEnabled = true
    private var accentEnabled = true

    override fun definition() = ModuleDefinition {
        Name("ExpoMetronome")

        Events("onBeat")

        OnCreate {
            setupAudio()
        }

        OnDestroy {
            stop()
            releaseAudio()
        }

        Function("start") { bpm: Double, beats: Int, sound: Boolean, accent: Boolean ->
            tempo = bpm
            beatsPerMeasure = beats
            soundEnabled = sound
            accentEnabled = accent
            startMetronome()
        }

        Function("stop") {
            stop()
        }

        Function("setTempo") { bpm: Double ->
            tempo = bpm
            updateTimerInterval()
        }

        Function("setBeats") { beats: Int ->
            beatsPerMeasure = beats
            if (currentBeat >= beats) {
                currentBeat = 0
            }
        }

        Function("setSubdivision") { sub: Int ->
            subdivision = sub
            currentSubBeat = 0
            updateTimerInterval()
        }

        Function("setSoundEnabled") { enabled: Boolean ->
            soundEnabled = enabled
        }

        Function("setAccentEnabled") { enabled: Boolean ->
            accentEnabled = enabled
        }

        Function("isPlaying") {
            isPlaying
        }
    }

    private fun setupAudio() {
        // Create click buffers
        clickBuffer = createClickBuffer(3000.0, 0.015, 1.0f)
        accentBuffer = createClickBuffer(1800.0, 0.025, 1.0f)
        subClickBuffer = createClickBuffer(4000.0, 0.01, 0.5f)

        // Create audio track pool
        val bufferSize = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        for (i in 0 until nodeCount) {
            val audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()

            audioTracks.add(audioTrack)
        }
    }

    private fun createClickBuffer(frequency: Double, duration: Double, volume: Float): ShortArray {
        val frameCount = (duration * sampleRate).toInt()
        val buffer = ShortArray(frameCount)

        for (i in 0 until frameCount) {
            val t = i.toDouble() / sampleRate
            val envelope = 1.0 - (t / duration)
            val sample = sin(2.0 * PI * frequency * t) * envelope * volume
            buffer[i] = (sample * Short.MAX_VALUE).toInt().toShort()
        }

        return buffer
    }

    private fun startMetronome() {
        stop()

        isPlaying = true
        currentBeat = 0
        currentSubBeat = 0

        handlerThread = HandlerThread("MetronomeTimer").apply { start() }
        handler = Handler(handlerThread!!.looper)

        scheduleNextTick()
    }

    private fun getSubBeatIntervalMs(): Long {
        val beatIntervalMs = (60.0 / tempo * 1000.0).toLong()
        return beatIntervalMs / subdivision
    }

    private fun updateTimerInterval() {
        if (!isPlaying) return
        // Interval will be updated on next tick
    }

    private fun scheduleNextTick() {
        if (!isPlaying) return

        tickRunnable = Runnable {
            if (isPlaying) {
                tick()
                scheduleNextTick()
            }
        }
        handler?.postDelayed(tickRunnable!!, getSubBeatIntervalMs())
    }

    private fun tick() {
        val isMainBeat = currentSubBeat == 0
        val isAccent = isMainBeat && currentBeat == 0 && accentEnabled
        val beat = currentBeat
        val subBeat = currentSubBeat
        val currentTempo = tempo

        // Play sound
        if (soundEnabled) {
            if (isMainBeat) {
                playClick(isAccent)
            } else {
                playSubClick()
            }
        }

        // Send event only for main beats
        if (isMainBeat) {
            sendEvent("onBeat", mapOf(
                "beat" to beat,
                "isAccent" to isAccent,
                "tempo" to currentTempo,
                "subBeat" to subBeat
            ))
        }

        // Next sub beat
        currentSubBeat = (currentSubBeat + 1) % subdivision
        if (currentSubBeat == 0) {
            currentBeat = (currentBeat + 1) % beatsPerMeasure
        }
    }

    private fun playClick(isAccent: Boolean) {
        val buffer = if (isAccent) accentBuffer else clickBuffer
        buffer?.let { playBuffer(it) }
    }

    private fun playSubClick() {
        subClickBuffer?.let { playBuffer(it) }
    }

    private fun playBuffer(buffer: ShortArray) {
        val track = audioTracks.getOrNull(currentTrackIndex) ?: return
        currentTrackIndex = (currentTrackIndex + 1) % nodeCount

        try {
            // MODE_STATIC에서는 stop -> flush -> write -> play 순서가 필요
            if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
                track.stop()
            }
            track.flush()
            track.write(buffer, 0, buffer.size, AudioTrack.WRITE_BLOCKING)
            track.reloadStaticData()
            track.play()
        } catch (e: Exception) {
            // Audio playback failed, ignore
        }
    }

    private fun stop() {
        isPlaying = false
        currentBeat = 0
        currentSubBeat = 0

        tickRunnable?.let { handler?.removeCallbacks(it) }
        tickRunnable = null
        handler = null
        handlerThread?.quitSafely()
        handlerThread = null

        audioTracks.forEach { track ->
            try {
                if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
                    track.stop()
                }
                track.flush()
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    private fun releaseAudio() {
        audioTracks.forEach { track ->
            try {
                track.release()
            } catch (e: Exception) {
                // Ignore
            }
        }
        audioTracks.clear()
    }
}
