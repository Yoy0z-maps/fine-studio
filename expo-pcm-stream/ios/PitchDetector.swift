import Accelerate
import Foundation

struct PitchDetection {
  let frequency: Double
  let clarity: Double // 0...1 confidence, the chosen NSDF peak height
}

/// McLeod Pitch Method (MPM) with FFT-accelerated autocorrelation.
/// Reference: McLeod & Wyvill (2005), "A Smarter Way to Find Pitch".
///
/// - The autocorrelation is computed via the Wiener-Khinchin theorem with vDSP's real FFT,
///   O(n log n) instead of the O(n^2) direct sum.
/// - MPM's peak picking (the first "key maximum" within `clarityThreshold` of the global
///   peak) resists the octave errors plucked strings provoke when an overtone outweighs the
///   fundamental, and yields a natural 0...1 confidence (`clarity`).
///
/// It does no preprocessing: the window must already be high-passed (see `PitchAnalyzer`,
/// which filters the stream continuously - restarting a filter per window biases low notes).
/// Not thread-safe; all scratch memory is preallocated so `detect` never allocates.
final class PitchDetector {
  static let clarityThreshold = 0.93 // McLeod's "k"
  static let minClarity = 0.5 // below this the signal isn't periodic enough to trust at all

  let windowSize: Int
  private let fftSize: Int
  private let halfSize: Int
  private let log2n: vDSP_Length
  private let fftSetup: FFTSetupD
  private let timeBuffer: UnsafeMutablePointer<Double> // fftSize: zero-padded window, then the ACF
  private let splitReal: UnsafeMutablePointer<Double> // halfSize
  private let splitImag: UnsafeMutablePointer<Double> // halfSize
  private let prefixSq: UnsafeMutablePointer<Double> // windowSize + 1
  private let nsdf: UnsafeMutablePointer<Double> // windowSize
  private let peakLags: UnsafeMutablePointer<Int> // windowSize
  private let peakValues: UnsafeMutablePointer<Double> // windowSize

  init?(windowSize: Int) {
    guard windowSize >= 4 else { return nil }
    var size = 1
    var log2 = 0
    while size < 2 * windowSize { // zero-pad to >= 2W so the circular ACF doesn't wrap
      size <<= 1
      log2 += 1
    }
    guard let setup = vDSP_create_fftsetupD(vDSP_Length(log2), FFTRadix(kFFTRadix2)) else { return nil }

    self.windowSize = windowSize
    fftSize = size
    halfSize = size / 2
    log2n = vDSP_Length(log2)
    fftSetup = setup
    timeBuffer = .allocate(capacity: size)
    splitReal = .allocate(capacity: size / 2)
    splitImag = .allocate(capacity: size / 2)
    prefixSq = .allocate(capacity: windowSize + 1)
    nsdf = .allocate(capacity: windowSize)
    peakLags = .allocate(capacity: windowSize)
    peakValues = .allocate(capacity: windowSize)
  }

  deinit {
    vDSP_destroy_fftsetupD(fftSetup)
    timeBuffer.deallocate()
    splitReal.deallocate()
    splitImag.deallocate()
    prefixSq.deallocate()
    nsdf.deallocate()
    peakLags.deallocate()
    peakValues.deallocate()
  }

