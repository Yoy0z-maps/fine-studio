import AVFoundation

struct MetronomeParams: Equatable {
  var tempo: Double = 120
  var beats: Int = 4
  var subdivision: Int = 1
  var soundEnabled = true
  var accentEnabled = true
}

/// Plays a `ClickSequencer` through an `AVAudioSourceNode`, so every click is synthesized on an
/// exact sample in the render callback. (Firing a timer and calling `scheduleBuffer(at: nil)`
/// started each click at the next render cycle - up to a whole I/O buffer, ~23 ms, late - so the
/// clicks wandered by that much.)
///
/// The render block is real-time safe: parameter changes are picked up with a try-lock, and beats
/// go out through a preallocated ring plus a semaphore to a dispatcher thread, which reports each
/// one at the moment its click is heard.
final class MetronomeClickEngine {
  let engine = AVAudioEngine()

  private struct PendingParams {
    var params: MetronomeParams
    var version: Int
  }

  private struct BeatRecord {
    var beat: ClickSequencer.Beat
    var hostTime: UInt64 // output time of the render block the click starts in; 0 if unknown
    var offsetFrames: Int64 // where in that block
  }

  private static let ringCapacity = 64

  private let sampleRate: Double
  private let sequencer: UnsafeMutablePointer<ClickSequencer>
  private let paramsLock: UnsafeMutablePointer<os_unfair_lock>
  private let pending: UnsafeMutablePointer<PendingParams>
  private let appliedVersion: UnsafeMutablePointer<Int>
  private let ring: UnsafeMutablePointer<BeatRecord>
  private let ringWriteIndex: UnsafeMutablePointer<Int>
  private let beatReady = DispatchSemaphore(value: 0)
  private let dispatcherExited = DispatchSemaphore(value: 0)
  private let stateLock = NSLock()
  private var running = false
  private var generation = 0
  private let onBeat: (ClickSequencer.Beat) -> Void
  private let timebase: mach_timebase_info_data_t = {
    var info = mach_timebase_info_data_t()
    mach_timebase_info(&info)
    return info
  }()

  /// Call with the audio session already configured, so the output format is the real one.
  init(params: MetronomeParams, onBeat: @escaping (ClickSequencer.Beat) -> Void) {
    self.onBeat = onBeat
    let outputRate = engine.outputNode.outputFormat(forBus: 0).sampleRate
    sampleRate = outputRate > 0 ? outputRate : 48000

    sequencer = .allocate(capacity: 1)
    sequencer.initialize(to: ClickSequencer(sampleRate: sampleRate))
    sequencer.pointee.start(
      tempo: params.tempo,
      beats: params.beats,
      subdivision: params.subdivision,
      soundEnabled: params.soundEnabled,
      accentEnabled: params.accentEnabled
    )
    paramsLock = .allocate(capacity: 1)
    paramsLock.initialize(to: os_unfair_lock())
    pending = .allocate(capacity: 1)
    pending.initialize(to: PendingParams(params: params, version: 0))
    appliedVersion = .allocate(capacity: 1)
    appliedVersion.initialize(to: 0)
    ring = .allocate(capacity: Self.ringCapacity)
    ring.initialize(
      repeating: BeatRecord(
        beat: ClickSequencer.Beat(index: 0, isAccent: false, tempo: 0, frame: 0),
        hostTime: 0,
        offsetFrames: 0
      ),
      count: Self.ringCapacity
    )
    ringWriteIndex = .allocate(capacity: 1)
    ringWriteIndex.initialize(to: 0)

    // Real-time thread: touches only these raw pointers and the semaphore, never `self`.
    let sequencer = self.sequencer
    let paramsLock = self.paramsLock
    let pending = self.pending
    let appliedVersion = self.appliedVersion
    let ring = self.ring
    let ringWriteIndex = self.ringWriteIndex
    let beatReady = self.beatReady
    let capacity = Self.ringCapacity
    let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
    let source = AVAudioSourceNode(format: format) { _, timestamp, frameCount, bufferList -> OSStatus in
      if os_unfair_lock_trylock(paramsLock) {
        if pending.pointee.version != appliedVersion.pointee {
          let p = pending.pointee.params
          sequencer.pointee.setTempo(p.tempo)
          sequencer.pointee.setSubdivision(p.subdivision)
          sequencer.pointee.setBeatsPerMeasure(p.beats)
          sequencer.pointee.soundEnabled = p.soundEnabled
          sequencer.pointee.accentEnabled = p.accentEnabled
          appliedVersion.pointee = pending.pointee.version
        }
        os_unfair_lock_unlock(paramsLock)
      }

      let buffers = UnsafeMutableAudioBufferListPointer(bufferList)
      guard let out = buffers[0].mData?.assumingMemoryBound(to: Float.self) else { return noErr }
      let count = Int(frameCount)
      let hostTime = timestamp.pointee.mFlags.contains(.hostTimeValid) ? timestamp.pointee.mHostTime : 0
      let blockStart = sequencer.pointee.frame
      sequencer.pointee.render(into: out, count: count) { beat in
        ring[ringWriteIndex.pointee % capacity] = BeatRecord(
          beat: beat,
          hostTime: hostTime,
          offsetFrames: beat.frame - blockStart
        )
        ringWriteIndex.pointee += 1
        beatReady.signal() // release: the record is visible to the dispatcher
      }
      return noErr
    }
    engine.attach(source)
    engine.connect(source, to: engine.mainMixerNode, format: format)
  }

