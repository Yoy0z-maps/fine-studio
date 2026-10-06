package expo.modules.pcmstream

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// Pure Kotlin (no Android APIs) so the DSP can be compiled and verified on a plain JVM.

internal class PitchDetection(val frequency: Double, val clarity: Double)

/**
 * Forward FFT of a real sequence of length [n] (a power of two >= 4), computed as an
 * n/2-point complex FFT plus a split step. Twiddles and the bit-reversal permutation are
 * precomputed, so [forward] never allocates.
 */
internal class RealFft(private val n: Int) {
  private val m = n / 2
  private val re = DoubleArray(m)
  private val im = DoubleArray(m)
  private val bitReverse = IntArray(m)
  private val cosM = DoubleArray(m / 2) // e^(-2*pi*i*k/m) = cosM[k] - i*sinM[k]
  private val sinM = DoubleArray(m / 2)
  private val cosN = DoubleArray(m + 1) // e^(-2*pi*i*k/n) = cosN[k] - i*sinN[k]
  private val sinN = DoubleArray(m + 1)

  init {
    require(n >= 4 && n and (n - 1) == 0) { "FFT size must be a power of two >= 4" }
    val bits = Integer.numberOfTrailingZeros(m)
    for (i in 0 until m) {
      bitReverse[i] = Integer.reverse(i) ushr (32 - bits)
    }
    for (k in 0 until m / 2) {
      val angle = 2 * PI * k / m
      cosM[k] = cos(angle)
      sinM[k] = sin(angle)
    }
    for (k in 0..m) {
      val angle = 2 * PI * k / n
      cosN[k] = cos(angle)
      sinN[k] = sin(angle)
    }
  }

  /** Writes X[k] for k = 0..n/2 of the real `input` (length n) into `outRe`/`outIm` (length n/2 + 1). */
  fun forward(input: DoubleArray, outRe: DoubleArray, outIm: DoubleArray) {
    // Pack even/odd samples as one complex sequence, already in bit-reversed order.
    for (i in 0 until m) {
      val j = bitReverse[i]
      re[j] = input[2 * i]
      im[j] = input[2 * i + 1]
    }

    // Iterative radix-2 decimation-in-time butterflies.
    var size = 2
    while (size <= m) {
      val half = size shr 1
      val step = m / size
      var start = 0
      while (start < m) {
        var k = 0
        for (j in start until start + half) {
          val wr = cosM[k]
          val wi = -sinM[k]
          val l = j + half
          val tr = re[l] * wr - im[l] * wi
          val ti = re[l] * wi + im[l] * wr
          re[l] = re[j] - tr
          im[l] = im[j] - ti
          re[j] += tr
          im[j] += ti
          k += step
        }
        start += size
      }
      size = size shl 1
    }

    // Split step: with Z = FFT(even + i*odd), E[k] = (Z[k] + conj Z[m-k]) / 2 is the even
    // samples' spectrum, O[k] = (Z[k] - conj Z[m-k]) / 2i the odd ones', and
    // X[k] = E[k] + e^(-2*pi*i*k/n) * O[k].
    for (k in 0..m) {
      val a = if (k == m) 0 else k
      val b = if (k == 0) 0 else m - k
      val zr = re[a]
      val zi = im[a]
      val cr = re[b]
      val ci = -im[b]
      val er = 0.5 * (zr + cr)
      val ei = 0.5 * (zi + ci)
      val or = 0.5 * (zi - ci)
      val oi = -0.5 * (zr - cr)
      val tr = cosN[k]
      val ti = -sinN[k]
      outRe[k] = er + (tr * or - ti * oi)
      outIm[k] = ei + (tr * oi + ti * or)
    }
  }
}

/**
 * McLeod Pitch Method (MPM) with FFT-accelerated autocorrelation.
 * Reference: McLeod & Wyvill (2005), "A Smarter Way to Find Pitch".
 *
 * - The autocorrelation is computed via the Wiener-Khinchin theorem, O(n log n) instead of
 *   the O(n^2) direct sum.
 * - MPM's peak picking (the first "key maximum" within [CLARITY_THRESHOLD] of the global
 *   peak) resists the octave errors plucked strings provoke when an overtone outweighs the
 *   fundamental, and yields a natural 0..1 confidence (clarity).
 *
 * It does no preprocessing: the window must already be high-passed (see [PitchAnalyzer],
 * which filters the stream continuously - restarting a filter per window biases low notes).
 * Not thread-safe; all scratch memory is preallocated so [detect] never allocates.
 */
