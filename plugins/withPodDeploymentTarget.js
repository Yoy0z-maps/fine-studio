const { withPodfile } = require("expo/config-plugins");

// Xcode 27은 iOS 15 미만 deployment target을 지원하지 않는데, 일부 서드파티 Pod
// (GoogleSignIn, AppAuth, PromisesObjC, RNCAsyncStorage 등)가 9.0~13.4를 지정해
// 빌드가 실패한다. post_install에서 앱 최소 버전보다 낮은 Pod 타깃을 끌어올린다.
const MARKER = "# [withPodDeploymentTarget]";
const MIN_TARGET = "15.1";

const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${MIN_TARGET}')
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'
        end
      end
    end`;

module.exports = function withPodDeploymentTarget(config) {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents;
    if (podfile.includes(MARKER)) return config;

    const anchor = /(post_install do \|installer\|\n\s+react_native_post_install\([\s\S]*?\n\s+\))/;
    if (!anchor.test(podfile)) {
      throw new Error("withPodDeploymentTarget: Podfile post_install 블록을 찾지 못했습니다.");
    }
    config.modResults.contents = podfile.replace(anchor, `$1\n${SNIPPET}`);
    return config;
  });
};