  deinit {
    engine.stop()
    sequencer.pointee.deallocate()
    sequencer.deinitialize(count: 1)
    sequencer.deallocate()
    paramsLock.deallocate()
    pending.deallocate()
    appliedVersion.deallocate()
    ring.deallocate()
    ringWriteIndex.deallocate()
  }

  func start() throws {
    setRunning(true)
    let thread = Thread { [self] in dispatchLoop() }
    thread.name = "expo.metronome.beats"
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

  /// (Re)starts the engine after the system stopped it (interruption, route change). The click
  /// track simply resumes where it was.
  func resume() throws {
    if !engine.isRunning { try engine.start() }
  }

  /// Stops the audio and the dispatcher; no beat is reported after this returns.
  func stop() {
    engine.stop()
    guard setRunning(false) else { return }
    beatReady.signal() // wake the dispatcher so it sees `running == false`
    dispatcherExited.wait()
  }

  func update(_ params: MetronomeParams) {
    os_unfair_lock_lock(paramsLock)
    pending.pointee.params = params
    pending.pointee.version += 1
    os_unfair_lock_unlock(paramsLock)
  }

  /// Returns whether the value changed; stopping also invalidates beats already scheduled.
  @discardableResult
  private func setRunning(_ value: Bool) -> Bool {
    stateLock.lock()
    defer { stateLock.unlock() }
    let changed = running != value
    running = value
    if changed && !value { generation += 1 }
    return changed
  }

  private func currentGeneration() -> Int? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return running ? generation : nil
  }

  private func dispatchLoop() {
    defer { dispatcherExited.signal() }
    var readIndex = 0
    while true {
      beatReady.wait()
      guard let generation = currentGeneration() else { return }
      let record = ring[readIndex % Self.ringCapacity]
      readIndex += 1

      let deadline: DispatchTime
      if record.hostTime != 0 {
        // Host time is when the render block reaches the output; add the click's offset in it
        // and the hardware's own output latency.
        var latency = 0.0
        #if os(iOS)
        latency = AVAudioSession.sharedInstance().outputLatency
        #endif
        let blockNanos = record.hostTime * UInt64(timebase.numer) / UInt64(timebase.denom)
        let offsetNanos = UInt64(max(0, (Double(record.offsetFrames) / sampleRate + latency) * 1e9))
        deadline = DispatchTime(uptimeNanoseconds: blockNanos + offsetNanos)
      } else {
        deadline = .now()
      }
      let beat = record.beat
      DispatchQueue.main.asyncAfter(deadline: deadline) { [weak self] in
        guard let self = self, self.currentGeneration() == generation else { return }
        self.onBeat(beat)
      }
    }
  }
}
