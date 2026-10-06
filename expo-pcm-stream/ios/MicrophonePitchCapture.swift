import AVFoundation

enum PcmStreamError: Error {
  case noInput
  case unsupportedFormat
  case invalidOptions
}

/// Min/max frequency pair shared between the JS thread (writer) and the analysis thread.
final class FrequencyRange {
  private let lock = NSLock()
  private var minimum: Double
  private var maximum: Double

  init(minimum: Double, maximum: Double) {
    self.minimum = minimum
    self.maximum = maximum
  }

  func set(minimum: Double, maximum: Double) {
    lock.lock()
    self.minimum = minimum
    self.maximum = maximum
    lock.unlock()
  }

  func get() -> (minimum: Double, maximum: Double) {
    lock.lock()
    defer { lock.unlock() }
    return (minimum, maximum)
  }
}

/// Captures the microphone and runs a `PitchAnalyzer` on every hop, off the real-time thread.
///
/// AVAudioEngine's `installTap` only supports 100-400 ms buffers, so a 1024-frame tap still
/// arrives in ~100 ms bursts (several hops at once, then nothing). An `AVAudioSinkNode` runs on
/// the real-time I/O thread at the hardware buffer size instead. Its block only copies samples
/// into a preallocated ring and signals a semaphore once per completed hop - no allocation,
/// locks or Objective-C messaging - and a dedicated thread does the analysis and reports it.
///
/// Must be configured after the audio session is active; `stop()` must be called before release.
final class MicrophonePitchCapture {
  let engine = AVAudioEngine()
  let sampleRate: Double

  private struct RingWriter {
    var position = 0
    var samplesInHop = 0
  }

  // A backlog past this many hops means the analysis thread was starved; it then skips ahead to
  // the newest audio rather than reporting stale pitches late.
  private static let maxBacklogHops = 8
  private static let ringHops = 32

  private let hopSize: Int
  private let hopsPerWindow: Int
  private let analyzer: PitchAnalyzer
  private let range: FrequencyRange
  private let onResult: (PitchAnalyzer.Result) -> Void
  private let sink: AVAudioSinkNode
  private let ring: UnsafeMutablePointer<Float>
  private let writer: UnsafeMutablePointer<RingWriter>
  private let hopReady = DispatchSemaphore(value: 0)
  private let analysisExited = DispatchSemaphore(value: 0)
  private let stateLock = NSLock()
  private var running = false

  init(
    windowSize: Int,
    hopSize: Int,
    silenceThreshold: Double,
    range: FrequencyRange,
    onResult: @escaping (PitchAnalyzer.Result) -> Void
  ) throws {
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else { throw PcmStreamError.noInput }
    guard format.commonFormat == .pcmFormatFloat32 else { throw PcmStreamError.unsupportedFormat }
    guard let analyzer = PitchAnalyzer(
      windowSize: windowSize,
      hopSize: hopSize,
      sampleRate: format.sampleRate,
      silenceThreshold: silenceThreshold
    ) else { throw PcmStreamError.invalidOptions }

    self.sampleRate = format.sampleRate
    self.hopSize = hopSize
    self.hopsPerWindow = (windowSize + hopSize - 1) / hopSize
    self.analyzer = analyzer
    self.range = range
    self.onResult = onResult

    let capacity = Self.ringHops * hopSize // a multiple of hopSize, so every hop is contiguous
    let ring = UnsafeMutablePointer<Float>.allocate(capacity: capacity)
    ring.initialize(repeating: 0, count: capacity)
    let writer = UnsafeMutablePointer<RingWriter>.allocate(capacity: 1)
    writer.initialize(to: RingWriter())
    self.ring = ring
    self.writer = writer

    // Real-time thread: touches only captured raw pointers and the semaphore (never `self`,
    // whose stored properties would go through Swift's dynamic exclusivity checks).
    let hopReady = self.hopReady
    let channelStride = format.isInterleaved ? Int(format.channelCount) : 1 // channel 0 only
    sink = AVAudioSinkNode { _, frameCount, bufferList -> OSStatus in
      guard let data = bufferList.pointee.mBuffers.mData else { return noErr }
      let samples = data.assumingMemoryBound(to: Float.self)
      var position = writer.pointee.position
      var samplesInHop = writer.pointee.samplesInHop
      for i in 0..<Int(frameCount) {
        ring[position] = samples[i * channelStride]
        position += 1
        if position == capacity { position = 0 }
        samplesInHop += 1
        if samplesInHop == hopSize {
          samplesInHop = 0
          hopReady.signal() // release: the hop's samples are visible to the waiting thread
        }
      }
      writer.pointee.position = position
      writer.pointee.samplesInHop = samplesInHop
      return noErr
    }
    engine.attach(sink)
    engine.connect(input, to: sink, format: format)
  }

  deinit {
    engine.stop()
    ring.deallocate()
    writer.deallocate()
  }

  func start() throws {
    setRunning(true)
    let thread = Thread { [self] in analysisLoop() }
    thread.name = "expo.pcmstream.analysis"
    thread.qualityOfService = .userInteractive
    thread.start()

    engine.prepare()
    do {
      try engine.start()
    } catch {
      stop()
      throw error
    }
  }

  /// Stops the engine and waits for the analysis thread to exit, so no result is reported after
  /// this returns. Safe to call more than once.
  func stop() {
    engine.stop() // synchronous: the sink block is not called again after this
    guard setRunning(false) else { return }
    hopReady.signal() // wake the analysis thread so it sees `running == false`
    analysisExited.wait()
  }

  /// Returns whether the value changed.
  @discardableResult
  private func setRunning(_ value: Bool) -> Bool {
    stateLock.lock()
    defer { stateLock.unlock() }
    let changed = running != value
    running = value
    return changed
  }

  private func isRunning() -> Bool {
    stateLock.lock()
    defer { stateLock.unlock() }
    return running
  }

  private func analysisLoop() {
    defer { analysisExited.signal() }
    var slot = 0
    var pending = 0
    while true {
      if pending == 0 {
        hopReady.wait()
        pending = 1
      }
      while hopReady.wait(timeout: .now()) == .success {
        pending += 1
      }
      // `pending` may include the wake-up signal from stop(); nothing is read before this check.
      guard isRunning() else { return }

      if pending > Self.maxBacklogHops {
        // Keep just enough of the newest hops to refill the window contiguously.
        let skip = pending - hopsPerWindow
        slot = (slot + skip) % Self.ringHops
        pending -= skip
      }
      while pending > 0 {
        let (minimum, maximum) = range.get()
        let result = analyzer.process(ring + slot * hopSize, minFrequency: minimum, maxFrequency: maximum)
        slot = (slot + 1) % Self.ringHops
        pending -= 1
        onResult(result)
      }
    }
  }
}