  /// Detects the fundamental of `window` (`windowSize` samples) within [minFrequency, maxFrequency].
  /// Returns nil if the signal isn't periodic enough to trust (see `minClarity`).
  func detect(
    _ window: UnsafePointer<Double>,
    sampleRate: Double,
    minFrequency: Double,
    maxFrequency: Double
  ) -> PitchDetection? {
    let w = windowSize
    guard sampleRate > 0, minFrequency > 0, maxFrequency > minFrequency else { return nil }
    let maxLag = min(w - 1, Int(min(floor(sampleRate / minFrequency), Double(w))))
    let minLag = max(1, Int(min(floor(sampleRate / maxFrequency), Double(w))))
    if maxLag <= minLag { return nil }

    // Autocorrelation via Wiener-Khinchin: acf = IFFT(|FFT(x)|^2).
    timeBuffer.update(from: window, count: w)
    (timeBuffer + w).update(repeating: 0, count: fftSize - w)
    var split = DSPDoubleSplitComplex(realp: splitReal, imagp: splitImag)
    let n2 = vDSP_Length(halfSize)
    timeBuffer.withMemoryRebound(to: DSPDoubleComplex.self, capacity: halfSize) {
      vDSP_ctozD($0, 2, &split, 1, n2)
    }
    vDSP_fft_zripD(fftSetup, &split, 1, log2n, FFTDirection(kFFTDirection_Forward))
    // Packed real-FFT layout: realp[0] holds DC and imagp[0] holds Nyquist, both purely real.
    let dc = splitReal[0]
    let nyquist = splitImag[0]
    vDSP_zvmagsD(&split, 1, splitReal, 1, n2)
    vDSP_vclrD(splitImag, 1, n2)
    splitReal[0] = dc * dc
    splitImag[0] = nyquist * nyquist
    vDSP_fft_zripD(fftSetup, &split, 1, log2n, FFTDirection(kFFTDirection_Inverse))
    timeBuffer.withMemoryRebound(to: DSPDoubleComplex.self, capacity: halfSize) {
      vDSP_ztocD(&split, 1, $0, 2, n2)
    }
    // vDSP's forward real FFT is scaled by 2 (so the power spectrum by 4) and its inverse by
    // fftSize, so timeBuffer[tau] = 4 * fftSize * acf[tau].
    let acfScale = 1.0 / Double(4 * fftSize)

    prefixSq[0] = 0
    for i in 0..<w {
      prefixSq[i + 1] = prefixSq[i] + window[i] * window[i]
    }
    let totalSq = prefixSq[w]

    // Computed a quarter past maxLag so a lobe the range cuts off can be followed to its end.
    let extLag = min(w - 1, maxLag + maxLag / 4)
    for tau in 0...extLag {
      let e1 = prefixSq[w - tau] // sum x(j)^2, j = 0..W-tau-1
      let e2 = totalSq - prefixSq[tau] // sum x(j+tau)^2, j = 0..W-tau-1
      let m = e1 + e2
      nsdf[tau] = m > 0 ? (2 * timeBuffer[tau] * acfScale) / m : 0
    }

    // McLeod peak picking: within each lobe between a positive-going and the following
    // negative-going zero crossing, keep only the local maximum ("key maximum"). Then pick
    // the first key maximum within clarityThreshold of the global one - favors the
    // fundamental's peak over a stronger-but-wrong harmonic peak at a shorter lag.
    var peakCount = 0
    var maxPeakValue = 0.0
    var tau = 1
    while tau < maxLag {
      while tau < maxLag && nsdf[tau] > 0 { tau += 1 }
      while tau < maxLag && nsdf[tau] <= 0 { tau += 1 }
      if tau >= maxLag { break }

      var peakTau = tau
      var peakVal = nsdf[tau]
      while tau < maxLag && nsdf[tau] > 0 {
        if nsdf[tau] > peakVal {
          peakVal = nsdf[tau]
          peakTau = tau
        }
        tau += 1
      }
      if tau == maxLag && lobeRisesBeyond(maxLag, through: extLag, above: peakVal) {
        // The lobe peaks past maxLag: it's periodicity below minFrequency (room rumble, 50/60 Hz
        // mains hum). Counting its cut-off edge would report a phantom pitch pinned to the
        // bottom of the range.
        break
      }
      if peakTau >= minLag {
        peakLags[peakCount] = peakTau
        peakValues[peakCount] = peakVal
        peakCount += 1
        if peakVal > maxPeakValue { maxPeakValue = peakVal }
      }
    }

    if peakCount == 0 || maxPeakValue < PitchDetector.minClarity { return nil }

    var bestTau = -1
    var bestValue = 0.0
    for i in 0..<peakCount where peakValues[i] >= PitchDetector.clarityThreshold * maxPeakValue {
      bestTau = peakLags[i]
      bestValue = peakValues[i]
      break
    }

    // Parabolic interpolation around the chosen peak for sub-sample lag accuracy. nsdf is
    // filled from lag 0, so a peak sitting right on minLag (a note at the very top of the
    // range) can be refined too instead of snapping to sampleRate / minLag.
    var betterTau = Double(bestTau)
    if bestTau < maxLag {
      let s0 = nsdf[bestTau - 1]
      let s1 = nsdf[bestTau]
      let s2 = nsdf[bestTau + 1]
      let denom = 2 * (2 * s1 - s0 - s2)
      if abs(denom) > 1e-12 {
        let shift = (s2 - s0) / denom
        if abs(shift) < 1 { betterTau += shift }
      }
    }

    let frequency = sampleRate / betterTau
    if frequency < minFrequency || frequency > maxFrequency { return nil }
    return PitchDetection(frequency: frequency, clarity: bestValue)
  }

