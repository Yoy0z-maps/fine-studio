package expo.modules.metronome

import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToLong
import kotlin.math.sin

/**
 * Sample-accurate click track: decides on which output frame each click starts and synthesizes
 * it straight into the rendered audio. Tick times are `gridOrigin + n * samplesPerTick`
 * (multiplied, not accumulated), so the tempo never drifts however long it plays.
 *
 * Pure Kotlin (no Android APIs) so it can be verified on a JVM. Not thread-safe: the audio thread
 * owns it and applies parameter changes between blocks.
 */
internal class ClickSequencer(private val sampleRate: Double) {
  /** A main beat, with the stream frame its click starts on. */
  class Beat(val index: Int, val isAccent: Boolean, val tempo: Double, val frame: Long)

  private val accentClick = synthesizeClick(1800.0, 0.025, 1.0)
  private val mainClick = synthesizeClick(3000.0, 0.015, 1.0)
  private val subClick = synthesizeClick(4000.0, 0.010, 0.5)

  var tempo = 120.0
    private set
  var beatsPerMeasure = 4
    private set
  var subdivision = 1
    private set
  var soundEnabled = true
  var accentEnabled = true

  private var frame = 0L // next frame to render
  private var gridOrigin = 0.0 // frame of tick 0 of the current grid
  private var gridTick = 0L // grid index of the next tick
  private var samplesPerTick = 0.0
  private var lastTickAt = Double.NaN
  private var lastMainBeatAt = Double.NaN
  private var nextSub = 0 // sub-beat index of the next tick; 0 = main beat
  private var currentBeat = -1 // index of the last main beat played
  private var click: FloatArray? = null
  private var clickPos = 0

  /** Restarts the track: the first tick (a main beat, index 0) lands on the next rendered frame. */
  fun start(tempo: Double, beats: Int, subdivision: Int, soundEnabled: Boolean, accentEnabled: Boolean) {
    this.tempo = tempo
    beatsPerMeasure = max(1, beats)
    this.subdivision = max(1, subdivision)
    this.soundEnabled = soundEnabled
    this.accentEnabled = accentEnabled
    samplesPerTick = computeSamplesPerTick()
    gridOrigin = frame.toDouble()
    gridTick = 0
    lastTickAt = Double.NaN
    lastMainBeatAt = Double.NaN
    nextSub = 0
    currentBeat = -1
    click = null
    clickPos = 0
  }

  /** The next tick comes one new interval after the last one - or right away if that has passed. */
  fun setTempo(bpm: Double) {
    if (bpm == tempo) return
    tempo = bpm
    samplesPerTick = computeSamplesPerTick()
    if (!lastTickAt.isNaN()) regrid(lastTickAt + samplesPerTick)
  }

  /** Keeps the main-beat grid: continues with the first new sub-tick after the last tick. */
  fun setSubdivision(sub: Int) {
    val newSub = max(1, sub)
    if (newSub == subdivision) return
    subdivision = newSub
    samplesPerTick = computeSamplesPerTick()
    if (lastMainBeatAt.isNaN()) {
      nextSub = 0
      return
    }
    val k = minOf(floor((lastTickAt - lastMainBeatAt) / samplesPerTick + 1e-9).toLong() + 1, newSub.toLong())
    nextSub = (k % newSub).toInt()
    regrid(lastMainBeatAt + k * samplesPerTick)
  }

  /** Takes effect from the next main beat (an index past the new measure wraps to 0). */
  fun setBeatsPerMeasure(beats: Int) {
    beatsPerMeasure = max(1, beats)
  }

  /** Renders `count` frames into `out`, reporting each main beat whose click starts in them. */
  fun render(out: FloatArray, count: Int, onBeat: (Beat) -> Unit) {
    val blockStart = frame
    val blockEnd = blockStart + count
    var i = 0
    while (true) {
      val tickAt = gridOrigin + gridTick * samplesPerTick
      // A tick already overdue (only right after a parameter change) starts immediately.
      val tickFrame = max(tickAt.roundToLong(), blockStart + i)
      if (tickFrame >= blockEnd) break
      i = fill(out, i, (tickFrame - blockStart).toInt())
      startTick(if (tickFrame > tickAt.roundToLong()) tickFrame.toDouble() else tickAt, tickFrame, onBeat)
    }
    fill(out, i, count)
    frame = blockEnd
  }

  private fun startTick(tickAt: Double, tickFrame: Long, onBeat: (Beat) -> Unit) {
    lastTickAt = tickAt
    if (nextSub == 0) {
      currentBeat = if (currentBeat + 1 >= beatsPerMeasure) 0 else currentBeat + 1
      lastMainBeatAt = tickAt
      val isAccent = currentBeat == 0 && accentEnabled
      click = if (!soundEnabled) null else if (isAccent) accentClick else mainClick
      onBeat(Beat(currentBeat, isAccent, tempo, tickFrame))
    } else {
      click = if (soundEnabled) subClick else null
    }
    clickPos = 0
    nextSub = if (nextSub + 1 >= subdivision) 0 else nextSub + 1
    gridTick++
  }

  /** Writes the playing click (or silence) into out[from until to]; returns `to`. */
  private fun fill(out: FloatArray, from: Int, to: Int): Int {
    var i = from
    val current = click
    if (current != null) {
      while (i < to && clickPos < current.size) {
        out[i++] = current[clickPos++]
      }
      if (clickPos >= current.size) click = null
    }
    while (i < to) out[i++] = 0f
    return to
  }

  private fun regrid(nextTickAt: Double) {
    // Never schedule into the past: that would play a burst of overdue ticks at once.
    gridOrigin = max(nextTickAt, frame.toDouble())
    gridTick = 0
  }

  private fun computeSamplesPerTick() = sampleRate * 60.0 / (tempo * subdivision)

  private fun synthesizeClick(frequency: Double, duration: Double, volume: Double): FloatArray {
    val length = (duration * sampleRate).toInt()
    return FloatArray(length) {
      val t = it / sampleRate
      (sin(2.0 * PI * frequency * t) * (1.0 - t / duration) * volume).toFloat()
    }
  }
}
