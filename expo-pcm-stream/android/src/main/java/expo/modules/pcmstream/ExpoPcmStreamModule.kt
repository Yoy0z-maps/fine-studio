package expo.modules.pcmstream

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder

class ExpoPcmStreamModule : Module() {
    private val sampleRate = 44100
    private var frameSize = 1024
    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    @Volatile
    private var isRecording = false

    override fun definition() = ModuleDefinition {
        Name("ExpoPcmStream")

        Events("onAudioFrame", "onError")

        Function("start") { fs: Int? ->
            if (fs != null && fs > 0) {
                frameSize = fs
            }
            startRecording()
        }

        Function("stop") {
            stopRecording()
        }
    }

    private fun startRecording() {
        if (isRecording) {
            return
        }

        val context = appContext.reactContext ?: run {
            sendEvent("onError", mapOf("message" to "Context not available"))
            return
        }

        // Check permission
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            sendEvent("onError", mapOf("message" to "RECORD_AUDIO permission not granted"))
            return
        }

        val minBufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
            sendEvent("onError", mapOf("message" to "Unable to get min buffer size"))
            return
        }

        val bufferSize = maxOf(minBufferSize, frameSize * 2 * 4) // frameSize * 2 bytes per sample * 4

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                sendEvent("onError", mapOf("message" to "AudioRecord initialization failed"))
                audioRecord?.release()
                audioRecord = null
                return
            }

            audioRecord?.startRecording()
            isRecording = true

            recordingThread = Thread {
                readAudioData()
            }.apply {
                priority = Thread.MAX_PRIORITY
                start()
            }
        } catch (e: SecurityException) {
            sendEvent("onError", mapOf("message" to "SecurityException: ${e.message}"))
        } catch (e: Exception) {
            sendEvent("onError", mapOf("message" to "Failed to start recording: ${e.message}"))
        }
    }

    private fun readAudioData() {
        val buffer = ShortArray(frameSize)
        val accumulator = mutableListOf<Short>()

        while (isRecording) {
            val readCount = audioRecord?.read(buffer, 0, frameSize) ?: -1

            if (readCount > 0) {
                for (i in 0 until readCount) {
                    accumulator.add(buffer[i])
                }

                while (accumulator.size >= frameSize) {
                    val frame = accumulator.take(frameSize)
                    repeat(frameSize) { accumulator.removeAt(0) }

                    // Convert ShortArray to ByteArray (Little Endian)
                    val byteBuffer = ByteBuffer.allocate(frameSize * 2)
                    byteBuffer.order(ByteOrder.LITTLE_ENDIAN)
                    for (sample in frame) {
                        byteBuffer.putShort(sample)
                    }

                    val base64Data = Base64.encodeToString(byteBuffer.array(), Base64.NO_WRAP)

                    sendEvent("onAudioFrame", mapOf(
                        "sampleRate" to sampleRate,
                        "frameSize" to frameSize,
                        "data" to base64Data
                    ))
                }
            } else if (readCount < 0) {
                sendEvent("onError", mapOf("message" to "AudioRecord read error: $readCount"))
                break
            }
        }
    }

    private fun stopRecording() {
        isRecording = false

        recordingThread?.interrupt()
        recordingThread = null

        try {
            audioRecord?.stop()
        } catch (e: Exception) {
            // Ignore
        }

        try {
            audioRecord?.release()
        } catch (e: Exception) {
            // Ignore
        }
        audioRecord = null
    }
}
