const { withXcodeProject, withInfoPlist, IOSConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// 각 언어별 권한 문구
const LOCALIZED_STRINGS = {
  en: {
    NSMicrophoneUsageDescription: "Microphone access is required for the tuner feature.",
    NSUserTrackingUsageDescription: "This app uses tracking to provide personalized ads and improve your experience.",
  },
  ko: {
    NSMicrophoneUsageDescription: "튜너 기능을 위해 마이크 접근 권한이 필요합니다.",
    NSUserTrackingUsageDescription: "맞춤형 광고 제공 및 사용자 경험 개선을 위해 추적 권한이 필요합니다.",
  },
  ja: {
    NSMicrophoneUsageDescription: "チューナー機能を使用するにはマイクへのアクセスが必要です。",
    NSUserTrackingUsageDescription: "パーソナライズされた広告の提供とユーザー体験の向上のために、トラッキングの許可が必要です。",
  },
  zh: {
    NSMicrophoneUsageDescription: "调音器功能需要麦克风访问权限。",
    NSUserTrackingUsageDescription: "此应用使用跟踪功能来提供个性化广告并改善您的体验。",
  },
};

function withInfoPlistLocalization(config) {
  // 1. Info.plist에서 기본 권한 문구 설정 (영어를 기본으로)
  config = withInfoPlist(config, (config) => {
    config.modResults.NSMicrophoneUsageDescription = LOCALIZED_STRINGS.en.NSMicrophoneUsageDescription;
    config.modResults.NSUserTrackingUsageDescription = LOCALIZED_STRINGS.en.NSUserTrackingUsageDescription;
    return config;
  });

  // 2. Xcode 프로젝트에 로컬라이제이션 파일 추가
  config = withXcodeProject(config, async (config) => {
    const project = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const projectName = config.modRequest.projectName;
    const iosPath = path.join(projectRoot, "ios", projectName);

    // 각 언어별 .lproj 폴더 생성 및 InfoPlist.strings 파일 생성
    for (const [locale, strings] of Object.entries(LOCALIZED_STRINGS)) {
      const lprojPath = path.join(iosPath, `${locale}.lproj`);

      // .lproj 폴더 생성
      if (!fs.existsSync(lprojPath)) {
        fs.mkdirSync(lprojPath, { recursive: true });
      }

      // InfoPlist.strings 파일 내용 생성
      const stringsContent = Object.entries(strings)
        .map(([key, value]) => `"${key}" = "${value}";`)
        .join("\n");

      const stringsPath = path.join(lprojPath, "InfoPlist.strings");
      fs.writeFileSync(stringsPath, stringsContent);

      // Xcode 프로젝트에 파일 추가
      const groupName = `${locale}.lproj`;

      // 기존 그룹 찾기 또는 생성
      let group = project.pbxGroupByName(groupName);
      if (!group) {
        // 메인 그룹 찾기
        const mainGroup = project.getFirstProject().firstProject.mainGroup;
        const mainGroupObj = project.getPBXGroupByKey(mainGroup);

        // 새 그룹 생성
        const newGroupUuid = project.pbxCreateGroup(groupName, groupName);

        // 메인 그룹에 추가
        if (mainGroupObj && mainGroupObj.children) {
          mainGroupObj.children.push({
            value: newGroupUuid,
            comment: groupName,
          });
        }
      }

      // InfoPlist.strings 파일을 리소스로 추가
      const relativePath = `${projectName}/${locale}.lproj/InfoPlist.strings`;

      try {
        project.addResourceFile(
          relativePath,
          { target: project.getFirstTarget().uuid },
          project.getFirstProject().firstProject.mainGroup
        );
      } catch (e) {
        // 이미 추가된 경우 무시
      }
    }

    return config;
  });

  return config;
}

module.exports = withInfoPlistLocalization;