  /// Whether the positive lobe running through `start` climbs above `value` before it ends.
  private func lobeRisesBeyond(_ start: Int, through end: Int, above value: Double) -> Bool {
    var tau = start
    while tau <= end && nsdf[tau] > 0 {
      if nsdf[tau] > value { return true }
      tau += 1
    }
    return false
  }
}

/// Turns a continuous mono stream, delivered hop by hop, into one pitch reading per hop.
///
/// The high-pass filter runs continuously across hops. The previous JS implementation
/// restarted it (and subtracted the window mean) for every window; the filter's startup
/// transient then skewed the autocorrelation and read low strings up to ~25 cents off,
/// depending on phase. Not thread-safe.
final class PitchAnalyzer {
  struct Result {
    let frequency: Double? // nil when silent, still filling the window, or not periodic enough
    let clarity: Double
    let rms: Double // level of the latest (high-passed) hop
  }

  static let highpassCutoffHz = 35.0 // kills DC/rumble well below any supported note

  let windowSize: Int
  let hopSize: Int
  let sampleRate: Double
  let silenceThreshold: Double
  private let detector: PitchDetector
  private let window: UnsafeMutablePointer<Double>
  private let alpha: Double
  private var filled = 0
  private var primed = false
  private var prevIn = 0.0
  private var prevOut = 0.0

  init?(windowSize: Int, hopSize: Int, sampleRate: Double, silenceThreshold: Double) {
    guard hopSize > 0, hopSize <= windowSize, sampleRate > 0,
          let detector = PitchDetector(windowSize: windowSize) else { return nil }
    self.windowSize = windowSize
    self.hopSize = hopSize
    self.sampleRate = sampleRate
    self.silenceThreshold = silenceThreshold
    self.detector = detector
    window = .allocate(capacity: windowSize)
    window.initialize(repeating: 0, count: windowSize)
    let rc = 1 / (2 * Double.pi * PitchAnalyzer.highpassCutoffHz)
    let dt = 1 / sampleRate
    alpha = rc / (rc + dt)
  }

  deinit {
    window.deallocate()
  }

  /// Consumes exactly `hopSize` samples.
  func process(_ hop: UnsafePointer<Float>, minFrequency: Double, maxFrequency: Double) -> Result {
    let keep = windowSize - hopSize
    memmove(window, window + hopSize, keep * MemoryLayout<Double>.stride)

    if !primed {
      prevIn = Double(hop[0])
      primed = true
    }
    var sumSq = 0.0
    for i in 0..<hopSize {
      let x = Double(hop[i])
      prevOut = alpha * (prevOut + x - prevIn)
      prevIn = x
      window[keep + i] = prevOut
      sumSq += prevOut * prevOut
    }
    filled = min(windowSize, filled + hopSize)
    let rms = (sumSq / Double(hopSize)).squareRoot()

    guard filled == windowSize, rms >= silenceThreshold,
          let detection = detector.detect(
            window,
            sampleRate: sampleRate,
            minFrequency: minFrequency,
            maxFrequency: maxFrequency
          )
    else {
      return Result(frequency: nil, clarity: 0, rms: rms)
    }
    return Result(frequency: detection.frequency, clarity: detection.clarity, rms: rms)
  }
}