internal class PitchDetector(val windowSize: Int) {
  private val fftSize: Int
  private val half: Int
  private val fft: RealFft
  private val padded: DoubleArray
  private val power: DoubleArray
  private val specRe: DoubleArray
  private val specIm: DoubleArray
  private val prefixSq = DoubleArray(windowSize + 1)
  private val nsdf = DoubleArray(windowSize)
  private val peakLags = IntArray(windowSize)
  private val peakValues = DoubleArray(windowSize)

  init {
    require(windowSize >= 4) { "windowSize must be >= 4" }
    var size = 4
    while (size < 2 * windowSize) size = size shl 1 // zero-pad to >= 2W so the circular ACF doesn't wrap
    fftSize = size
    half = size / 2
    fft = RealFft(size)
    padded = DoubleArray(size)
    power = DoubleArray(size)
    specRe = DoubleArray(half + 1)
    specIm = DoubleArray(half + 1)
  }

  /**
   * Detects the fundamental of `window` ([windowSize] samples) within [minFrequency, maxFrequency].
   * Returns null if the signal isn't periodic enough to trust (see [MIN_CLARITY]).
   */
  fun detect(window: DoubleArray, sampleRate: Double, minFrequency: Double, maxFrequency: Double): PitchDetection? {
    val w = windowSize
    if (!(sampleRate > 0 && minFrequency > 0 && maxFrequency > minFrequency)) return null
    val maxLag = min(w - 1, min(floor(sampleRate / minFrequency), w.toDouble()).toInt())
    val minLag = max(1, min(floor(sampleRate / maxFrequency), w.toDouble()).toInt())
    if (maxLag <= minLag) return null

    // Autocorrelation via Wiener-Khinchin. The power spectrum is real and even, so its
    // inverse DFT equals its forward DFT / n - one real FFT routine serves both directions.
    System.arraycopy(window, 0, padded, 0, w) // padded[w until fftSize] is never written: stays 0
    fft.forward(padded, specRe, specIm)
    for (k in 0..half) {
      val p = specRe[k] * specRe[k] + specIm[k] * specIm[k]
      power[k] = p
      if (k in 1 until half) power[fftSize - k] = p
    }
    fft.forward(power, specRe, specIm) // specRe[tau] = fftSize * acf[tau], valid up to half >= w
    val acfScale = 1.0 / fftSize

    prefixSq[0] = 0.0
    for (i in 0 until w) {
      prefixSq[i + 1] = prefixSq[i] + window[i] * window[i]
    }
    val totalSq = prefixSq[w]

    // Computed a quarter past maxLag so a lobe the range cuts off can be followed to its end.
    val extLag = min(w - 1, maxLag + maxLag / 4)
    for (tau in 0..extLag) {
      val e1 = prefixSq[w - tau] // sum x(j)^2, j = 0..W-tau-1
      val e2 = totalSq - prefixSq[tau] // sum x(j+tau)^2, j = 0..W-tau-1
      val m = e1 + e2
      nsdf[tau] = if (m > 0) (2 * specRe[tau] * acfScale) / m else 0.0
    }

    // McLeod peak picking: within each lobe between a positive-going and the following
    // negative-going zero crossing, keep only the local maximum ("key maximum"). Then pick
    // the first key maximum within CLARITY_THRESHOLD of the global one - favors the
    // fundamental's peak over a stronger-but-wrong harmonic peak at a shorter lag.
    var peakCount = 0
    var maxPeakValue = 0.0
    var tau = 1
    while (tau < maxLag) {
      while (tau < maxLag && nsdf[tau] > 0) tau++
      while (tau < maxLag && nsdf[tau] <= 0) tau++
      if (tau >= maxLag) break

      var peakTau = tau
      var peakVal = nsdf[tau]
      while (tau < maxLag && nsdf[tau] > 0) {
        if (nsdf[tau] > peakVal) {
          peakVal = nsdf[tau]
          peakTau = tau
        }
        tau++
      }
      if (tau == maxLag && lobeRisesBeyond(maxLag, extLag, peakVal)) {
        // The lobe peaks past maxLag: it's periodicity below minFrequency (room rumble, 50/60 Hz
        // mains hum). Counting its cut-off edge would report a phantom pitch pinned to the
        // bottom of the range.
        break
      }
      if (peakTau >= minLag) {
        peakLags[peakCount] = peakTau
        peakValues[peakCount] = peakVal
        peakCount++
        if (peakVal > maxPeakValue) maxPeakValue = peakVal
      }
    }

    if (peakCount == 0 || maxPeakValue < MIN_CLARITY) return null

    var bestTau = -1
    var bestValue = 0.0
    for (i in 0 until peakCount) {
      if (peakValues[i] >= CLARITY_THRESHOLD * maxPeakValue) {
        bestTau = peakLags[i]
        bestValue = peakValues[i]
        break
      }
    }

    // Parabolic interpolation around the chosen peak for sub-sample lag accuracy. nsdf is
    // filled from lag 0, so a peak sitting right on minLag (a note at the very top of the
    // range) can be refined too instead of snapping to sampleRate / minLag.
    var betterTau = bestTau.toDouble()
    if (bestTau < maxLag) {
      val s0 = nsdf[bestTau - 1]
      val s1 = nsdf[bestTau]
      val s2 = nsdf[bestTau + 1]
      val denom = 2 * (2 * s1 - s0 - s2)
      if (abs(denom) > 1e-12) {
        val shift = (s2 - s0) / denom
        if (abs(shift) < 1) betterTau += shift
      }
    }

    val frequency = sampleRate / betterTau
    if (frequency < minFrequency || frequency > maxFrequency) return null
    return PitchDetection(frequency, bestValue)
  }

