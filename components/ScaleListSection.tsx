import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { StoredScale } from "@/types/scale";

interface ScaleListSectionProps {
  title: string;
  scales: StoredScale[];
  emptyText: string;
  emptyHint: string;
  onScaleSelect: (scale: StoredScale) => void;
}

export default function ScaleListSection({
  title,
  scales,
  emptyText,
  emptyHint,
  onScaleSelect,
}: ScaleListSectionProps) {
  const colors = useColors();

  return (
    <View style={styles.section}>
      <AppText style={[styles.title, { color: colors.text }]}>{title}</AppText>
      {scales.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.list}
        >
          {scales.map((scale, index) => (
            <Pressable
              key={`${scale.id}-${index}`}
              style={({ pressed }) => [
                styles.scaleItem,
                { backgroundColor: colors.surface },
                pressed && { backgroundColor: colors.primary },
              ]}
              onPress={() => onScaleSelect(scale)}
            >
              <AppText style={[styles.scaleText, { color: colors.text }]}>
                {scale.name}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyContainer, { backgroundColor: colors.surface }]}>
          <AppText style={[styles.emptyText, { color: colors.textSecondary }]}>
            {emptyText}
          </AppText>
          <AppText style={[styles.emptyHint, { color: colors.textSecondary }]}>
            {emptyHint}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  list: {
    flexDirection: "row",
  },
  scaleItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    marginRight: 10,
  },
  scaleText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  emptyHint: {
    fontSize: 12,
    marginTop: 8,
    opacity: 0.7,
    textAlign: "center",
  },
});
