import ExpoModulesCore
import AVFoundation

public class ExpoMetronomeModule: Module {
  // Engine and session changes run here, in call order and off the JS thread.
  private let audioQueue = DispatchQueue(label: "metronome.audio", qos: .userInteractive)
  private var clickEngine: MetronomeClickEngine?
  private var engineObservers: [NSObjectProtocol] = []
  private var sessionObservers: [NSObjectProtocol] = []
  private var savedSession: (category: AVAudioSession.Category, mode: AVAudioSession.Mode, options: AVAudioSession.CategoryOptions)?

  // Settings persist between plays (JS sets the subdivision before calling start). Written on
  // the JS thread, read on audioQueue.
  private let paramsLock = NSLock()
  private var params = MetronomeParams()
  private var playing = false

  public func definition() -> ModuleDefinition {
    Name("ExpoMetronome")

    Events("onBeat")

    OnCreate {
      self.observeAudioSession()
    }

    OnDestroy {
      self.sessionObservers.forEach { NotificationCenter.default.removeObserver($0) }
      self.sessionObservers.removeAll()
      self.setPlaying(false)
      self.audioQueue.sync { self.stopEngine(releasingSession: true) }
    }

    Function("start") { (bpm: Double, beats: Int, sound: Bool, accent: Bool) in
      self.updateParams {
        $0.tempo = bpm
        $0.beats = beats
        $0.soundEnabled = sound
        $0.accentEnabled = accent
      }
      self.setPlaying(true)
      self.audioQueue.async { self.startEngine() }
    }

    Function("stop") {
      self.setPlaying(false)
      self.audioQueue.async { self.stopEngine(releasingSession: true) }
    }

    Function("setTempo") { (bpm: Double) in
      self.updateParams { $0.tempo = bpm }
    }

    Function("setBeats") { (beats: Int) in
      self.updateParams { $0.beats = beats }
    }

    Function("setSubdivision") { (sub: Int) in
      // 1 = quarter, 2 = eighth, 3 = triplet, 4 = sixteenth
      self.updateParams { $0.subdivision = sub }
    }

    Function("setSoundEnabled") { (enabled: Bool) in
      self.updateParams { $0.soundEnabled = enabled }
    }

    Function("setAccentEnabled") { (enabled: Bool) in
      self.updateParams { $0.accentEnabled = enabled }
    }

    Function("isPlaying") { () -> Bool in
      return self.isPlaying()
    }
  }

  // MARK: - State shared with the JS thread

  private func updateParams(_ change: (inout MetronomeParams) -> Void) {
    paramsLock.lock()
    change(&params)
    let current = params
    paramsLock.unlock()
    // A running track picks the change up at its next render block.
    audioQueue.async { self.clickEngine?.update(current) }
  }

  private func currentParams() -> MetronomeParams {
    paramsLock.lock()
    defer { paramsLock.unlock() }
    return params
  }

  private func setPlaying(_ value: Bool) {
    paramsLock.lock()
    playing = value
    paramsLock.unlock()
  }

  private func isPlaying() -> Bool {
    paramsLock.lock()
    defer { paramsLock.unlock() }
    return playing
  }

  // MARK: - Engine (audioQueue only)

  private func startEngine() {
    stopEngine(releasingSession: false)
    guard isPlaying() else { return } // a stop() arrived first
    configureSession()

    let engine = MetronomeClickEngine(params: currentParams()) { [weak self] beat in
      self?.sendEvent("onBeat", [
        "beat": beat.index,
        "isAccent": beat.isAccent,
        "tempo": beat.tempo,
        "subBeat": 0,
      ])
    }
    // The engine stops itself when the output route or format changes; resume the same track.
    engineObservers.append(NotificationCenter.default.addObserver(
      forName: .AVAudioEngineConfigurationChange,
      object: engine.engine,
      queue: nil
    ) { [weak self] _ in
      self?.audioQueue.async { try? self?.clickEngine?.resume() }
    })
    do {
      try engine.start()
      clickEngine = engine
    } catch {
      removeEngineObservers()
      setPlaying(false) // e.g. during a phone call
      releaseSession()
    }
  }

  private func stopEngine(releasingSession: Bool) {
    removeEngineObservers()
    clickEngine?.stop()
    clickEngine = nil
    if releasingSession {
      releaseSession()
    }
  }

  private func removeEngineObservers() {
    engineObservers.forEach { NotificationCenter.default.removeObserver($0) }
    engineObservers.removeAll()
  }

  private func observeAudioSession() {
    let center = NotificationCenter.default
    sessionObservers.append(center.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: nil
    ) { [weak self] notification in
      guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            AVAudioSession.InterruptionType(rawValue: rawType) == .ended else { return }
      // The system stopped the engine for the interruption (call, Siri, alarm); pick back up.
      self?.audioQueue.async {
        guard let self = self, self.isPlaying() else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        try? self.clickEngine?.resume()
      }
    })
    sessionObservers.append(center.addObserver(
      forName: AVAudioSession.mediaServicesWereResetNotification,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      // Every audio object is invalid after a media server reset: build a new engine.
      self?.audioQueue.async {
        guard let self = self, self.isPlaying() else { return }
        self.savedSession = nil // the reset restored the session defaults
        self.startEngine()
      }
    })
  }

  // MARK: - Audio session

  private func configureSession() {
    let session = AVAudioSession.sharedInstance()
    // While the tuner holds the mic the session is .playAndRecord, which plays fine: leave it.
    if session.category != .playAndRecord {
      if savedSession == nil {
        savedSession = (session.category, session.mode, session.categoryOptions)
      }
      // .playback: clicks stay audible with the silent switch on.
      try? session.setCategory(.playback, mode: .default, options: [])
    }
    try? session.setActive(true)
  }

  /// Hands the session back as found, if it's still ours (the tuner may have taken it over).
  private func releaseSession() {
    guard let saved = savedSession else { return }
    savedSession = nil
    let session = AVAudioSession.sharedInstance()
    guard session.category == .playback else { return }
    // Lets other apps' audio that starting the metronome interrupted resume.
    try? session.setActive(false, options: .notifyOthersOnDeactivation)
    try? session.setCategory(saved.category, mode: saved.mode, options: saved.options)
  }
}
