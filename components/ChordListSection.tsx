import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { StoredChord } from "@/types/chord";

interface ChordListSectionProps {
  title: string;
  chords: StoredChord[];
  emptyText: string;
  emptyHint: string;
  onChordSelect: (chord: StoredChord) => void;
}

export default function ChordListSection({
  title,
  chords,
  emptyText,
  emptyHint,
  onChordSelect,
}: ChordListSectionProps) {
  const colors = useColors();

  return (
    <View style={styles.section}>
      <AppText style={[styles.title, { color: colors.text }]}>{title}</AppText>
      {chords.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.list}
        >
          {chords.map((chord) => (
            <Pressable
              key={`${chord.root}-${chord.suffix}`}
              style={({ pressed }) => [
                styles.chordItem,
                { backgroundColor: colors.surface },
                pressed && { backgroundColor: colors.primary },
              ]}
              onPress={() => onChordSelect(chord)}
            >
              <AppText style={[styles.chordText, { color: colors.text }]}>
                {chord.displayName}
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
  chordItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    marginRight: 10,
  },
  chordText: {
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