  /** Whether the positive lobe running through `start` climbs above `value` before it ends. */
  private fun lobeRisesBeyond(start: Int, end: Int, value: Double): Boolean {
    var tau = start
    while (tau <= end && nsdf[tau] > 0) {
      if (nsdf[tau] > value) return true
      tau++
    }
    return false
  }

  companion object {
    const val CLARITY_THRESHOLD = 0.93 // McLeod's "k"
    const val MIN_CLARITY = 0.5 // below this the signal isn't periodic enough to trust at all
  }
}

/**
 * Turns a continuous mono stream, delivered hop by hop, into one pitch reading per hop.
 *
 * The high-pass filter runs continuously across hops. The previous JS implementation
 * restarted it (and subtracted the window mean) for every window; the filter's startup
 * transient then skewed the autocorrelation and read low strings up to ~25 cents off,
 * depending on phase. Not thread-safe.
 */
internal class PitchAnalyzer(
  val windowSize: Int,
  val hopSize: Int,
  val sampleRate: Double,
  private val silenceThreshold: Double,
) {
  /** [frequency] is NaN when silent, still filling the window, or not periodic enough. */
  class Result(val frequency: Double, val clarity: Double, val rms: Double)

  private val detector = PitchDetector(windowSize)
  private val window = DoubleArray(windowSize)
  private val alpha: Double
  private var filled = 0
  private var primed = false
  private var prevIn = 0.0
  private var prevOut = 0.0

  init {
    require(hopSize in 1..windowSize) { "hopSize must be in 1..windowSize" }
    require(sampleRate > 0) { "sampleRate must be positive" }
    val rc = 1 / (2 * PI * HIGHPASS_CUTOFF_HZ)
    val dt = 1 / sampleRate
    alpha = rc / (rc + dt)
  }

  /** Consumes the first [hopSize] samples of `hop`. */
  fun process(hop: DoubleArray, minFrequency: Double, maxFrequency: Double): Result {
    val keep = windowSize - hopSize
    System.arraycopy(window, hopSize, window, 0, keep)

    if (!primed) {
      prevIn = hop[0]
      primed = true
    }
    var sumSq = 0.0
    for (i in 0 until hopSize) {
      val x = hop[i]
      prevOut = alpha * (prevOut + x - prevIn)
      prevIn = x
      window[keep + i] = prevOut
      sumSq += prevOut * prevOut
    }
    filled = min(windowSize, filled + hopSize)
    val rms = sqrt(sumSq / hopSize)

    if (filled < windowSize || rms < silenceThreshold) return Result(Double.NaN, 0.0, rms)
    val detection = detector.detect(window, sampleRate, minFrequency, maxFrequency)
      ?: return Result(Double.NaN, 0.0, rms)
    return Result(detection.frequency, detection.clarity, rms)
  }

  companion object {
    const val HIGHPASS_CUTOFF_HZ = 35.0 // kills DC/rumble well below any supported note
  }
}
