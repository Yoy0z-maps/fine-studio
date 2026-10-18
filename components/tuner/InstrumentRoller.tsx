import AppText from "@/components/AppText";
import InstrumentIcon from "@/components/tuner/InstrumentIcon";
import { useColors } from "@/contexts/ThemeContext";
import { INSTRUMENT_IDS, InstrumentId } from "@/utils/audio/instruments";
import * as Haptics from "expo-haptics";
import { memo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const ITEM_HEIGHT = 44;
export const ROLLER_WIDTH = 72;
/** The selected item plus half of each neighbor (seen only while rolling). */
export const ROLLER_HEIGHT = ITEM_HEIGHT * 2;
const COUNT = INSTRUMENT_IDS.length;

const clampIndex = (i: number) => Math.min(COUNT - 1, Math.max(0, i));

type ItemProps = {
  id: InstrumentId;
  index: number;
  scrollY: SharedValue<number>;
  /** 0 at rest, 1 while the wheel is being rolled. */
  rolling: SharedValue<number>;
  itemHeight: number;
  selected: boolean;
  scale: number;
};

const RollerItem = memo(function RollerItem({
  id,
  index,
  scrollY,
  rolling,
  itemHeight,
  selected,
  scale,
}: ItemProps) {
  const colors = useColors();
  const { t } = useTranslation();

  // At rest only the selected icon and name show; while rolling, the neighbors fade in and turn
  // away like the faces of a drum as they leave the middle.
  const animatedStyle = useAnimatedStyle(() => {
    const offset = (scrollY.value - index * itemHeight) / itemHeight; // > 0: above the middle
    const distance = Math.abs(offset);
    const onDrum = interpolate(distance, [0, 1, 1.6], [1, 0.4, 0], Extrapolation.CLAMP);
    const atRest = interpolate(distance, [0, 0.5], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: onDrum * (atRest + (1 - atRest) * rolling.value),
      transform: [
        { perspective: 400 },
        { rotateX: `${interpolate(offset, [-1.6, 0, 1.6], [-75, 0, 75], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(distance, [0, 1], [1, 0.82], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.item, { height: itemHeight }, animatedStyle]}>
      <InstrumentIcon
        instrument={id}
        size={28 * scale}
        color={selected ? colors.primary : colors.text}
        holeColor={colors.background}
      />
      <AppText
        numberOfLines={1}
        style={[
          styles.label,
          { fontSize: 10 * scale, color: selected ? colors.primary : colors.textSecondary },
        ]}
      >
        {t(`tuner.instruments.${id}`)}
      </AppText>
    </Animated.View>
  );
});

type Props = {
  value: InstrumentId;
  onChange: (id: InstrumentId) => void;
  scale: number;
};

/**
 * A drum wheel of instrument icons: roll it up or down to switch. At rest it shows just the
 * selected instrument's icon and name. The choice is made once the wheel comes to rest, so rolling
 * past the bass doesn't restart the audio stream on the way.
 */
function InstrumentRoller({ value, onChange, scale }: Props) {
  const { t } = useTranslation();
  const itemHeight = ITEM_HEIGHT * scale;
  const index = clampIndex(INSTRUMENT_IDS.indexOf(value));

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(index * itemHeight);
  const centeredIndex = useSharedValue(index); // for the haptic tick as items pass the middle
  const rolling = useSharedValue(0);
  const momentumRef = useRef(false);
  const targetRef = useRef<number | null>(null); // a scroll this component started itself
  // Where the wheel starts. Only ever the first value: on iOS a contentOffset prop that changes
  // while a scrollTo animation runs gets applied on top of it (one step lands two items away).
  const initialOffset = useRef({ x: 0, y: index * itemHeight }).current;
  const positionedRef = useRef(false);

  const tick = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const centered = Math.min(COUNT - 1, Math.max(0, Math.round(event.contentOffset.y / itemHeight)));
      if (centered !== centeredIndex.value) {
        centeredIndex.value = centered;
        scheduleOnRN(tick);
      }
    },
  });

  const scrollToIndex = useCallback(
    (i: number, animated: boolean) => {
      scrollRef.current?.scrollTo({ y: i * itemHeight, animated });
    },
    [itemHeight, scrollRef]
  );

  const select = useCallback(
    (i: number) => {
      const id = INSTRUMENT_IDS[clampIndex(i)];
      if (id !== value) onChange(id);
    },
    [onChange, value]
  );

  // Follow changes made elsewhere (the saved instrument loading, accessibility actions).
  useEffect(() => {
    if (targetRef.current === index) {
      targetRef.current = null; // this wheel is already rolling there
      return;
    }
    if (Math.abs(scrollY.value - index * itemHeight) > 1) {
      centeredIndex.value = index; // no tick for a jump
      scrollToIndex(index, false);
    }
  }, [index, itemHeight, scrollToIndex, scrollY, centeredIndex]);

  const rollTo = useCallback(
    (i: number) => {
      const target = clampIndex(i);
      targetRef.current = target;
      scrollToIndex(target, true);
      select(target);
    },
    [scrollToIndex, select]
  );

  const settleAt = (y: number) => {
    rolling.value = withTiming(0, { duration: 250 });
    select(Math.round(y / itemHeight));
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") rollTo(index + 1);
    else if (event.nativeEvent.actionName === "decrement") rollTo(index - 1);
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t("tuner.instrument")}
      accessibilityValue={{ text: t(`tuner.instruments.${value}`) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={onAccessibilityAction}
      style={[styles.container, { width: ROLLER_WIDTH * scale, height: ROLLER_HEIGHT * scale }]}
    >
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        overScrollMode="never"
        contentOffset={initialOffset}
        contentContainerStyle={{ paddingVertical: itemHeight / 2 }}
        onLayout={() => {
          // In case the platform ignored contentOffset; once, so it can't cut into a later scroll.
          if (positionedRef.current) return;
          positionedRef.current = true;
          scrollToIndex(index, false);
        }}
        onScrollBeginDrag={() => {
          momentumRef.current = false;
          rolling.value = withTiming(1, { duration: 120 });
        }}
        onMomentumScrollBegin={() => {
          momentumRef.current = true;
        }}
        onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          momentumRef.current = false;
          settleAt(event.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          // Released exactly on an item: no momentum phase follows.
          const y = event.nativeEvent.contentOffset.y;
          setTimeout(() => {
            if (!momentumRef.current) settleAt(y);
          }, 150);
        }}
      >
        {INSTRUMENT_IDS.map((id, i) => (
          <RollerItem
            key={id}
            id={id}
            index={i}
            scrollY={scrollY}
            rolling={rolling}
            itemHeight={itemHeight}
            selected={id === value}
            scale={scale}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: "600",
    marginTop: 2,
  },
});

export default memo(InstrumentRoller);
